"""Production publication workflow for dashboard projects."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
import logging

import requests
from flask import current_app, has_request_context, request
from werkzeug.utils import secure_filename

from extensions import db
from models import AuditEvent, LlmTask, Project
from src.errors import DashboardError
from src.services.llm_tasks import sync_completed_job_assessments
from src.services.object_store import (
    presigned_artifact_url,
    read_artifact_manifest,
    read_partial_job_artifacts,
)
from src.services.platform_control import _items, _request
from src.services.projects import get_project


LOGGER = logging.getLogger(__name__)
ACTIVE_RUN_STATUSES = {"QUEUED", "STARTING", "RUNNING", "WAITING", "RETRYING", "PAUSED"}
ACTIVE_JOB_STATUSES = {"QUEUED", "LEASED", "RUNNING", "RETRY_WAIT", "PAUSED"}
COMPLETED_JOB_STATUSES = {"SUCCEEDED", "COMPLETED"}
GEO_MEDIA_TYPES = {
    "application/geo+json",
    "application/geopackage+sqlite3",
    "application/vnd.google-earth.kml+xml",
    "application/gml+xml",
}
GEO_EXTENSIONS = {".geojson", ".gpkg", ".json", ".kml", ".gml", ".zip"}
WFS_FORMATS = {"GeoJSON", "GeoPackage", "Shapefile"}
WFS_MEDIA_TYPES = {
    "application/geo+json",
    "application/geopackage+sqlite3",
    "application/json",
    "application/gml+xml",
    "application/vnd.google-earth.kml+xml",
    "application/x-flatgeobuf",
    "application/x-sqlite3",
    "application/vnd.apache.parquet",
    "text/csv",
    "application/zip",
}
WFS_EXTENSIONS = {
    ".csv",
    ".fgb",
    ".geojson",
    ".gml",
    ".gpkg",
    ".json",
    ".kml",
    ".parquet",
    ".shp",
    ".sqlite",
    ".zip",
}
RASTER_EXTENSIONS = {
    ".asc",
    ".bil",
    ".dem",
    ".grd",
    ".img",
    ".jp2",
    ".nc",
    ".tif",
    ".tiff",
    ".vrt",
    ".xyz",
}
CITY_MODEL_EXTENSIONS = {
    ".3dtiles",
    ".b3dm",
    ".citygml",
    ".dae",
    ".gml",
    ".ifc",
    ".las",
    ".laz",
    ".obj",
}
RASTER_FORMAT_TOKENS = {
    "asciigrid",
    "cog",
    "dem",
    "geotiff",
    "jpeg2000",
    "netcdf",
    "raster",
    "xyz",
}
CITY_MODEL_FORMAT_TOKENS = {
    "3dtiles",
    "citygml",
    "gml",
    "ifc",
    "las",
    "laz",
    "lod2",
    "pointcloud",
}
MEDIA_EXTENSIONS = {
    "application/geo+json": ".geojson",
    "application/geopackage+sqlite3": ".gpkg",
    "application/json": ".json",
    "application/x-ndjson": ".ndjson",
    "application/ndjson": ".ndjson",
    "text/csv": ".csv",
    "text/tab-separated-values": ".tsv",
    "text/plain": ".txt",
    "application/zip": ".zip",
}


def release_project(project_id: str) -> dict:
    project = get_project(project_id)
    _ensure_release_requested(project)
    campaigns = [
        item
        for item in _items("/api/v1/campaigns")
        if str((item.get("goal") or {}).get("project_id") or "") == project.id
    ]
    campaign_ids = {str(item.get("id")) for item in campaigns if item.get("id")}
    if not campaign_ids:
        return _waiting_release_response(
            project,
            "PROJECT_HAS_NO_DATA",
            "Das Projekt enthaelt noch keine Datenkampagne. Die Freigabe wurde vorgemerkt.",
        )

    all_runs = [
        item
        for item in _items("/api/v1/runs")
        if str(item.get("campaign_id") or "") in campaign_ids
    ]
    runs = _latest_release_runs(all_runs)
    # The list endpoint returns summaries. Immutable artifact manifests live on
    # run details and must be loaded before collecting completed downloads.
    runs = [
        _request("GET", f"/api/v1/runs/{run['id']}")
        if not run.get("steps") and run.get("id") else run
        for run in runs
    ]
    run_ids = {str(item.get("id")) for item in runs if item.get("id")}
    release_jobs = [
        item
        for item in _items("/api/v1/jobs")
        if str(item.get("workflow_run_id") or "") in run_ids
        and str(item.get("status") or "").upper()
        in COMPLETED_JOB_STATUSES | ACTIVE_JOB_STATUSES
        and item.get("job_id")
    ]
    if not release_jobs:
        return _waiting_release_response(
            project,
            "PROJECT_HAS_NO_SUCCESSFUL_DATA",
            "Der Datenjob ist noch nicht gestartet. Die Freigabe wurde vorgemerkt.",
        )

    active_jobs = [
        item
        for item in release_jobs
        if str(item.get("status") or "").upper() in ACTIVE_JOB_STATUSES
    ]
    previous_release = dict(
        (project.metadata_json or {}).get("production_release") or {}
    )
    tasks = _project_assessments(project.id, campaign_ids)
    completed_job_ids = {
        str(item.source_job_id)
        for item in tasks
        if item.status == "COMPLETED" and item.source_job_id
    }
    missing_assessments = [
        item
        for item in release_jobs
        if str(item.get("status") or "").upper() in COMPLETED_JOB_STATUSES
        and str(item.get("job_id")) not in completed_job_ids
    ]
    if missing_assessments:
        try:
            sync_completed_job_assessments(
                jobs=missing_assessments,
                max_new=len(missing_assessments),
            )
            tasks = _project_assessments(project.id, campaign_ids)
        except Exception:
            LOGGER.info(
                "Optional project assessment is not available yet",
                exc_info=True,
            )

    max_artifacts = int(
        current_app.config["PRODUCTION_PUBLICATION_MAX_ARTIFACTS"]
    )
    artifacts = _expand_artifact_manifests(
        _collect_artifacts(runs),
        max_artifacts=max_artifacts,
    )
    artifacts = _merge_artifacts(
        artifacts,
        _collect_partial_job_artifacts(
            active_jobs,
            max_artifacts=max_artifacts,
        ),
        _collect_checkpoint_artifacts(
            active_jobs,
            max_artifacts=max_artifacts,
        ),
        max_artifacts=max_artifacts,
    )
    if not artifacts:
        return _waiting_release_response(
            project,
            "PROJECT_HAS_NO_ARTIFACTS",
            "Der Job laeuft, hat aber noch kein vollstaendiges Manifestsegment gespeichert. Die Freigabe bleibt vorgemerkt.",
        )

    detected_formats = (
        _project_geospatial_formats(tasks)
        | _job_geospatial_formats(release_jobs)
    )
    is_georeferenced = (
        bool(detected_formats)
        or any(
            _task_is_georeferenced(item)
            for item in tasks
            if item.status == "COMPLETED"
        )
        or any(_is_strong_geospatial_artifact(item) for item in artifacts)
    )
    publication_profile = _publication_profile(
        detected_formats,
        artifacts,
        is_georeferenced,
    )
    publication_kind = (
        "geospatial"
        if publication_profile == "vector"
        else "file_collection"
        if is_georeferenced
        or publication_profile
        in {"raster", "terrain", "city_model", "geodata_files"}
        else "non_spatial"
    )
    partial = bool(active_jobs)

    release_key = sha256(
        "|".join(
            [
                project.id,
                publication_kind,
                publication_profile,
                *sorted(
                    str(item.get("sha256") or item.get("ref") or "")
                    for item in artifacts
                ),
            ]
        ).encode("utf-8")
    ).hexdigest()
    existing = _defer_to_existing_partial(
        previous_release,
        active=bool(active_jobs),
        current_release_key=release_key,
        current_artifact_count=len(artifacts),
    )
    if existing is not None:
        return _refresh_existing_release(project, previous_release, existing)

    payload_artifacts = [
        {
            "name": _artifact_name(artifact, index),
            "source_url": str((artifact.get("metadata") or {}).get("original_url") or ""),
            "url": presigned_artifact_url(
                str(artifact["ref"]),
                name=_artifact_name(artifact, index),
                media_type=str(
                    artifact.get("media_type")
                    or "application/octet-stream"
                ),
            ),
            "size_bytes": _optional_int(artifact.get("size_bytes")),
            "sha256": str(artifact.get("sha256") or "").lower() or None,
            "media_type": str(
                artifact.get("media_type")
                or "application/octet-stream"
            ),
        }
        for index, artifact in enumerate(artifacts, start=1)

    ]
    source_job_ids = sorted(
        str(item.get("job_id")) for item in release_jobs
    )
    publication = _publish_to_geoserver(
        {
            "release_key": release_key,
            "project_id": project.id,
            "project_name": project.name,
            "dataset_id": str((project.metadata_json or {}).get("dataset_id") or "").strip() or None,
            "kind": publication_kind,
            "publication_profile": publication_profile,
            "detected_formats": sorted(detected_formats),
            "artifacts": payload_artifacts,
            "assessment_ids": [
                item.id for item in tasks if item.status == "COMPLETED"
            ],
            "partial": partial,
            "source_run_ids": sorted(run_ids),
            "source_job_ids": source_job_ids,
            "source_files_completed": _active_files_completed(active_jobs),
        }
    )

    metadata = dict(project.metadata_json or {})
    previous_release = dict(metadata.get("production_release") or {})
    metadata["production_release"] = {
        "eligible": True,
        "enabled_at": (
            previous_release.get("enabled_at")
            or publication.get("created_at")
            or publication.get("updated_at")
        ),
        "updated_at": (
            publication.get("updated_at")
            or publication.get("created_at")
            or datetime.now(timezone.utc).isoformat()
        ),
        "integration_status": str(
            publication.get("status") or "queued"
        ).upper(),
        "kind": publication_kind,
        "publication_profile": publication_profile,
        "dataset_id": publication.get("dataset_id"),
        "release_key": release_key,
        "artifact_count": len(payload_artifacts),
        "publication": publication,
        "auto_update": True,
        "last_error": publication.get("error"),
        "wfs_url": (
            publication.get("wfs_url")
            or dict(publication.get("urls") or {}).get("wfs_url")
        ),
        "collection_url": publication.get("collection_url"),
        "partial": partial,
        "source_run_ids": sorted(run_ids),
        "source_job_ids": source_job_ids,
        "source_files_completed": _active_files_completed(active_jobs),
    }
    project.metadata_json = metadata
    db.session.add(
        AuditEvent(
            action="project.production_released",
            resource_type="Project",
            resource_id=project.id,
            details={
                "kind": publication_kind,
                "dataset_id": publication.get("dataset_id"),
                "release_key": release_key,
                "artifact_count": len(payload_artifacts),
                "partial": partial,
            },
        )
    )
    db.session.commit()
    return {
        "project": project.to_dict(),
        "publication": publication,
        "kind": publication_kind,
        "partial": partial,
    }



def _ensure_release_requested(project: Project) -> None:
    metadata = dict(project.metadata_json or {})
    release = dict(metadata.get("production_release") or {})
    if release.get("eligible") is True and release.get("auto_update") is not False:
        return
    now = datetime.now(timezone.utc).isoformat()
    release.update(
        {
            "eligible": True,
            "auto_update": True,
            "enabled_at": release.get("enabled_at") or now,
            "updated_at": now,
            "integration_status": "REQUESTED",
            "last_error": None,
            "last_error_code": None,
        }
    )
    metadata["production_release"] = release
    project.metadata_json = metadata
    db.session.add(
        AuditEvent(
            action="project.production_release_requested",
            resource_type="Project",
            resource_id=project.id,
            details={"auto_update": True},
        )
    )
    db.session.commit()
def _latest_release_runs(runs: list[dict]) -> list[dict]:
    latest: dict[str, dict] = {}
    for run in runs:
        if str(run.get("status") or "").upper() not in ACTIVE_RUN_STATUSES | {"COMPLETED", "SUCCEEDED"}:
            continue
        campaign_id = str(run.get("campaign_id") or "")
        if not campaign_id:
            continue
        sort_key = str(
            run.get("finished_at")
            or run.get("started_at")
            or run.get("scheduled_for")
            or run.get("created_at")
            or ""
        )
        current = latest.get(campaign_id)
        current_key = str(
            (current or {}).get("finished_at")
            or (current or {}).get("started_at")
            or (current or {}).get("scheduled_for")
            or (current or {}).get("created_at")
            or ""
        )
        if current is None or sort_key > current_key:
            latest[campaign_id] = run
    return list(latest.values())


def _waiting_release_response(
    project: Project,
    code: str,
    message: str,
) -> dict:
    metadata = dict(project.metadata_json or {})
    release = dict(metadata.get("production_release") or {})
    release.update(
        {
            "eligible": True,
            "auto_update": True,
            "integration_status": "WAITING_FOR_DATA",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_error": None,
            "last_error_code": None,
            "waiting_code": code,
            "waiting_message": message,
        }
    )
    metadata["production_release"] = release
    project.metadata_json = metadata
    db.session.commit()
    return {
        "project": project.to_dict(),
        "publication": dict(release.get("publication") or {}),
        "kind": release.get("kind"),
        "partial": bool(release.get("partial")),
        "status": "waiting_for_data",
        "message": message,
    }


def _collect_partial_job_artifacts(
    jobs: list[dict],
    *,
    max_artifacts: int,
) -> list[dict]:
    artifacts: list[dict] = []
    for job in jobs:
        tenant_id = str(job.get("tenant_id") or "")
        step_run_id = str(job.get("step_run_id") or "")
        job_id = str(job.get("job_id") or "")
        if not tenant_id or not step_run_id or not job_id:
            continue
        candidates = read_partial_job_artifacts(
            tenant_id,
            step_run_id,
            job_id,
            max_artifacts=max_artifacts,
        )
        artifacts.extend(_normalize_worker_artifact(item) for item in candidates)
        if len(artifacts) > max_artifacts:
            raise DashboardError(
                "TOO_MANY_ARTIFACTS_FOR_PRODUCTION",
                f"Die Produktionsuebergabe unterstuetzt hoechstens {max_artifacts:,} Dateien pro Datensatz.",
                422,
            )
    return artifacts


def _collect_checkpoint_artifacts(
    jobs: list[dict],
    *,
    max_artifacts: int,
) -> list[dict]:
    """Expose completed files before the worker flushes its first manifest segment."""
    artifacts: list[dict] = []
    run_cache: dict[str, dict] = {}
    bucket = str(current_app.config["OBJECT_STORE_BUCKET"])
    for job in jobs:
        run_id = str(job.get("workflow_run_id") or "")
        step_run_id = str(job.get("step_run_id") or "")
        if not run_id or not step_run_id:
            continue
        try:
            run = run_cache.get(run_id)
            if run is None:
                run = _request("GET", f"/api/v1/runs/{quote(run_id)}")
                run_cache[run_id] = run
        except DashboardError:
            LOGGER.info(
                "Checkpoint for active production release is not available",
                exc_info=True,
            )
            continue
        step = next(
            (
                item
                for item in (run.get("steps") or [])
                if str(item.get("id") or "") == step_run_id
            ),
            None,
        )
        attempts = list((step or {}).get("attempts") or [])
        checkpoint = dict((attempts[-1] if attempts else {}).get("checkpoint") or {})
        if checkpoint:
            job["release_checkpoint"] = checkpoint
        for item in checkpoint.get("recent_files") or []:
            if not isinstance(item, dict) or item.get("duplicate"):
                continue
            digest = str(item.get("sha256") or "").strip().lower()
            if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
                continue
            name = secure_filename(str(item.get("name") or ""))
            if not name:
                continue
            suffix = Path(name).suffix.lower()
            media_type = {
                ".zip": "application/zip",
                ".json": "application/json",
                ".geojson": "application/geo+json",
                ".csv": "text/csv",
                ".tsv": "text/tab-separated-values",
                ".xyz": "text/plain",
                ".gml": "application/gml+xml",
                ".gpkg": "application/geopackage+sqlite3",
                ".tif": "image/tiff",
                ".tiff": "image/tiff",
            }.get(suffix, "application/octet-stream")
            artifacts.append(
                {
                    "kind": "artifact",
                    "ref": f"s3://{bucket}/sha256/{digest[:2]}/{digest[2:4]}/{digest}",
                    "sha256": digest,
                    "size_bytes": _optional_int(item.get("size_bytes")),
                    "media_type": media_type,
                    "metadata": {
                        "source_name": name,
                        "checkpoint_recovered": True,
                    },
                }
            )
            if len(artifacts) > max_artifacts:
                raise DashboardError(
                    "TOO_MANY_ARTIFACTS_FOR_PRODUCTION",
                    f"Die Produktionsuebergabe unterstuetzt hoechstens {max_artifacts:,} Dateien pro Datensatz.",
                    422,
                )
    return artifacts


def _normalize_worker_artifact(candidate: dict) -> dict:
    return {
        "kind": "artifact",
        "ref": candidate.get("storage_uri"),
        "sha256": candidate.get("sha256"),
        "size_bytes": candidate.get("size_bytes"),
        "media_type": (
            candidate.get("detected_media_type")
            or candidate.get("declared_media_type")
            or "application/octet-stream"
        ),
        "metadata": {
            "original_url": candidate.get("original_url"),
            "final_url": candidate.get("final_url"),
            "malware_status": candidate.get("malware_status"),
            "format_status": candidate.get("format_status"),
            "response_status": candidate.get("response_status"),
        },
    }


def _merge_artifacts(
    *groups: list[dict],
    max_artifacts: int,
) -> list[dict]:
    merged: list[dict] = []
    seen: set[str] = set()
    for group in groups:
        for artifact in group:
            _validate_artifact_integrity(artifact)
            identity = str(
                artifact.get("sha256")
                or artifact.get("ref")
                or ""
            )
            if not identity or identity in seen:
                continue
            seen.add(identity)
            merged.append(artifact)
            if len(merged) > max_artifacts:
                raise DashboardError(
                    "TOO_MANY_ARTIFACTS_FOR_PRODUCTION",
                    f"Die Produktionsuebergabe unterstuetzt hoechstens {max_artifacts:,} Dateien pro Datensatz.",
                    422,
                )
    return merged


def _job_geospatial_formats(jobs: list[dict]) -> set[str]:
    text = json.dumps(jobs, ensure_ascii=True, sort_keys=True).casefold()
    formats: set[str] = set()
    if any(token in text for token in ("citygml", "lod2", ".gml")):
        formats.add("CityGML")
    if any(token in text for token in ("3dtiles", ".b3dm")):
        formats.add("3D Tiles")
    if any(token in text for token in ("dgm5xyz", ".xyz", "terrain", "digital elevation", "dem")):
        formats.add("XYZ")
    if any(token in text for token in ("geotiff", ".tiff", ".tif")):
        formats.add("GeoTIFF")
    if any(token in text for token in ("geojson", ".geojson")):
        formats.add("GeoJSON")
    if any(token in text for token in ("geopackage", ".gpkg")):
        formats.add("GeoPackage")
    if any(token in text for token in ("shapefile", ".shp")):
        formats.add("Shapefile")
    return formats


def _active_files_completed(jobs: list[dict]) -> int:
    values: list[int] = []

    def visit(candidate):
        if isinstance(candidate, dict):
            for key, value in candidate.items():
                if str(key).casefold() == "files_completed":
                    parsed = _optional_int(value)
                    if parsed is not None:
                        values.append(parsed)
                else:
                    visit(value)
        elif isinstance(candidate, list):
            for item in candidate:
                visit(item)

    for job in jobs:
        visit(job)
    return max(values, default=0)


def _defer_to_existing_partial(
    release: dict,
    *,
    active: bool,
    current_release_key: str,
    current_artifact_count: int | None = None,
) -> dict | None:
    if release.get("partial") is not True:
        return None
    dataset_id = str(release.get("dataset_id") or "")
    release_key = str(release.get("release_key") or "")
    if not dataset_id or not release_key:
        return None
    publication = _get_geoserver_publication(dataset_id, release_key)
    if publication is None:
        return None
    status = str(publication.get("status") or "").upper()
    if status in {"ERROR", "FAILED"}:
        return None
    if str(publication.get("storage_mode") or "").casefold() != "reference":
        return None
    previous_count = int(release.get("artifact_count") or 0)
    if (
        active
        and current_artifact_count is not None
        and current_artifact_count < previous_count + 100
    ):
        return publication
    if release_key != current_release_key:
        return None
    if active:
        return publication
    if status in {"QUEUED", "RUNNING", "DOWNLOADING", "RETRY_WAIT"}:
        return publication
    return None


def _refresh_existing_release(
    project: Project,
    release: dict,
    publication: dict,
) -> dict:
    release = dict(release)
    release.update(
        {
            "integration_status": str(
                publication.get("status") or "queued"
            ).upper(),
            "publication": publication,
            "updated_at": (
                publication.get("updated_at")
                or datetime.now(timezone.utc).isoformat()
            ),
            "last_error": publication.get("error"),
        }
    )
    metadata = dict(project.metadata_json or {})
    metadata["production_release"] = release
    project.metadata_json = metadata
    db.session.commit()
    return {
        "project": project.to_dict(),
        "publication": publication,
        "kind": release.get("kind"),
        "partial": True,
        "status": "partial_release_active",
    }


def _get_geoserver_publication(
    dataset_id: str,
    release_key: str,
) -> dict | None:
    base_url = str(current_app.config["GEOSERVER_ORCHESTRATOR_URL"]).rstrip("/")
    service_token = str(
        current_app.config.get("GEOSERVER_PUBLICATION_SERVICE_TOKEN") or ""
    ).strip()
    if not service_token:
        return None
    try:
        response = requests.get(
            f"{base_url}/admin/api/production-publications/{quote(dataset_id)}",
            params={"release_key": release_key},
            headers={
                "Accept": "application/json",
                "X-Vectoplan-Service-Token": service_token,
            },
            timeout=current_app.config[
                "GEOSERVER_PUBLICATION_TIMEOUT_SECONDS"
            ],
        )
    except requests.RequestException as exc:
        raise DashboardError(
            "GEOSERVER_ORCHESTRATOR_UNAVAILABLE",
            "Der GeoServer-Orchestrator ist fuer die Produktionsfreigabe nicht erreichbar.",
            503,
        ) from exc
    if response.status_code == 404:
        return None
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code >= 400:
        raise DashboardError(
            "GEOSERVER_PUBLICATION_STATUS_FAILED",
            str(
                body.get("message")
                or body.get("detail")
                or f"GeoServer antwortete mit HTTP {response.status_code}."
            ),
            502 if response.status_code >= 500 else response.status_code,
        )
    publication = dict(body.get("publication") or body)
    public_base = str(
        current_app.config["GEOSERVER_ORCHESTRATOR_PUBLIC_URL"]
    ).rstrip("/")
    publication.setdefault("admin_url", f"{public_base}/admin")
    return publication


def _project_geospatial_formats(tasks: list[LlmTask]) -> set[str]:
    formats: set[str] = set()
    for task in tasks:
        if task.status != "COMPLETED":
            continue
        candidate = dict((task.input_payload or {}).get("candidate") or {})
        input_metrics = dict(candidate.get("metrics") or {})
        output_metrics = dict((task.output_payload or {}).get("metrics") or {})
        for value in [
            *(task.input_payload or {}).get("geospatial_formats", []),
            *input_metrics.get("geospatial_formats", []),
            *output_metrics.get("geospatial_formats", []),
        ]:
            normalized = str(value or "").strip()
            if normalized:
                formats.add(normalized)
    return formats


def _expand_artifact_manifests(
    artifacts: list[dict], *, max_artifacts: int
) -> list[dict]:
    expanded: list[dict] = []
    seen: set[str] = set()
    for artifact in artifacts:
        if artifact.get("kind") != "artifact_manifest":
            _validate_artifact_integrity(artifact)
            storage_ref = str(artifact.get("ref") or "")
            if storage_ref and storage_ref not in seen:
                seen.add(storage_ref)
                expanded.append(artifact)
            continue
        for candidate in read_artifact_manifest(
            str(artifact.get("ref") or ""),
            max_artifacts=max_artifacts,
        ):
            normalized = {
                "kind": "artifact",
                "ref": candidate.get("storage_uri"),
                "sha256": candidate.get("sha256"),
                "size_bytes": candidate.get("size_bytes"),
                "media_type": candidate.get("detected_media_type")
                or candidate.get("declared_media_type")
                or "application/octet-stream",
                "metadata": {
                    "original_url": candidate.get("original_url"),
                    "final_url": candidate.get("final_url"),
                    "malware_status": candidate.get("malware_status"),
                    "format_status": candidate.get("format_status"),
                    "response_status": candidate.get("response_status"),
                },
            }
            _validate_artifact_integrity(normalized)
            storage_ref = str(normalized.get("ref") or "")
            if storage_ref and storage_ref not in seen:
                seen.add(storage_ref)
                expanded.append(normalized)
    return expanded


def _validate_artifact_integrity(artifact: dict) -> None:
    metadata = artifact.get("metadata") if isinstance(artifact.get("metadata"), dict) else {}
    malware = str(metadata.get("malware_status") or "").upper()
    format_status = str(metadata.get("format_status") or "").upper()
    if malware == "INFECTED":
        raise DashboardError(
            "PRODUCTION_ARTIFACT_UNSAFE",
            "Mindestens eine Datendatei wurde als schadhaft erkannt und kann nicht ver\u00f6ffentlicht werden.",
            422,
        )
    if format_status == "MISMATCH":
        raise DashboardError(
            "PRODUCTION_ARTIFACT_FORMAT_MISMATCH",
            "Mindestens eine Datendatei stimmt nicht mit ihrem angegebenen Dateiformat \u00fcberein.",
            422,
        )


def _is_wfs_artifact(artifact: dict) -> bool:
    media_type = str(artifact.get("media_type") or "").split(";", 1)[0].lower()
    return media_type in WFS_MEDIA_TYPES or Path(_source_name(artifact)).suffix.lower() in WFS_EXTENSIONS


def _publication_profile(
    detected_formats: set[str],
    artifacts: list[dict],
    is_georeferenced: bool,
) -> str:
    if artifacts and all(
        urlsplit(str((item.get("metadata") or {}).get("original_url") or "")).hostname == "gdi.berlin.de"
        and "/data/dgm1/" in str((item.get("metadata") or {}).get("original_url") or "")
        for item in artifacts
    ):
        return "terrain"
    format_tokens = {
        "".join(character for character in str(value).casefold() if character.isalnum())
        for value in detected_formats
    }
    suffixes = {Path(_source_name(item)).suffix.lower() for item in artifacts}
    if format_tokens & RASTER_FORMAT_TOKENS or suffixes & RASTER_EXTENSIONS:
        return "raster"
    if format_tokens & CITY_MODEL_FORMAT_TOKENS or suffixes & CITY_MODEL_EXTENSIONS:
        return "city_model"
    if is_georeferenced and artifacts and all(_is_wfs_artifact(item) for item in artifacts):
        return "vector"
    if is_georeferenced:
        return "geodata_files"
    if suffixes & {".csv", ".json", ".jsonl", ".ndjson", ".tsv"}:
        return "tabular"
    return "files"


def _project_assessments(project_id: str, campaign_ids: set[str]) -> list[LlmTask]:
    tasks = LlmTask.query.filter(
        LlmTask.task_type == "DATA_PREPARATION_REVIEW",
        LlmTask.campaign_id.in_(campaign_ids),
    ).all()
    return [
        item
        for item in tasks
        if str((item.input_payload or {}).get("project_id") or project_id) == project_id
    ]


def _task_is_georeferenced(task: LlmTask) -> bool:
    output = dict(task.output_payload or {})
    preparation = dict(output.get("preparation") or {})
    if "georeferencing_detected" in preparation:
        return bool(preparation.get("georeferencing_detected"))
    metrics = dict(dict((task.input_payload or {}).get("candidate") or {}).get("metrics") or {})
    return bool(metrics.get("georeferencing_detected"))


def _collect_artifacts(runs: list[dict]) -> list[dict]:
    result: list[dict] = []
    seen: set[str] = set()
    for run in runs:
        if str(run.get("status") or "").upper() not in {"COMPLETED", "SUCCEEDED"}:
            continue
        for step in run.get("steps") or []:
            for reference in step.get("output_references") or []:
                if not isinstance(reference, dict):
                    continue
                storage_ref = str(reference.get("ref") or "")
                if (
                    reference.get("kind") == "execution_metadata"
                    or not storage_ref.startswith("s3://")
                    or storage_ref in seen
                ):
                    continue
                seen.add(storage_ref)
                result.append(reference)
    return result


def _is_geospatial_artifact(artifact: dict) -> bool:
    media_type = str(artifact.get("media_type") or "").split(";", 1)[0].lower()
    return (
        media_type in GEO_MEDIA_TYPES
        or Path(_source_name(artifact)).suffix.lower() in GEO_EXTENSIONS
    )


def _is_strong_geospatial_artifact(artifact: dict) -> bool:
    media_type = str(artifact.get("media_type") or "").split(";", 1)[0].lower()
    return (
        media_type in GEO_MEDIA_TYPES
        or Path(_source_name(artifact)).suffix.lower() in {".geojson", ".gpkg", ".kml", ".gml"}
    )


def _source_name(artifact: dict) -> str:
    metadata = artifact.get("metadata") if isinstance(artifact.get("metadata"), dict) else {}
    source_name = secure_filename(str(metadata.get("source_name") or ""))
    if source_name:
        return source_name
    source_url = str(metadata.get("original_url") or metadata.get("final_url") or "")
    return Path(unquote(urlsplit(source_url).path)).name


def _artifact_name(artifact: dict, index: int) -> str:
    media_type = str(artifact.get("media_type") or "").split(";", 1)[0].lower()
    source_name = secure_filename(_source_name(artifact))
    suffix = Path(source_name).suffix.lower()
    if not source_name:
        source_name = f"artifact-{index}"
    if not suffix:
        source_name += MEDIA_EXTENSIONS.get(media_type, ".bin")
    digest = str(artifact.get("sha256") or "").lower()
    if digest:
        path = Path(source_name)
        source_name = f"{path.stem}-{digest[:10]}{path.suffix}"
    return secure_filename(source_name) or f"artifact-{index}.bin"


def reconcile_released_projects(limit: int = 50) -> dict[str, int]:
    """Refresh published projects and create a new release after newer successful runs."""
    summary = {"checked": 0, "updated": 0, "waiting": 0, "failed": 0}
    projects = (
        Project.query.filter_by(status="ACTIVE")
        .order_by(Project.updated_at.asc())
        .limit(max(1, int(limit)))
        .all()
    )
    for project in projects:
        release = dict((project.metadata_json or {}).get("production_release") or {})
        if release.get("eligible") is not True or release.get("auto_update") is False:
            continue
        summary["checked"] += 1
        try:
            release_project(project.id)
            summary["updated"] += 1
        except DashboardError as exc:
            waiting = exc.code in {
                "PROJECT_PREPARATION_PENDING",
                "PROJECT_HAS_NO_SUCCESSFUL_DATA",
            }
            _record_release_error(project, exc, waiting=waiting)
            summary["waiting" if waiting else "failed"] += 1
        except Exception as exc:
            LOGGER.exception("Automatic production release failed for project %s", project.id)
            _record_release_error(
                project,
                DashboardError(
                    "PRODUCTION_RELEASE_RECONCILIATION_FAILED",
                    f"Die automatische Produktionsaktualisierung ist fehlgeschlagen: {exc}",
                    500,
                ),
                waiting=False,
            )
            summary["failed"] += 1
    return summary


def _record_release_error(project: Project, error: DashboardError, *, waiting: bool) -> None:
    metadata = dict(project.metadata_json or {})
    release = dict(metadata.get("production_release") or {})
    status = "WAITING_FOR_DATA" if waiting else "ERROR"
    if release.get("integration_status") == status and release.get("last_error") == error.detail:
        return
    release.update(
        {
            "eligible": True,
            "auto_update": True,
            "integration_status": status,
            "last_error": error.detail,
            "last_error_code": error.code,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    metadata["production_release"] = release
    project.metadata_json = metadata
    db.session.add(
        AuditEvent(
            action="project.production_release_sync_failed",
            resource_type="Project",
            resource_id=project.id,
            details={"code": error.code, "waiting": waiting},
        )
    )
    db.session.commit()


def _publish_to_geoserver(payload: dict) -> dict:
    base_url = str(current_app.config["GEOSERVER_ORCHESTRATOR_URL"]).rstrip("/")
    service_token = str(
        current_app.config.get("GEOSERVER_PUBLICATION_SERVICE_TOKEN") or ""
    ).strip()
    if not service_token:
        raise DashboardError(
            "GEOSERVER_PUBLICATION_NOT_CONFIGURED",
            "Die sichere Verbindung zum GeoServer-Orchestrator ist nicht konfiguriert.",
            503,
        )
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "fetch",
        "Idempotency-Key": f"project-release-{payload['release_key']}",
        "X-Vectoplan-Service-Token": service_token,
    }
    for name in (("Cookie", "User-Agent", "X-Request-ID", "X-Correlation-ID") if has_request_context() else ()):
        value = request.headers.get(name)
        if value:
            headers[name] = value
    try:
        response = requests.post(
            f"{base_url}/admin/api/production-publications",
            json=payload,
            headers=headers,
            timeout=current_app.config["GEOSERVER_PUBLICATION_TIMEOUT_SECONDS"],
        )
    except requests.RequestException as exc:
        raise DashboardError(
            "GEOSERVER_ORCHESTRATOR_UNAVAILABLE",
            "Der GeoServer-Orchestrator ist für die Produktionsfreigabe nicht erreichbar.",
            503,
        ) from exc
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code >= 400:
        raise DashboardError(
            "GEOSERVER_PUBLICATION_FAILED",
            str(body.get("message") or body.get("detail") or f"GeoServer antwortete mit HTTP {response.status_code}."),
            502 if response.status_code >= 500 else response.status_code,
        )
    publication = dict(body.get("publication") or body)
    public_base = str(current_app.config["GEOSERVER_ORCHESTRATOR_PUBLIC_URL"]).rstrip("/")
    publication.setdefault("admin_url", f"{public_base}/admin")
    dataset_id = str(publication.get("dataset_id") or "")
    if dataset_id:
        publication.setdefault(
            "collection_url",
            f"{public_base}/admin/api/production-publications/{quote(dataset_id)}",
        )
    for item in publication.get("files") or []:
        download_url = str(item.get("download_url") or "")
        if download_url.startswith("/"):
            item["download_url"] = f"{public_base}{download_url}"
    return publication


def _optional_int(value) -> int | None:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None
