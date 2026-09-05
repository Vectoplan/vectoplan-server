from __future__ import annotations

from array import array
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from csv import DictReader
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from threading import RLock, Thread
from typing import Any, Dict, Iterable, Iterator, Optional, Type
from urllib.parse import urlsplit, quote, urlparse
from uuid import uuid4
from zipfile import BadZipFile, ZipFile
import io
import gzip
import json
import math
import os
import re
import struct
import sys
import xml.etree.ElementTree as ET

import requests
from werkzeug.utils import secure_filename

from config import BaseConfig, Config
from models import IngestionJob
from src.geodata_formats import (
  CITY_MODEL_EXTENSIONS,
  RASTER_EXTENSIONS,
  SUPPORTED_UPLOAD_EXTENSIONS,
  TABULAR_EXTENSIONS,
  format_descriptor,
  publication_profile,
)
from src.ingestion.metalink import verify_checksum
from src.ingestion.service import IngestionService
from src.publications.raster_service import RasterPublicationError, RasterPublicationService
from src.semantic import inspect_citygml, is_citygml


_PUBLICATION_LOCK = RLock()
_REFERENCE_CACHE_LOCK = RLock()
_REFERENCE_BYTES_CACHE: OrderedDict[str, bytes] = OrderedDict()
_REFERENCE_BYTES_CACHE_SIZE = 0
_REFERENCE_KEY_LOCKS: Dict[str, RLock] = {}
_XYZ_TILE_CACHE_LOCK = RLock()
_XYZ_TILE_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_XYZ_TILE_KEY_LOCKS: Dict[str, RLock] = {}
_TERRAIN_SERVING_CACHE_LOCK = RLock()
_TERRAIN_SERVING_TILE_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_TERRAIN_SERVING_TILE_LOCKS: Dict[str, RLock] = {}
_TERRAIN_SERVING_JOBS_LOCK = RLock()
_TERRAIN_SERVING_JOBS: set[str] = set()
_TERRAIN_SERVING_SCHEMA = 'vectoplan-terrain-serving.v1'
_TERRAIN_SERVING_TILE_SCHEMA = 'vectoplan-terrain-serving-tile.v1'
_TERRAIN_SERVING_MAGIC = b'VPT1'
_TERRAIN_NODATA = -(2 ** 31)
_TERRAIN_VALUE_SCALE = 0.01
_TERRAIN_FIXED_DATASET = 'digitales-gelaendemodell-5m'
_METALINK_NAMESPACE = "urn:ietf:params:xml:ns:metalink"
_QUERYABLE_EXTENSIONS = {".csv", ".tsv", ".json", ".jsonl", ".ndjson"}
_WFS_EXTENSIONS = {".csv", ".fgb", ".geojson", ".gml", ".gpkg", ".json", ".kml", ".parquet", ".shp", ".sqlite", ".zip"}
_WFS_MEDIA_TYPES = {
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
_WFS_FORMATS = {"csv", "flatgeobuf", "geojson", "geopackage", "gml", "kml", "parquet", "shapefile", "sqlite"}


class ProductionPublicationError(ValueError):
  def __init__(self, message: str, *, status_code: int = 422, code: str = "invalid_publication"):
    super().__init__(message)
    self.status_code = status_code
    self.code = code


class ProductionPublicationService:
  def __init__(
    self,
    config_cls: Type[BaseConfig] = Config,
    *,
    ingestion_service: Optional[IngestionService] = None,
    http: Optional[requests.Session] = None,
  ) -> None:
    self.config_cls = config_cls
    self.ingestion = ingestion_service or IngestionService(config_cls=config_cls)
    self.http = http or requests.Session()
    self.root = Path(config_cls.UPLOAD_ROOT_DIR) / ".production-publications"
    self.non_spatial_root = self.root / "non-spatial"
    self.geospatial_root = self.root / "geospatial"

  def publish(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = self._validated_payload(payload)
    if normalized["kind"] == "geospatial":
      return self._publish_geospatial(normalized)
    return self._publish_non_spatial(normalized)

  def register_local_collection(
    self,
    dataset_id: str,
    *,
    project_name: str = "",
    changed_path: str = "",
    changed_sha256: str = "",
  ) -> Dict[str, Any]:
    """Publish local uploads by reference without creating a second byte copy."""
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    dataset_root = Path(self.config_cls.UPLOAD_ROOT_DIR) / normalized
    dataset_root = dataset_root.resolve(strict=False)
    upload_root = Path(self.config_cls.UPLOAD_ROOT_DIR).resolve(strict=False)
    try:
      dataset_root.relative_to(upload_root)
    except ValueError as exc:
      raise ProductionPublicationError("Der lokale Projektpfad ist ungueltig.") from exc

    candidates = [
      path
      for path in dataset_root.rglob("*")
      if path.is_file()
      and path.suffix.lower() in SUPPORTED_UPLOAD_EXTENSIONS
      and ".incoming" not in path.parts
      and ".production-publications" not in path.parts
      and str(getattr(self.config_cls, "DATASET_STATE_DIRNAME", "state")) not in path.parts
      and str(getattr(self.config_cls, "DATASET_EXPORTS_DIRNAME", "exports")) not in path.parts
      and path.name.lower() not in {
        str(getattr(self.config_cls, "MANIFEST_FILENAME", "manifest.json")).lower(),
        str(getattr(self.config_cls, "STYLE_FILENAME", "style.json")).lower(),
        "style.sld",
      }
    ]
    if not candidates:
      raise ProductionPublicationError(
        "Im Projekt sind noch keine bereitstellbaren Dateien vorhanden.",
        code="local_collection_empty",
      )

    fingerprints = []
    files = []
    profiles = set()
    descriptors: list[dict[str, Any]] = []
    existing_record = self._read_json(
      self.non_spatial_root / normalized / "publication.json"
    ) or {}
    existing_files = {
      str(item.get("local_path") or ""): item
      for item in (existing_record.get("files") or [])
      if isinstance(item, dict) and item.get("local_path")
    }
    normalized_changed_path = (
      Path(changed_path).resolve(strict=False).as_posix()
      if str(changed_path or "").strip()
      else ""
    )
    for path in sorted(candidates, key=lambda item: item.as_posix().casefold()):
      stat = path.stat()
      relative = path.relative_to(dataset_root).as_posix()
      extension = path.suffix.lower()
      citygml_source = is_citygml(path)
      descriptor = format_descriptor("source.citygml" if citygml_source else path.name)
      nested_descriptors: list[dict[str, Any]] = []
      if extension == ".zip":
        try:
          with ZipFile(path) as archive:
            nested_descriptors = [
              format_descriptor(name)
              for name in archive.namelist()
              if name and not name.endswith("/")
              and Path(name).suffix.lower() in SUPPORTED_UPLOAD_EXTENSIONS
            ]
          profiles.update(
            item["publication_profile"] for item in nested_descriptors
          )
          if not nested_descriptors:
            profiles.add("geodata_files")
        except BadZipFile:
          profiles.add("geodata_files")
      else:
        profiles.add(descriptor["publication_profile"])
      descriptors.extend(nested_descriptors or [descriptor])
      path_key = path.resolve(strict=False).as_posix()
      previous = existing_files.get(path_key) or {}
      digest = (
        str(changed_sha256 or "").lower()
        if path_key == normalized_changed_path and changed_sha256
        else str(previous.get("sha256") or "").lower()
        if normalized_changed_path and path_key != normalized_changed_path and int(previous.get("size_bytes") or -1) == stat.st_size
        else ""
      )
      if not digest:
        digest = self._sha256_path(path)
      semantic_inspection = (
        previous.get("semantic_inspection")
        if str(previous.get("sha256") or "").casefold() == digest.casefold()
        else None
      )
      if not semantic_inspection and citygml_source:
        semantic_inspection = inspect_citygml(path)
      fingerprints.append(f"{relative}|{digest}")
      files.append(
        {
          "name": relative,
          "url": None,
          "local_path": path.as_posix(),
          "stored_path": None,
          "size_bytes": stat.st_size,
          "downloaded_bytes": stat.st_size,
          "sha256": digest,
          "media_type": "application/octet-stream",
          "queryable": extension in _QUERYABLE_EXTENSIONS and path.name.casefold() != "tileset.json",
          "format": descriptor["format"],
          "data_class": descriptor["data_class"],
          "role": descriptor["role"],
          "storage_plan": {
            "raw": descriptor["raw_storage"],
            "normalized": descriptor["normalized_targets"],
            "http_range_ready": descriptor["http_range_ready"],
          },
          "contained_formats": sorted({item["format"] for item in nested_descriptors}),
          "semantic_inspection": semantic_inspection,
        }
      )

    if profiles <= {"tabular"}:
      profile = "tabular"
      kind = "non_spatial"
    elif len(profiles) == 1:
      profile = next(iter(profiles))
      kind = "file_collection"
    else:
      profile = "mixed_geodata"
      kind = "file_collection"
    release_key = sha256("|".join(fingerprints).encode("utf-8")).hexdigest()
    publication_dir = self.non_spatial_root / normalized
    record_path = publication_dir / "publication.json"
    existing = self._read_json(record_path)
    same_release = bool(existing and existing.get("release_key") == release_key)
    now = self._now()
    record = {
      "release_key": release_key,
      "project_id": normalized,
      "project_name": str(project_name or "").strip() or normalized,
      "dataset_id": normalized,
      "kind": kind,
      "publication_profile": profile,
      "source_partial": False,
      "source_files_completed": len(files),
      "delivery_services": ["QUERY", "DOWNLOAD"] if kind == "non_spatial" else ["DOWNLOAD"],
      "artifacts": files,
      "files": files,
      "detected_formats": sorted({item["format"] for item in descriptors}),
      "format_capabilities": [
        {"format": format_name, "data_class": data_class, "role": role}
        for format_name, data_class, role in sorted(
          {
            (item["format"], item["data_class"], item["role"])
            for item in descriptors
          }
        )
      ],
      "normalization_plan": {
        "state": "planned",
        "preserve_originals": True,
        "targets": sorted(
          {target for item in descriptors for target in item["normalized_targets"]}
        ),
        "streaming_priority": ["3D Tiles 1.1", "COPC.LAZ", "COG GeoTIFF"],
      },
      "assessment_ids": [],
      "status": "published",
      "storage_mode": "local-reference",
      "created_at": existing.get("created_at") if same_release else now,
      "updated_at": now,
      "published_at": existing.get("published_at") if same_release else now,
      "error": None,
      "urls": dict(existing.get("urls") or {}) if same_release else {},
    }
    self._atomic_write_json(record_path, record)
    approval = self._read_json(self._approval_path(publication_dir))
    if approval and approval.get("release_key") == release_key:
      self._atomic_write_json(self._approved_snapshot_path(publication_dir), deepcopy(record))
    return self._public_record(record, approval=approval)
  def get_publication(self, dataset_id: str, *, release_key: str = "") -> Dict[str, Any]:
    """Return the latest persisted publication and refresh geospatial job state."""
    normalized_dataset_id = self.config_cls.sanitize_dataset_id(dataset_id)
    normalized_release_key = str(release_key or "").strip().lower()
    if normalized_release_key and (
      len(normalized_release_key) != 64
      or any(char not in "0123456789abcdef" for char in normalized_release_key)
    ):
      raise ProductionPublicationError(
        "Der Release-Schl?ssel ist ung?ltig.",
        status_code=422,
        code="invalid_release_key",
      )

    geospatial_dir = self.geospatial_root / normalized_dataset_id
    candidates = (
      [geospatial_dir / f"{normalized_release_key}.json"]
      if normalized_release_key
      else sorted(
        geospatial_dir.glob("*.json") if geospatial_dir.exists() else [],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
      )
    )
    for record_path in candidates:
      record = self._read_json(record_path)
      if record:
        return self._refresh_geospatial_record(record, record_path=record_path)

    non_spatial = self._read_json(
      self.non_spatial_root / normalized_dataset_id / "publication.json"
    )
    if non_spatial and (
      not normalized_release_key or non_spatial.get("release_key") == normalized_release_key
    ):
      return self._public_record(non_spatial)
    raise ProductionPublicationError(
      "Die Produktionsfreigabe wurde nicht gefunden.",
      status_code=404,
      code="production_publication_not_found",
    )


  def _validated_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
      raise ProductionPublicationError("Der Veröffentlichungsauftrag muss ein JSON-Objekt sein.")
    project_id = str(payload.get("project_id") or "").strip()
    project_name = str(payload.get("project_name") or "").strip()
    release_key = str(payload.get("release_key") or "").strip().lower()
    kind = str(payload.get("kind") or "").strip().lower()
    if not project_id or not project_name:
      raise ProductionPublicationError("Projekt-ID und Projektname sind erforderlich.")
    if len(release_key) != 64 or any(char not in "0123456789abcdef" for char in release_key):
      raise ProductionPublicationError("Der Release-Schlüssel ist ungültig.")
    if kind not in {"geospatial", "file_collection", "non_spatial"}:
      raise ProductionPublicationError("kind muss geospatial, file_collection oder non_spatial sein.")
    raw_artifacts = payload.get("artifacts")
    if not isinstance(raw_artifacts, list) or not raw_artifacts:
      raise ProductionPublicationError("Mindestens ein Artefakt ist erforderlich.")
    if len(raw_artifacts) > 100_000:
      raise ProductionPublicationError("Ein Release darf höchstens 100.000 Artefakte enthalten.")

    artifacts = []
    used_names: set[str] = set()
    for index, item in enumerate(raw_artifacts, start=1):
      if not isinstance(item, dict):
        raise ProductionPublicationError(f"Artefakt {index} ist ungültig.")
      raw_name = secure_filename(Path(str(item.get("name") or "")).name)
      if not raw_name:
        raw_name = f"artifact-{index}.bin"
      name = self._unique_name(raw_name, used_names)
      url = str(item.get("url") or "").strip()
      self._validate_source_url(url)
      size_bytes = self._optional_nonnegative_int(item.get("size_bytes"))
      checksum = str(item.get("sha256") or "").strip().lower()
      if checksum and (len(checksum) != 64 or any(char not in "0123456789abcdef" for char in checksum)):
        raise ProductionPublicationError(f"Die SHA-256-Prüfsumme für {name} ist ungültig.")
      artifacts.append(
        {
          "name": name,
          "url": url,
          "source_url": str(item.get("source_url") or ""),
          "size_bytes": size_bytes,
          "sha256": checksum or None,
          "media_type": str(item.get("media_type") or "application/octet-stream"),
        }
      )
    publication_profile = str(payload.get("publication_profile") or "").strip().lower()
    if not publication_profile:
      publication_profile = (
        "vector"
        if kind == "geospatial"
        else "tabular"
        if kind == "non_spatial"
        else "files"
      )
    allowed_profiles = {
      "city_model",
      "files",
      "geodata_files",
      "mixed_geodata",
      "raster",
      "tabular",
      "terrain",
      "vector",
    }
    if publication_profile not in allowed_profiles:
      raise ProductionPublicationError(
        "Das Bereitstellungsprofil ist ung\u00fcltig.",
        code="invalid_publication_profile",
      )
    detected_formats = sorted(
      {
        str(value).strip()
        for value in (payload.get("detected_formats") or [])
        if str(value or "").strip()
      }
    )
    if kind == "geospatial":
      normalized_formats = {value.casefold() for value in detected_formats}
      if normalized_formats and not (normalized_formats & _WFS_FORMATS):
        raise ProductionPublicationError(
          "Der Datensatz ist georeferenziert, enth\u00e4lt aber kein WFS-kompatibles Vektorformat.",
          status_code=422,
          code="dataset_not_wfs_compatible",
        )
      incompatible = [
        item["name"]
        for item in artifacts
        if (
          Path(item["name"]).suffix.lower() not in _WFS_EXTENSIONS
          and str(item.get("media_type") or "").split(";", 1)[0].lower()
          not in _WFS_MEDIA_TYPES
        )
      ]
      if incompatible:
        raise ProductionPublicationError(
          "Nicht WFS-kompatible Artefakte: " + ", ".join(incompatible[:10]),
          status_code=422,
          code="unsupported_wfs_artifact",
        )

    delivery_services = {
      "vector": ["WFS", "WMS"],
      "tabular": ["QUERY", "DOWNLOAD"],
      "raster": ["DOWNLOAD"],
      "terrain": ["DOWNLOAD"],
      "city_model": ["DOWNLOAD"],
      "geodata_files": ["DOWNLOAD"],
      "mixed_geodata": ["DOWNLOAD"],
      "files": ["DOWNLOAD"],
    }[publication_profile]
    dataset_id = self.config_cls.sanitize_dataset_id(payload.get("dataset_id") or project_name)
    return {
      "release_key": release_key,
      "project_id": project_id,
      "project_name": project_name,
      "dataset_id": dataset_id,
      "kind": kind,
      "publication_profile": publication_profile,
      "source_partial": bool(payload.get("partial")),
      "source_files_completed": self._optional_nonnegative_int(
        payload.get("source_files_completed")),
      "delivery_services": delivery_services,
      "artifacts": artifacts,
      "detected_formats": detected_formats,
      "assessment_ids": [
        str(value)
        for value in (payload.get("assessment_ids") or [])
        if str(value or "").strip()
      ][:1000],
    }

  def _validate_source_url(self, value: str) -> None:
    parsed = urlparse(value)
    allowed_hosts = {
      str(item).strip().lower()
      for item in getattr(
        self.config_cls,
        "PRODUCTION_PUBLICATION_ALLOWED_SOURCE_HOSTS",
        ("host.docker.internal", "127.0.0.1", "localhost"),
      )
      if str(item).strip()
    }
    if (
      parsed.scheme not in {"http", "https"}
      or not parsed.hostname
      or parsed.hostname.lower() not in allowed_hosts
      or not parsed.path.startswith("/api/internal/publications/artifacts/")
    ):
      raise ProductionPublicationError(
        "Artefakt-URLs müssen signierte Vectoplan-Übergabe-URLs von einem freigegebenen Host sein."
      )

  def _publish_geospatial(self, publication: Dict[str, Any]) -> Dict[str, Any]:
    record_path = self.geospatial_root / publication["dataset_id"] / f'{publication["release_key"]}.json'
    with _PUBLICATION_LOCK:
      existing = self._read_json(record_path)
      if existing:
        return self._refresh_geospatial_record(
          existing,
          record_path=record_path,
          retry_failed=True,
        )

      topic_dir = Path(self.config_cls.UPLOAD_ROOT_DIR) / publication["dataset_id"]
      topic_dir.mkdir(parents=True, exist_ok=True)
      metalink_path = topic_dir / f'production-{publication["release_key"][:20]}.meta4'
      self._write_metalink(metalink_path, publication)
      job = self.ingestion.enqueue_file(topic=publication["dataset_id"], path=metalink_path)
      if job is None:
        raise ProductionPublicationError(
          "Der Geo-Import konnte nicht eingeplant werden.",
          status_code=409,
          code="geospatial_publication_exists",
        )
      now = self._now()
      record = {
        **publication,
        "status": str(job.status),
        "job_id": job.id,
        "job_uuid": job.uuid,
        "progress_percent": float(job.progress_percent or 0.0),
        "error": None,
        "created_at": now,
        "updated_at": now,
      }
      self._atomic_write_json(record_path, record)
      return self._public_record(record)

  def _refresh_geospatial_record(
    self,
    record: Dict[str, Any],
    *,
    record_path: Optional[Path] = None,
    retry_failed: bool = False,
  ) -> Dict[str, Any]:
    job_uuid = str(record.get("job_uuid") or "")
    if job_uuid:
      job = IngestionJob.query.filter_by(uuid=job_uuid).first()
      if job is not None:
        if str(job.status) == "failed" and retry_failed:
          job = self.ingestion.retry_job(job.id)
        status = str(job.status)
        urls = self._publication_urls(job)
        record["status"] = "published" if status == "completed" and urls.get("wfs_url") else status
        record["progress_percent"] = float(job.progress_percent or 0.0)
        record["error"] = job.last_error or None
        record["updated_at"] = self._now()
        if status == "completed":
          job_payload = job.to_dict(
            include_artifacts=False,
            include_checkpoint=False,
            include_result=False,
          )
          record["published_at"] = job_payload.get("finished_at") or record["updated_at"]
          if urls:
            record["urls"] = urls
            record["wfs_url"] = urls.get("wfs_url")
          if not urls.get("wfs_url"):
            record["error"] = (
              "Der GeoServer-Import wurde abgeschlossen, aber es wurde kein WFS-Link erzeugt."
            )
        if record_path is not None:
          self._atomic_write_json(record_path, record)
    return self._public_record(record)
  @staticmethod
  def _publication_urls(job: IngestionJob) -> Dict[str, Any]:
    result = dict(job.result_payload or {})
    sync = dict(result.get("sync") or {})
    catalog_entry = dict(sync.get("catalog_entry") or {})
    urls = dict(catalog_entry.get("urls") or {})
    published_state = dict(sync.get("published_state_summary") or {})
    for key in (
      "wfs_url",
      "capabilities_url",
      "describe_feature_type_url",
      "catalog_url",
      "style_url",
      "sync_url",
    ):
      value = published_state.get(key)
      if key not in urls and value:
        urls[key] = value
    return urls

  def _write_metalink(self, path: Path, publication: Dict[str, Any]) -> None:
    ET.register_namespace("", _METALINK_NAMESPACE)
    root = ET.Element(f"{{{_METALINK_NAMESPACE}}}metalink")
    ET.SubElement(root, f"{{{_METALINK_NAMESPACE}}}identity").text = publication["dataset_id"]
    ET.SubElement(root, f"{{{_METALINK_NAMESPACE}}}description").text = (
      f'Produktionsfreigabe aus Projekt {publication["project_name"]}'
    )
    for artifact in publication["artifacts"]:
      file_node = ET.SubElement(
        root,
        f"{{{_METALINK_NAMESPACE}}}file",
        {"name": artifact["name"]},
      )
      if artifact.get("size_bytes") is not None:
        ET.SubElement(file_node, f"{{{_METALINK_NAMESPACE}}}size").text = str(artifact["size_bytes"])
      if artifact.get("sha256"):
        ET.SubElement(
          file_node,
          f"{{{_METALINK_NAMESPACE}}}hash",
          {"type": "sha-256"},
        ).text = artifact["sha256"]
      ET.SubElement(
        file_node,
        f"{{{_METALINK_NAMESPACE}}}url",
        {"priority": "1"},
      ).text = artifact["url"]
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    ET.ElementTree(root).write(temporary, encoding="utf-8", xml_declaration=True)
    temporary.replace(path)

  def _publish_non_spatial(self, publication: Dict[str, Any]) -> Dict[str, Any]:
    publication_dir = self.non_spatial_root / publication["dataset_id"]
    record_path = publication_dir / "publication.json"
    with _PUBLICATION_LOCK:
      existing = self._read_json(record_path)
      same_release = bool(existing and existing.get("release_key") == publication["release_key"])
      now = self._now()
      existing_urls = dict(existing.get("urls") or {}) if same_release else {}
      record = {
        **publication,
        # Raw bytes remain canonical in the scraper object store.
        "status": "published",
        "storage_mode": "reference",
        "created_at": existing.get("created_at") if same_release else now,
        "updated_at": now,
        "published_at": (
          existing.get("published_at") if same_release else now
        ) or now,
        "error": None,
        "urls": existing_urls,
        "files": [
          {
            **artifact,
            "stored_path": None,
            "downloaded_bytes": artifact.get("size_bytes") or 0,
            "queryable": Path(artifact["name"]).suffix.lower() in _QUERYABLE_EXTENSIONS,
          }
          for artifact in publication["artifacts"]
        ],
      }
      self._atomic_write_json(record_path, record)
      approval = self._read_json(self._approval_path(publication_dir))
      if approval and approval.get("release_key") == record.get("release_key"):
        self._atomic_write_json(
          self._approved_snapshot_path(publication_dir),
          deepcopy(record),
        )
      import_path = self._raster_import_path(publication_dir)
      import_state = self._read_json(import_path)
      if (
        import_state
        and import_state.get("release_key") == record.get("release_key")
        and import_state.get("status") == "waiting_source"
        and not record.get("source_partial")
      ):
        import_state["status"] = "queued"
        import_state["message"] = "Quellrelease ist vollst?ndig; Rasterimport wird fortgesetzt."
        import_state["updated_at"] = now
        self._atomic_write_json(import_path, import_state)
      return self._public_record(record)

  def recover_incomplete(self) -> int:
    recovered = 0
    with _PUBLICATION_LOCK:
      for path in self._record_paths():
        record = self._read_json(path)
        if record and record.get("status") == "downloading":
          record["status"] = "queued"
          record["updated_at"] = self._now()
          record["error"] = "Unterbrochene Bereitstellung wurde nach Neustart fortgesetzt."
          self._atomic_write_json(path, record)
          recovered += 1
    return recovered

  def process_next(self) -> Optional[Dict[str, Any]]:
    record_path = None
    record = None
    with _PUBLICATION_LOCK:
      for candidate in self._record_paths():
        value = self._read_json(candidate)
        if value and value.get("status") == "queued":
          record_path = candidate
          record = value
          record["status"] = "downloading"
          record["updated_at"] = self._now()
          record["error"] = None
          self._atomic_write_json(candidate, record)
          break
    if record_path is None or record is None:
      return None

    try:
      # One-time migration from the old mirror workflow. Existing legacy
      # files stay untouched until a separately approved cleanup.
      record["storage_mode"] = "reference"
      for item in record.get("files") or []:
        item["stored_path"] = None
        item["downloaded_bytes"] = item.get("size_bytes") or 0
      record["status"] = "published"
      record["published_at"] = self._now()
      record["updated_at"] = record["published_at"]
      record["error"] = None
    except Exception as exc:
      record["status"] = "failed"
      record["updated_at"] = self._now()
      record["error"] = str(exc)[:4000]
    self._persist_processed_record(record_path, record)
    return self._public_record(record)

  def _download_artifact(self, artifact: Dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and self._artifact_valid(destination, artifact):
      return
    partial = destination.with_suffix(destination.suffix + ".part")
    existing = partial.stat().st_size if partial.exists() else 0
    headers = {"Accept-Encoding": "identity"}
    if existing:
      headers["Range"] = f"bytes={existing}-"
    timeout = (
      int(getattr(self.config_cls, "INGESTION_DOWNLOAD_CONNECT_TIMEOUT_SECONDS", 10)),
      int(getattr(self.config_cls, "INGESTION_DOWNLOAD_READ_TIMEOUT_SECONDS", 120)),
    )
    with self.http.get(
      artifact["url"],
      headers=headers,
      stream=True,
      timeout=timeout,
      allow_redirects=False,
    ) as response:
      if response.status_code == 416 and partial.exists():
        pass
      else:
        response.raise_for_status()
        append = existing > 0 and response.status_code == 206
        mode = "ab" if append else "wb"
        with partial.open(mode) as handle:
          for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
              handle.write(chunk)
    if not self._artifact_valid(partial, artifact):
      raise RuntimeError(f"Größe oder Prüfsumme für '{artifact['name']}' stimmt nicht.")
    partial.replace(destination)

  @staticmethod
  def _artifact_valid(path: Path, artifact: Dict[str, Any]) -> bool:
    if not path.exists() or not path.is_file():
      return False
    if artifact.get("size_bytes") is not None and path.stat().st_size != int(artifact["size_bytes"]):
      return False
    return verify_checksum(path, "sha256" if artifact.get("sha256") else None, artifact.get("sha256"))

  def list_non_spatial(self) -> list[Dict[str, Any]]:
    records = []
    for path in self._record_paths():
      record = self._read_json(path)
      if record:
        records.append(self._public_record(record))
    return sorted(records, key=lambda item: str(item.get("updated_at") or ""), reverse=True)

  def list_approved_file_collections(self) -> list[Dict[str, Any]]:
    records = []
    for path in self._record_paths():
      approval = self._read_json(self._approval_path(path.parent))
      if not approval or not approval.get("release_key"):
        continue
      review = self._read_json(self._review_path(path.parent)) or {}
      if (
        review.get("release_key") == approval.get("release_key")
        and review.get("decision") == "rejected"
      ):
        continue
      current = self._read_json(path)
      if (
        current
        and current.get("storage_mode") == "local-reference"
        and current.get("release_key") != approval.get("release_key")
      ):
        continue
      selected = (
        current
        if current and current.get("release_key") == approval.get("release_key")
        else self._read_json(self._approved_snapshot_path(path.parent))
      )
      if (
        selected
        and selected.get("kind") in {"file_collection", "non_spatial"}
        and selected.get("release_key") == approval.get("release_key")
      ):
        records.append(self._public_record(selected, approval=approval))
    return sorted(records, key=lambda item: str(item.get("approved_at") or ""), reverse=True)

  def approve_file_collection(
    self,
    dataset_id: str,
    *,
    release_key: str,
    approved_by: Optional[Dict[str, Any]] = None,
  ) -> Dict[str, Any]:
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    publication_dir = self.non_spatial_root / normalized
    record_path = publication_dir / "publication.json"
    with _PUBLICATION_LOCK:
      record = self._read_json(record_path)
      if not record:
        raise ProductionPublicationError(
          "Die Geodaten-Dateisammlung wurde nicht gefunden.",
          status_code=404,
          code="file_collection_not_found",
        )
      if record.get("kind") not in {"file_collection", "non_spatial"}:
        raise ProductionPublicationError(
          "Nur Geodaten-Dateisammlungen können mit dieser Freigabe übernommen werden.",
          status_code=422,
          code="publication_not_approvable",
        )
      requested_release = str(release_key or "").strip().lower()
      if requested_release != str(record.get("release_key") or "").lower():
        raise ProductionPublicationError(
          "Inzwischen liegt ein neuerer Release vor. Bitte die Liste aktualisieren und diesen erneut prüfen.",
          status_code=409,
          code="stale_release_approval",
        )
      if record.get("status") == "failed":
        raise ProductionPublicationError(
          "Ein fehlgeschlagener Release kann nicht freigegeben werden.",
          status_code=409,
          code="failed_release_approval",
        )
      actor = {
        key: str(value)
        for key, value in (approved_by or {}).items()
        if key in {"id", "email", "display_name", "name"} and value is not None
      }
      decided_at = self._now()
      approval = {
        "release_key": requested_release,
        "approved_at": decided_at,
        "approved_by": actor,
      }
      self._atomic_write_json(
        self._review_path(publication_dir),
        {
          "release_key": requested_release,
          "decision": "approved",
          "decided_at": decided_at,
          "decided_by": actor,
          "reason": None,
        },
      )
      self._atomic_write_json(self._approval_path(publication_dir), approval)
      self._atomic_write_json(self._approved_snapshot_path(publication_dir), deepcopy(record))
    result = self._public_record(record, approval=approval)
    if normalized == _TERRAIN_FIXED_DATASET and self._terrain_serving_artifacts(record):
      try:
        result['terrain_serving'] = self.prepare_terrain_serving(
          normalized,
          release_key=requested_release,
          background=True,
        )
      except ProductionPublicationError as exc:
        result['terrain_serving'] = {
          'status': 'failed-to-start',
          'code': exc.code,
          'message': str(exc),
        }
    return result

  def reject_file_collection(
    self,
    dataset_id: str,
    *,
    release_key: str,
    reason: str,
    rejected_by: Optional[Dict[str, Any]] = None,
  ) -> Dict[str, Any]:
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    publication_dir = self.non_spatial_root / normalized
    record_path = publication_dir / "publication.json"
    with _PUBLICATION_LOCK:
      record = self._read_json(record_path)
      if not record:
        raise ProductionPublicationError(
          "Die Datensammlung wurde nicht gefunden.",
          status_code=404,
          code="file_collection_not_found",
        )
      if record.get("kind") not in {"file_collection", "non_spatial"}:
        raise ProductionPublicationError(
          "Dieser Datensatz unterst?tzt keine manuelle Release-Entscheidung.",
          status_code=422,
          code="publication_not_rejectable",
        )
      requested_release = str(release_key or "").strip().lower()
      if requested_release != str(record.get("release_key") or "").lower():
        raise ProductionPublicationError(
          "Inzwischen liegt ein neuerer Release vor. Bitte die Liste aktualisieren und diesen pr?fen.",
          status_code=409,
          code="stale_release_rejection",
        )
      clean_reason = str(reason or "").strip()
      if len(clean_reason) < 3:
        raise ProductionPublicationError(
          "Bitte einen nachvollziehbaren Ablehnungsgrund mit mindestens drei Zeichen angeben.",
          status_code=422,
          code="release_rejection_reason_required",
        )
      actor = {
        key: str(value)
        for key, value in (rejected_by or {}).items()
        if key in {"id", "email", "display_name", "name"} and value is not None
      }
      review = {
        "release_key": requested_release,
        "decision": "rejected",
        "decided_at": self._now(),
        "decided_by": actor,
        "reason": clean_reason[:2000],
      }
      self._atomic_write_json(self._review_path(publication_dir), review)
      approval_path = self._approval_path(publication_dir)
      approval = self._read_json(approval_path) or {}
      if approval.get("release_key") == requested_release:
        approval_path.unlink(missing_ok=True)
    return self._public_record(record, approval={})

  def get_approved_file_collection(self, dataset_id: str) -> Dict[str, Any]:
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    publication_dir = self.non_spatial_root / normalized
    approval = self._read_json(self._approval_path(publication_dir))
    current = self._read_json(publication_dir / "publication.json")
    selected = (
      current
      if current and approval and current.get("release_key") == approval.get("release_key")
      else self._read_json(self._approved_snapshot_path(publication_dir))
    )
    if (
      not approval
      or not selected
      or selected.get("kind") not in {"file_collection", "non_spatial"}
      or selected.get("release_key") != approval.get("release_key")
    ):
      raise ProductionPublicationError(
        "Die freigegebene Geodaten-Dateisammlung wurde nicht gefunden.",
        status_code=404,
        code="approved_file_collection_not_found",
      )
    return self._public_record(selected, approval=approval)

  def terrain_serving_status(
    self,
    dataset_id: str,
    *,
    release_key: str = '',
  ) -> Dict[str, Any]:
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    approved = self.get_approved_file_collection(normalized)
    approved_release = str(approved.get('release_key') or '').strip().lower()
    requested_release = str(release_key or approved_release).strip().lower()
    if requested_release != approved_release:
      raise ProductionPublicationError(
        'Terrain-Serving darf nur fuer den zentral freigegebenen Release vorbereitet werden.',
        status_code=409,
        code='terrain_serving_release_not_approved',
      )
    record = self.get_non_spatial(normalized, release_key=approved_release)
    eligible = self._terrain_serving_artifacts(record)
    manifest = self._read_json(self._terrain_serving_manifest_path(record))
    if not manifest or manifest.get('releaseKey') != approved_release:
      manifest = {
        'schemaVersion': _TERRAIN_SERVING_SCHEMA,
        'datasetId': normalized,
        'releaseKey': approved_release,
        'status': 'not-started',
        'totalFiles': len(eligible),
        'processedFiles': 0,
        'preparedFiles': 0,
        'existingFiles': 0,
        'failedFiles': 0,
        'ignoredFiles': max(
          0,
          len(record.get('files') or record.get('artifacts') or []) - len(eligible),
        ),
        'progressPercent': 0.0,
        'updatedAt': None,
        'errors': [],
      }
    key = self._terrain_serving_job_key(record)
    with _TERRAIN_SERVING_JOBS_LOCK:
      active_here = key in _TERRAIN_SERVING_JOBS
    result = dict(manifest)
    result['active'] = active_here or str(result.get('status')) in {'queued', 'running'}
    result['storageMode'] = 'derived-versioned-height-index'
    result['rawDataDuplicated'] = False
    result['tileSchemaVersion'] = _TERRAIN_SERVING_TILE_SCHEMA
    return result

  def prepare_terrain_serving(
    self,
    dataset_id: str,
    *,
    release_key: str = '',
    background: bool = True,
  ) -> Dict[str, Any]:
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    approved = self.get_approved_file_collection(normalized)
    approved_release = str(approved.get('release_key') or '').strip().lower()
    requested_release = str(release_key or approved_release).strip().lower()
    if requested_release != approved_release:
      raise ProductionPublicationError(
        'Nur der zentral freigegebene Release darf fuer Terrain-Serving vorbereitet werden.',
        status_code=409,
        code='terrain_serving_release_not_approved',
      )
    record = self.get_non_spatial(normalized, release_key=approved_release)
    eligible = self._terrain_serving_artifacts(record)
    if not eligible:
      raise ProductionPublicationError(
        'Der freigegebene Release enthaelt keine erkennbaren XYZ-Gelaendekacheln.',
        status_code=422,
        code='terrain_serving_files_missing',
      )
    key = self._terrain_serving_job_key(record)
    if background:
      current = self._read_json(self._terrain_serving_manifest_path(record)) or {}
      if (
        current.get('releaseKey') == approved_release
        and current.get('status') in {'complete', 'complete-with-errors'}
        and int(current.get('processedFiles') or 0) >= len(eligible)
      ):
        return self.terrain_serving_status(normalized, release_key=approved_release)
      with _TERRAIN_SERVING_JOBS_LOCK:
        if key in _TERRAIN_SERVING_JOBS:
          return self.terrain_serving_status(normalized, release_key=approved_release)
        _TERRAIN_SERVING_JOBS.add(key)
      queued = self._terrain_serving_initial_manifest(record, eligible, status='queued')
      self._atomic_write_json(self._terrain_serving_manifest_path(record), queued)
      worker = Thread(
        target=self._terrain_serving_worker,
        args=(record, eligible, key),
        name=f'terrain-serving-{normalized[:32]}',
        daemon=True,
      )
      worker.start()
      return self.terrain_serving_status(normalized, release_key=approved_release)
    with _TERRAIN_SERVING_JOBS_LOCK:
      if key in _TERRAIN_SERVING_JOBS:
        return self.terrain_serving_status(normalized, release_key=approved_release)
      _TERRAIN_SERVING_JOBS.add(key)
    try:
      self._run_terrain_serving_preparation(record, eligible)
    finally:
      with _TERRAIN_SERVING_JOBS_LOCK:
        _TERRAIN_SERVING_JOBS.discard(key)
    return self.terrain_serving_status(normalized, release_key=approved_release)

  def _terrain_serving_worker(
    self,
    record: Dict[str, Any],
    eligible: list[Dict[str, Any]],
    key: str,
  ) -> None:
    try:
      self._run_terrain_serving_preparation(record, eligible)
    finally:
      with _TERRAIN_SERVING_JOBS_LOCK:
        _TERRAIN_SERVING_JOBS.discard(key)

  def _run_terrain_serving_preparation(
    self,
    record: Dict[str, Any],
    eligible: list[Dict[str, Any]],
  ) -> None:
    manifest_path = self._terrain_serving_manifest_path(record)
    lock_path = manifest_path.with_name('.prepare.lock')
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    try:
      descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
      return
    try:
      os.write(descriptor, f'{os.getpid()}\n'.encode('ascii'))
    finally:
      os.close(descriptor)
    manifest = self._terrain_serving_initial_manifest(record, eligible, status='running')
    manifest['startedAt'] = self._now()
    self._atomic_write_json(manifest_path, manifest)
    processed = 0
    prepared = 0
    existing = 0
    failures: list[Dict[str, str]] = []

    def prepare(item: Dict[str, Any]) -> tuple[str, Dict[str, Any], Optional[str]]:
      try:
        state = self._prepare_terrain_serving_artifact(record, item)
        return state, item, None
      except Exception as exc:
        return 'failed', item, f'{type(exc).__name__}: {exc}'[:1000]

    try:
      concurrency = max(
        1,
        min(
          8,
          int(getattr(self.config_cls, 'TERRAIN_SERVING_PREPARE_CONCURRENCY', 2)),
        ),
      )
      with ThreadPoolExecutor(max_workers=concurrency) as executor:
        for state, item, error in executor.map(prepare, eligible):
          processed += 1
          if state == 'prepared':
            prepared += 1
          elif state == 'existing':
            existing += 1
          else:
            failures.append({
              'file': str(item.get('name') or '')[:300],
              'message': str(error or 'Unbekannter Fehler')[:1000],
            })
            failures = failures[-100:]
          if processed % 25 == 0 or processed == len(eligible):
            manifest.update({
              'processedFiles': processed,
              'preparedFiles': prepared,
              'existingFiles': existing,
              'failedFiles': max(0, processed - prepared - existing),
              'progressPercent': round(processed * 100.0 / len(eligible), 2),
              'updatedAt': self._now(),
              'errors': failures,
            })
            self._atomic_write_json(manifest_path, manifest)
      manifest.update({
        'status': 'complete' if not failures else 'complete-with-errors',
        'processedFiles': processed,
        'preparedFiles': prepared,
        'existingFiles': existing,
        'failedFiles': max(0, processed - prepared - existing),
        'progressPercent': 100.0,
        'updatedAt': self._now(),
        'completedAt': self._now(),
        'errors': failures,
      })
      self._atomic_write_json(manifest_path, manifest)
    finally:
      lock_path.unlink(missing_ok=True)

  def _terrain_serving_initial_manifest(
    self,
    record: Dict[str, Any],
    eligible: list[Dict[str, Any]],
    *,
    status: str,
  ) -> Dict[str, Any]:
    all_files = record.get('files') or record.get('artifacts') or []
    return {
      'schemaVersion': _TERRAIN_SERVING_SCHEMA,
      'datasetId': str(record.get('dataset_id') or ''),
      'releaseKey': str(record.get('release_key') or ''),
      'status': status,
      'totalFiles': len(eligible),
      'processedFiles': 0,
      'preparedFiles': 0,
      'existingFiles': 0,
      'failedFiles': 0,
      'ignoredFiles': max(0, len(all_files) - len(eligible)),
      'progressPercent': 0.0,
      'startedAt': None,
      'updatedAt': self._now(),
      'completedAt': None,
      'errors': [],
    }

  def get_non_spatial(self, dataset_id: str, *, release_key: str = "") -> Dict[str, Any]:
    normalized = self.config_cls.sanitize_dataset_id(dataset_id)
    publication_dir = self.non_spatial_root / normalized
    record = self._read_json(publication_dir / "publication.json")
    requested_release = str(release_key or "").strip().lower()
    if requested_release and record and str(record.get("release_key") or "").lower() != requested_release:
      approved = self._read_json(self._approved_snapshot_path(publication_dir))
      record = (
        approved
        if approved and str(approved.get("release_key") or "").lower() == requested_release
        else None
      )
    if not record:
      raise ProductionPublicationError(
        "Der nicht-georeferenzierte Datensatz wurde nicht gefunden.",
        status_code=404,
        code="non_spatial_dataset_not_found",
      )
    return record

  def request_raster_import(
    self,
    dataset_id: str,
    *,
    release_key: str,
  ) -> Dict[str, Any]:
    publication = self.get_approved_file_collection(dataset_id)
    requested = str(release_key or "").strip().lower()
    if requested != str(publication.get("release_key") or "").lower():
      raise ProductionPublicationError(
        "Der Rasterimport darf nur f?r den aktuell freigegebenen Release gestartet werden.",
        status_code=409,
        code="raster_import_release_not_approved",
      )
    raw_record = self.get_non_spatial(dataset_id, release_key=requested)
    raster = RasterPublicationService(config_cls=self.config_cls, http=self.http)
    if not raster.supported(raw_record):
      raise ProductionPublicationError(
        "Dieses Dateiformat ben?tigt keinen oder noch keinen unterst?tzten Rasterimport.",
        status_code=422,
        code="raster_import_not_supported",
      )
    publication_dir = self.non_spatial_root / raw_record["dataset_id"]
    import_path = self._raster_import_path(publication_dir)
    existing = self._read_json(import_path)
    if (
      existing
      and existing.get("release_key") == requested
      and existing.get("status") in {"queued", "waiting_source", "running", "published"}
    ):
      return existing
    now = self._now()
    state = {
      "release_key": requested,
      "dataset_id": raw_record["dataset_id"],
      "status": "queued",
      "stage": "queued",
      "processed_files": 0,
      "total_files": len(raw_record.get("files") or []),
      "progress_percent": 0.0,
      "message": "Der freigegebene Raster-Snapshot wurde zum Import eingeplant.",
      "error": None,
      "created_at": now,
      "updated_at": now,
    }
    self._atomic_write_json(import_path, state)
    return state

  def process_next_raster_import(self) -> Optional[Dict[str, Any]]:
    selected_path: Optional[Path] = None
    selected_state: Optional[Dict[str, Any]] = None
    selected_record: Optional[Dict[str, Any]] = None
    with _PUBLICATION_LOCK:
      for record_path in self._record_paths():
        import_path = self._raster_import_path(record_path.parent)
        state = self._read_json(import_path)
        if not state or state.get("status") not in {"queued", "waiting_source"}:
          continue
        try:
          record = self.get_non_spatial(
            str(state.get("dataset_id") or record_path.parent.name),
            release_key=str(state.get("release_key") or ""),
          )
        except ProductionPublicationError:
          continue
        state["status"] = "running"
        state["stage"] = "preparing"
        state["message"] = "Rasterimport wird vorbereitet."
        state["updated_at"] = self._now()
        state["error"] = None
        self._atomic_write_json(import_path, state)
        selected_path = import_path
        selected_state = state
        selected_record = record
        break
    if selected_path is None or selected_state is None or selected_record is None:
      return None

    def report(stage: str, processed: int, total: int, message: str) -> None:
      selected_state["stage"] = stage
      selected_state["processed_files"] = max(0, int(processed))
      selected_state["total_files"] = max(0, int(total))
      selected_state["progress_percent"] = (
        round(min(99.0, (processed / total) * 85.0), 2) if total else 0.0
      )
      selected_state["message"] = message
      selected_state["updated_at"] = self._now()
      self._atomic_write_json(selected_path, selected_state)

    raster: Optional[RasterPublicationService] = None
    try:
      raster = RasterPublicationService(config_cls=self.config_cls, http=self.http)
      result = raster.import_record(selected_record, progress=report)
      selected_state.update(result)
      selected_state["status"] = "published"
      selected_state["stage"] = "published"
      selected_state["progress_percent"] = 100.0
      selected_state["message"] = "Raster ist als WMS/WCS ver?ffentlicht."
      selected_state["error"] = None
      selected_state["published_at"] = self._now()
      selected_state["updated_at"] = selected_state["published_at"]
      self._atomic_write_json(selected_path, selected_state)
      publication_dir = selected_path.parent
      record_path = publication_dir / "publication.json"
      current = self._read_json(record_path)
      if current and current.get("release_key") == selected_state.get("release_key"):
        current["urls"] = dict(result.get("urls") or {})
        current["delivery_services"] = ["WMS", "WCS", "DOWNLOAD"]
        current["geometry_type"] = "Raster"
        current["updated_at"] = selected_state["updated_at"]
        self._atomic_write_json(record_path, current)
        self._refresh_approved_snapshot(record_path, current)
    except (RasterPublicationError, OSError, ValueError) as exc:
      message = str(exc)[:4000]
      source_wait = "noch nicht vollst?ndig verf?gbar" in message
      selected_state["status"] = "waiting_source" if source_wait else "failed"
      selected_state["stage"] = selected_state["status"]
      selected_state["message"] = (
        "Webscraper-Daten sind noch nicht vollst?ndig; der Import wartet."
        if source_wait
        else "Rasterimport ist fehlgeschlagen."
      )
      selected_state["error"] = None if source_wait else message
      selected_state["updated_at"] = self._now()
      self._atomic_write_json(selected_path, selected_state)
    finally:
      if raster is not None:
        raster.cleanup_record_sources(selected_record)
    return selected_state

  def apply_raster_style(
    self,
    dataset_id: str,
    *,
    release_key: str,
    palette: str,
  ) -> Dict[str, Any]:
    publication = self.get_approved_file_collection(dataset_id)
    if str(publication.get("release_key") or "") != str(release_key or ""):
      raise ProductionPublicationError(
        "Der Style darf nur auf den freigegebenen Release angewendet werden.",
        status_code=409,
        code="raster_style_release_not_approved",
      )
    publication_dir = self.non_spatial_root / publication["dataset_id"]
    import_path = self._raster_import_path(publication_dir)
    state = self._read_json(import_path)
    if not state or state.get("status") != "published":
      raise ProductionPublicationError(
        "Der Rasterdienst muss vor dem Style-Update ver?ffentlicht sein.",
        status_code=409,
        code="raster_style_import_required",
      )
    try:
      style = RasterPublicationService(
        config_cls=self.config_cls,
        http=self.http,
      ).apply_style(state, palette=palette)
    except RasterPublicationError as exc:
      raise ProductionPublicationError(
        str(exc), status_code=422, code="raster_style_failed"
      ) from exc
    state["style"] = style
    state["updated_at"] = self._now()
    self._atomic_write_json(import_path, state)
    return state

  def list_files(
    self,
    dataset_id: str,
    *,
    release_key: str = "",
    offset: int = 0,
    limit: int = 100,
    q: str = "",
  ) -> Dict[str, Any]:
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    items = [
      self._public_file(record, item)
      for item in (record.get("files") or record.get("artifacts") or [])
      if isinstance(item, dict)
    ]
    normalized_q = str(q or "").strip().casefold()
    if normalized_q:
      items = [item for item in items if normalized_q in item["name"].casefold()]
    offset = max(0, int(offset))
    limit = max(1, min(500, int(limit)))
    page = items[offset:offset + limit]
    return {
      "dataset_id": record["dataset_id"],
      "release_key": record.get("release_key"),
      "items": page,
      "offset": offset,
      "limit": limit,
      "total": len(items),
      "has_more": offset + len(page) < len(items),
    }

  def download_target(
    self,
    dataset_id: str,
    file_name: str,
    *,
    release_key: str = "",
  ) -> tuple[Optional[Path], Optional[str], Dict[str, Any]]:
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    selected = self._select_file(record, file_name, queryable_only=False)
    if selected.get("stored_path") or selected.get("local_path"):
      return self._stored_path(record, selected), None, selected
    source_url = RasterPublicationService.reference_url(str(selected.get("url") or ""))
    if not source_url:
      raise ProductionPublicationError(
        "F?r diese Datei ist keine g?ltige Webscraper-Referenz vorhanden.",
        status_code=404,
        code="publication_file_reference_missing",
      )
    return None, source_url, selected

  def batch_metalink(
    self,
    dataset_id: str,
    *,
    release_key: str = "",
  ) -> bytes:
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    ET.register_namespace("", _METALINK_NAMESPACE)
    root = ET.Element(f"{{{_METALINK_NAMESPACE}}}metalink")
    ET.SubElement(root, f"{{{_METALINK_NAMESPACE}}}identity").text = record["dataset_id"]
    ET.SubElement(root, f"{{{_METALINK_NAMESPACE}}}description").text = (
      f"Freigegebener Vectoplan-Release {record.get('release_key')}"
    )
    public_base = str(
      getattr(self.config_cls, "SERVICE_PUBLIC_BASE_URL", "")
      or "http://localhost:5110"
    ).rstrip("/")
    for item in record.get("files") or record.get("artifacts") or []:
      name = str(item.get("name") or "")
      if not name or not (item.get("stored_path") or item.get("url")):
        continue
      url = (
        f"{public_base}/admin/api/production-publications/"
        f"{quote(record['dataset_id'])}/files/{quote(name)}"
        f"?release_key={quote(str(record.get('release_key') or ''))}"
      )
      node = ET.SubElement(
        root,
        f"{{{_METALINK_NAMESPACE}}}file",
        {"name": name},
      )
      if item.get("size_bytes") is not None:
        ET.SubElement(node, f"{{{_METALINK_NAMESPACE}}}size").text = str(
          item["size_bytes"]
        )
      if item.get("sha256"):
        ET.SubElement(
          node,
          f"{{{_METALINK_NAMESPACE}}}hash",
          {"type": "sha-256"},
        ).text = str(item["sha256"])
      ET.SubElement(node, f"{{{_METALINK_NAMESPACE}}}url").text = url
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)

  def coordinate_query_schema(self, dataset_id: str) -> Dict[str, Any]:
    publication = self.get_approved_file_collection(dataset_id)
    if publication.get('kind') != 'file_collection':
      return self.query_schema(dataset_id)
    dataset_id = str(publication['dataset_id'])
    route = f'/admin/api/production-publications/{quote(dataset_id)}/query'
    separator = chr(38)
    try:
      terrain_serving = self.terrain_serving_status(
        dataset_id,
        release_key=str(publication.get('release_key') or ''),
      )
    except ProductionPublicationError:
      terrain_serving = None
    return {
      'dataset_id': dataset_id,
      'release_key': str(publication.get('release_key') or ''),
      'source_partial': bool(publication.get('source_partial')),
      'service': 'coordinate-file-query',
      'terrain_serving': terrain_serving,
      'method': 'GET',
      'route': route,
      'description': 'Koordinatenzugriff auf Geodaten-Dateisammlungen und XYZ-Hoehenmodelle.',
      'parameters': {
        'x': 'EPSG:25832-Rechtswert; zusammen mit y',
        'y': 'EPSG:25832-Hochwert; zusammen mit x',
        'lat': 'WGS84-Breitengrad; zusammen mit lon',
        'lon': 'WGS84-Laengengrad; zusammen mit lat',
        'radius_m': 'Maximaler Abstand zum XYZ-Punkt; Standard 10 m',
      },
      'examples': {
        'projected': f'{route}?x=579007.5{separator}y=5490997.5{separator}srid=25832',
        'wgs84': f'{route}?lat=49.566410525761{separator}lon=10.0926393462928',
      },
    }

  def coordinate_batch_query(
    self,
    dataset_id: str,
    *,
    points: Any,
    radius_m: Any = None,
  ) -> Dict[str, Any]:
    publication = self.get_approved_file_collection(dataset_id)
    if publication.get('kind') != 'file_collection':
      raise ProductionPublicationError(
        'Die Geländeabfrage ist nur für freigegebene Geodaten-Dateisammlungen verfügbar.',
        code='terrain_grid_query_not_supported',
      )
    if not isinstance(points, list) or not points:
      raise ProductionPublicationError(
        'points muss eine nicht leere Liste aus Koordinatenobjekten sein.',
        code='terrain_grid_points_required',
      )
    maximum = max(
      1,
      int(getattr(self.config_cls, 'COORDINATE_QUERY_MAX_BATCH_POINTS', 512)),
    )
    if len(points) > maximum:
      raise ProductionPublicationError(
        f'Eine Geländeabfrage unterstützt höchstens {maximum} Punkte.',
        status_code=413,
        code='terrain_grid_too_many_points',
      )

    release_key = str(publication.get('release_key') or '')
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    coordinate_files = self._coordinate_file_index(record)
    normalized_points: list[Dict[str, Any]] = []
    for index, item in enumerate(points):
      if not isinstance(item, dict):
        raise ProductionPublicationError(
          f'points[{index}] muss ein Koordinatenobjekt sein.',
          code='terrain_grid_point_invalid',
        )
      lat = self._optional_float(item.get('lat'))
      lon = self._optional_float(item.get('lon'))
      projected_x = self._optional_float(item.get('x'))
      projected_y = self._optional_float(item.get('y'))
      if (lat is None) != (lon is None) or (projected_x is None) != (projected_y is None):
        raise ProductionPublicationError(
          f'points[{index}] enthält ein unvollständiges Koordinatenpaar.',
          code='coordinate_pair_incomplete',
        )
      if lat is not None and projected_x is not None:
        raise ProductionPublicationError(
          f'points[{index}] darf nicht gleichzeitig lat/lon und x/y enthalten.',
          code='coordinate_modes_conflict',
        )
      if lat is not None:
        if not -90 <= lat <= 90 or not -180 <= float(lon) <= 180:
          raise ProductionPublicationError(
            f'points[{index}] liegt außerhalb des WGS84-Bereichs.',
            code='coordinate_out_of_range',
          )
        projected_x, projected_y, target_srid, _ = self._terrain_target(coordinate_files, lat=lat, lon=float(lon))
        supplied = {'lat': lat, 'lon': float(lon), 'srid': 4326}
      else:
        requested_srid = int(self._optional_float(item.get('srid')) or 25832)
        if projected_x is None or projected_y is None or requested_srid not in {25832, 25833}:
          raise ProductionPublicationError(
            f'points[{index}] benötigt lat/lon oder x/y in EPSG:25832/25833.',
            code='coordinate_srid_not_supported',
          )
        target_srid = requested_srid
        supplied = {'x': projected_x, 'y': projected_y, 'srid': requested_srid}
      normalized_points.append(
        {
          'index': index,
          'id': str(item.get('id') if item.get('id') is not None else index),
          'x': float(projected_x),
          'y': float(projected_y),
          'input_coordinates': supplied,
          'srid': target_srid,
        }
      )

    release_key = str(publication.get('release_key') or '')
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    maximum_distance = max(
      0.0,
      min(100.0, self._optional_float(radius_m) or 10.0),
    )
    results: list[Optional[Dict[str, Any]]] = [None] * len(normalized_points)
    groups: Dict[str, Dict[str, Any]] = {}
    coordinate_files = self._coordinate_file_index(record)
    for target in normalized_points:
      matches = coordinate_files.get(
        (
          math.floor(float(target['x']) / 1000.0),
          math.floor(float(target['y']) / 1000.0),
        ),
        [],
      )
      matches = [entry for entry in matches if entry['tile']['srid'] == target['srid']]
      if not matches:
        results[target['index']] = self._terrain_batch_result(target, None, None)
        continue
      selected = matches[0]['artifact']
      key = str(
        selected.get('stored_path')
        or selected.get('local_path')
        or selected.get('url')
        or selected.get('name')
        or ''
      )
      group = groups.setdefault(key, {'artifact': selected, 'targets': []})
      group['targets'].append(target)

    def resolve_group(group: Dict[str, Any]):
      artifact = group['artifact']
      targets = list(group['targets'])
      nearest = self._nearest_xyz_points_from_artifact(
        record,
        artifact,
        targets,
        maximum_distance=maximum_distance,
      )
      public_file = self._public_file(record, artifact)
      return targets, nearest, public_file

    grouped_values = list(groups.values())
    if len(grouped_values) > 1:
      worker_count = min(4, len(grouped_values))
      with ThreadPoolExecutor(max_workers=worker_count) as executor:
        resolved_groups = list(executor.map(resolve_group, grouped_values))
    else:
      resolved_groups = [resolve_group(group) for group in grouped_values]

    for targets, nearest, public_file in resolved_groups:
      for target, point in zip(targets, nearest):
        results[target['index']] = self._terrain_batch_result(
          target,
          public_file,
          point,
        )

    return {
      'dataset_id': str(record['dataset_id']),
      'release_key': release_key,
      'service': 'terrain-grid-query',
      'srid': normalized_points[0]['srid'] if len({item['srid'] for item in normalized_points}) == 1 else None,
      'radius_m': maximum_distance,
      'source_partial': bool(record.get('source_partial')),
      'items': [item for item in results if item is not None],
      'counts': {
        'requested': len(normalized_points),
        'found': sum(1 for item in results if item and item.get('found')),
        'missing': sum(1 for item in results if item and not item.get('found')),
        'source_files_read': len(groups),
      },
    }

  @staticmethod
  def _terrain_batch_result(
    target: Dict[str, Any],
    public_file: Optional[Dict[str, Any]],
    point: Optional[Dict[str, Any]],
  ) -> Dict[str, Any]:
    return {
      'id': target['id'],
      'input_coordinates': target['input_coordinates'],
      'normalized_coordinates': {
        'x': round(float(target['x']), 3),
        'y': round(float(target['y']), 3),
        'srid': target.get('srid', 25832),
      },
      'found': point is not None,
      'value': float(point['z']) if point is not None else None,
      'value_name': 'elevation',
      'unit': 'm',
      'point': point,
      'source_file': public_file,
    }

  def coordinate_query(
    self,
    dataset_id: str,
    *,
    latitude: Any = None,
    longitude: Any = None,
    x: Any = None,
    y: Any = None,
    srid: Any = None,
    radius_m: Any = None,
  ) -> Dict[str, Any]:
    publication = self.get_approved_file_collection(dataset_id)
    if publication.get('kind') != 'file_collection':
      raise ProductionPublicationError(
        'Die Koordinaten-Dateiabfrage ist nur fuer freigegebene Geodaten-Dateisammlungen verfuegbar.',
        code='coordinate_file_query_not_supported',
      )
    values = (latitude, longitude, x, y)
    if all(value is None or str(value).strip() == '' for value in values):
      return {
        **self.coordinate_query_schema(dataset_id),
        'help': True,
        'message': 'Keine Koordinaten angegeben. Verwenden Sie einen Beispielaufruf unter examples.',
      }
    release_key = str(publication.get('release_key') or '')
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    coordinate_files = self._coordinate_file_index(record)
    lat = self._optional_float(latitude)
    lon = self._optional_float(longitude)
    projected_x = self._optional_float(x)
    projected_y = self._optional_float(y)
    if (lat is None) != (lon is None) or (projected_x is None) != (projected_y is None):
      raise ProductionPublicationError(
        'lat und lon beziehungsweise x und y muessen jeweils gemeinsam angegeben werden.',
        code='coordinate_pair_incomplete',
      )
    if lat is not None and projected_x is not None:
      raise ProductionPublicationError(
        'Bitte entweder lat/lon oder x/y angeben, nicht beide Koordinatenpaare.',
        code='coordinate_modes_conflict',
      )
    if lat is not None:
      if not -90 <= lat <= 90 or not -180 <= float(lon) <= 180:
        raise ProductionPublicationError(
          'lat oder lon liegt ausserhalb des gueltigen WGS84-Bereichs.',
          code='coordinate_out_of_range',
        )
      projected_x, projected_y, target_srid, matches = self._terrain_target(coordinate_files, lat=lat, lon=float(lon))
      input_coordinates = {'lat': lat, 'lon': float(lon), 'srid': 4326}
    else:
      requested_srid = int(self._optional_float(srid) or 25832)
      if requested_srid not in {25832, 25833}:
        raise ProductionPublicationError(
          'x/y werden in EPSG:25832/25833 erwartet. Fuer WGS84 bitte lat/lon verwenden.',
          code='coordinate_srid_not_supported',
        )
      target_srid = requested_srid
      _, _, _, matches = self._terrain_target(coordinate_files, x=projected_x, y=projected_y, srid=target_srid)
      input_coordinates = {'x': projected_x, 'y': projected_y, 'srid': requested_srid}
    assert projected_x is not None and projected_y is not None

    release_key = str(publication.get('release_key') or '')
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    base = {
      'dataset_id': record['dataset_id'],
      'release_key': release_key,
      'service': 'coordinate-file-query',
      'input_coordinates': input_coordinates,
      'normalized_coordinates': {
        'x': round(projected_x, 3),
        'y': round(projected_y, 3),
        'srid': target_srid,
      },
      'source_partial': bool(record.get('source_partial')),
    }
    if not matches:
      return {
        **base,
        'found': False,
        'message': (
          'Fuer diese Koordinate ist im freigegebenen Snapshot noch keine raeumlich '
          'zuordenbare Datei vorhanden. Bei einem laufenden Job kann die Kachel '
          'mit einem spaeteren Release hinzukommen.'
        ),
        'result': None,
      }

    selected = matches[0]['artifact']
    public_file = self._public_file(record, selected)
    public_file['tile'] = matches[0]['tile']
    result: Dict[str, Any] = {'source_file': public_file}
    point = self._nearest_xyz_from_artifact(record, selected, projected_x, projected_y)
    if point is not None:
      point['srid'] = target_srid
    maximum_distance = max(0.0, self._optional_float(radius_m) or 10.0)
    if point is not None and float(point['distance_m']) <= maximum_distance:
      result.update({
        'point': point,
        'value': point['z'],
        'value_name': 'elevation',
        'unit': 'm',
      })
      message = 'Der naechste DGM-Hoehenpunkt wurde gefunden.'
    elif point is not None:
      result['nearest_point'] = point
      message = f'Die Kachel wurde gefunden, der naechste Punkt ist weiter als {maximum_distance:g} m entfernt.'
    else:
      message = 'Die passende Geodaten-Datei wurde gefunden und kann heruntergeladen werden.'
    return {**base, 'found': True, 'message': message, 'result': result}

  @staticmethod
  def _raster_import_path(publication_dir: Path) -> Path:
    return publication_dir / "raster-import.json"

  def query(
    self,
    dataset_id: str,
    *,
    file_name: str = "",
    offset: int = 0,
    limit: int = 100,
    q: str = "",
    field: str = "",
    value: str = "",
    latitude: Any = None,
    longitude: Any = None,
    x: Any = None,
    y: Any = None,
    srid: Any = None,
    radius_m: Any = None,
    tolerance: Any = None,
  ) -> Dict[str, Any]:
    record = self.get_non_spatial(dataset_id)
    if record.get('kind') == 'file_collection':
      return self.coordinate_query(
        dataset_id,
        latitude=latitude,
        longitude=longitude,
        x=x,
        y=y,
        srid=srid,
        radius_m=radius_m,
      )
    if record.get("status") != "published":
      raise ProductionPublicationError(
        "Der Datensatz ist noch nicht vollständig veröffentlicht.",
        status_code=409,
        code="non_spatial_dataset_not_ready",
      )
    selected = self._select_file(record, file_name, queryable_only=True)
    if selected.get("stored_path") or selected.get("local_path"):
      rows = self._iter_rows(self._stored_path(record, selected))
    else:
      rows = self._iter_rows_content(
        str(selected.get("name") or ""),
        self._reference_bytes(selected),
      )
    normalized_q = str(q or "").casefold()
    normalized_field = str(field or "").strip()
    normalized_value = str(value or "").casefold()
    coordinate_filter = self._coordinate_filter(
      latitude=latitude,
      longitude=longitude,
      x=x,
      y=y,
      radius_m=radius_m,
      tolerance=tolerance,
    )
    offset = max(0, int(offset))
    limit = max(1, min(int(limit), 500))
    matched = 0
    scanned = 0
    result = []
    has_more = False
    columns: list[str] = []
    for row in rows:
      scanned += 1
      normalized_row = self._row_dict(row)
      if normalized_q and normalized_q not in json.dumps(normalized_row, ensure_ascii=False, default=str).casefold():
        continue
      if normalized_field:
        field_value = str(normalized_row.get(normalized_field, "")).casefold()
        if normalized_value not in field_value:
          continue
      if coordinate_filter and not self._matches_coordinate(normalized_row, coordinate_filter):
        continue
      if matched < offset:
        matched += 1
        continue
      if len(result) >= limit:
        has_more = True
        break
      result.append(normalized_row)
      matched += 1
      if not columns:
        columns = list(normalized_row.keys())
    return {
      "dataset_id": record["dataset_id"],
      "file": selected["name"],
      "items": result,
      "columns": columns,
      "offset": offset,
      "limit": limit,
      "has_more": has_more,
      "scanned_rows": scanned,
      "coordinate_filter": coordinate_filter,
    }

  def query_schema(self, dataset_id: str) -> Dict[str, Any]:
    record = self.get_non_spatial(dataset_id)
    if record.get('kind') == 'file_collection':
      return self.coordinate_query_schema(dataset_id)
    files = [
      self._public_file(record, item)
      for item in (record.get("files") or [])
      if isinstance(item, dict)
      and Path(str(item.get("name") or "")).suffix.lower() in _QUERYABLE_EXTENSIONS
    ]
    return {
      "dataset_id": record["dataset_id"],
      "method": "GET",
      "route": f"/admin/api/non-spatial-datasets/{record['dataset_id']}/query",
      "response": {
        "items": "Array von JSON-Objekten",
        "columns": "erkannte Spalten",
        "has_more": "weitere Ergebnisse vorhanden",
      },
      "parameters": {
        "file": "Dateiname aus files",
        "q": "optionale Volltextsuche",
        "field": "optionaler Feldname",
        "value": "Teilwert fuer field",
        "offset": "Startindex",
        "limit": "1 bis 500",
        "lat": "Breitengrad; zusammen mit lon",
        "lon": "Laengengrad; zusammen mit lat",
        "radius_m": "Suchradius in Metern; Standard 5",
        "x": "Projektionskoordinate; zusammen mit y",
        "y": "Projektionskoordinate; zusammen mit x",
        "tolerance": "Toleranz in Einheiten von x/y; Standard 0",
      },
      "coordinate_aliases": {
        "latitude": ["lat", "latitude", "breitengrad"],
        "longitude": ["lon", "lng", "longitude", "laengengrad"],
        "x": ["x", "easting", "rechtswert"],
        "y": ["y", "northing", "hochwert"],
        "geojson": "geometry.coordinates wird ebenfalls erkannt",
      },
      "files": files,
    }
  def download_path(
    self,
    dataset_id: str,
    file_name: str,
    *,
    release_key: str = "",
  ) -> tuple[Path, Dict[str, Any]]:
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    if record.get("status") != "published":
      raise ProductionPublicationError(
        "Der Datensatz ist noch nicht vollständig veröffentlicht.",
        status_code=409,
        code="non_spatial_dataset_not_ready",
      )
    selected = self._select_file(record, file_name, queryable_only=False)
    return self._stored_path(record, selected), selected

  def _iter_rows(self, path: Path) -> Iterator[Any]:
    suffix = path.suffix.lower()
    if suffix in {".csv", ".tsv"}:
      delimiter = "\t" if suffix == ".tsv" else ","
      handle = path.open("r", encoding="utf-8-sig", errors="replace", newline="")
      try:
        yield from DictReader(handle, delimiter=delimiter)
      finally:
        handle.close()
      return
    if suffix in {".jsonl", ".ndjson"}:
      with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        for line in handle:
          if line.strip():
            yield json.loads(line)
      return
    if suffix == ".json":
      maximum = int(getattr(self.config_cls, "NONSPATIAL_QUERY_MAX_JSON_BYTES", 100 * 1024 ** 2))
      if path.stat().st_size > maximum:
        raise ProductionPublicationError(
          "Diese JSON-Datei ist für die Standardabfrage zu groß. Bitte als JSONL oder CSV bereitstellen.",
          status_code=422,
          code="non_spatial_json_too_large",
        )
      payload = json.loads(path.read_text(encoding="utf-8-sig"))
      if isinstance(payload, list):
        yield from payload
      elif isinstance(payload, dict):
        rows = payload.get("items") or payload.get("results") or payload.get("data")
        if isinstance(rows, list):
          yield from rows
        else:
          yield payload
      else:
        yield {"value": payload}
      return
    raise ProductionPublicationError(
      "Die Standardabfrage unterstützt CSV, TSV, JSON und JSONL.",
      status_code=422,
      code="non_spatial_format_not_queryable",
    )

  def _reference_cache_key(self, item: Dict[str, Any]) -> str:
    identity = '|'.join(
      (
        str(id(self.http)),
        str(item.get('url') or ''),
        str(item.get('sha256') or item.get('checksum') or ''),
        str(item.get('size') or item.get('size_bytes') or ''),
      )
    )
    return sha256(identity.encode('utf-8')).hexdigest()

  @staticmethod
  def _reference_cache_get(key: str) -> Optional[bytes]:
    with _REFERENCE_CACHE_LOCK:
      value = _REFERENCE_BYTES_CACHE.get(key)
      if value is not None:
        _REFERENCE_BYTES_CACHE.move_to_end(key)
      return value

  def _reference_cache_put(self, key: str, value: bytes) -> None:
    global _REFERENCE_BYTES_CACHE_SIZE
    maximum_entries = max(
      1,
      int(getattr(self.config_cls, 'COORDINATE_QUERY_REFERENCE_CACHE_ENTRIES', 64)),
    )
    maximum_bytes = max(
      1024 * 1024,
      int(
        getattr(
          self.config_cls,
          'COORDINATE_QUERY_REFERENCE_CACHE_MAX_BYTES',
          128 * 1024 * 1024,
        )
      ),
    )
    if len(value) > maximum_bytes:
      return
    with _REFERENCE_CACHE_LOCK:
      previous = _REFERENCE_BYTES_CACHE.pop(key, None)
      if previous is not None:
        _REFERENCE_BYTES_CACHE_SIZE -= len(previous)
      _REFERENCE_BYTES_CACHE[key] = value
      _REFERENCE_BYTES_CACHE_SIZE += len(value)
      while (
        len(_REFERENCE_BYTES_CACHE) > maximum_entries
        or _REFERENCE_BYTES_CACHE_SIZE > maximum_bytes
      ):
        _, removed = _REFERENCE_BYTES_CACHE.popitem(last=False)
        _REFERENCE_BYTES_CACHE_SIZE -= len(removed)

  def _reference_bytes(self, item: Dict[str, Any]) -> bytes:
    key = self._reference_cache_key(item)
    cached = self._reference_cache_get(key)
    if cached is not None:
      return cached
    with _REFERENCE_CACHE_LOCK:
      item_lock = _REFERENCE_KEY_LOCKS.setdefault(key, RLock())
    with item_lock:
      cached = self._reference_cache_get(key)
      if cached is not None:
        return cached
      value = self._download_reference_bytes(item)
      self._reference_cache_put(key, value)
      return value

  def _download_reference_bytes(self, item: Dict[str, Any]) -> bytes:
    source_url = RasterPublicationService.reference_url(str(item.get("url") or ""))
    if not source_url:
      raise ProductionPublicationError(
        "Fuer diese Abfragedatei fehlt eine gueltige Webscraper-Referenz.",
        status_code=404,
        code="publication_file_reference_missing",
      )
    maximum = int(
      getattr(self.config_cls, "NONSPATIAL_QUERY_MAX_JSON_BYTES", 100 * 1024 ** 2)
    )
    headers = {
      "Accept-Encoding": "identity",
      "X-Vectoplan-Service-Token": str(
        getattr(self.config_cls, "PRODUCTION_PUBLICATION_SERVICE_TOKEN", "")
      ),
    }
    try:
      response = self.http.get(
        source_url,
        headers=headers,
        stream=True,
        timeout=(
          int(getattr(self.config_cls, "INGESTION_DOWNLOAD_CONNECT_TIMEOUT_SECONDS", 10)),
          int(getattr(self.config_cls, "INGESTION_DOWNLOAD_READ_TIMEOUT_SECONDS", 120)),
        ),
        allow_redirects=False,
      )
      response.raise_for_status()
      declared = self._optional_nonnegative_int(response.headers.get("Content-Length"))
      if declared is not None and declared > maximum:
        raise ProductionPublicationError(
          "Die referenzierte Abfragedatei ist zu gross.",
          code="non_spatial_query_file_too_large",
        )
      chunks = []
      total = 0
      for chunk in response.iter_content(chunk_size=1024 * 1024):
        if not chunk:
          continue
        total += len(chunk)
        if total > maximum:
          raise ProductionPublicationError(
            "Die referenzierte Abfragedatei ist zu gross.",
            code="non_spatial_query_file_too_large",
          )
        chunks.append(chunk)
      return b"".join(chunks)
    except requests.RequestException as exc:
      raise ProductionPublicationError(
        f"Abfragedatei konnte nicht aus dem Webscraper gelesen werden: {exc}",
        status_code=502,
        code="non_spatial_query_reference_failed",
      ) from exc
    finally:
      try:
        response.close()
      except (NameError, AttributeError):
        pass

  def _iter_rows_content(self, name: str, data: bytes) -> Iterator[Any]:
    suffix = Path(name).suffix.lower()
    text = data.decode("utf-8-sig", errors="replace")
    if suffix in {".csv", ".tsv"}:
      yield from DictReader(io.StringIO(text), delimiter="	" if suffix == ".tsv" else ",")
      return
    if suffix in {".jsonl", ".ndjson"}:
      for line in text.splitlines():
        if line.strip():
          yield json.loads(line)
      return
    if suffix == ".json":
      payload = json.loads(text)
      if isinstance(payload, list):
        yield from payload
      elif isinstance(payload, dict):
        rows = payload.get("items") or payload.get("results") or payload.get("data")
        yield from rows if isinstance(rows, list) else [payload]
      else:
        yield {"value": payload}
      return
    raise ProductionPublicationError(
      "Die Standardabfrage unterstuetzt CSV, TSV, JSON und JSONL.",
      status_code=422,
      code="non_spatial_format_not_queryable",
    )
  def _select_file(
    self,
    record: Dict[str, Any],
    file_name: str,
    *,
    queryable_only: bool,
  ) -> Dict[str, Any]:
    files = [
      item
      for item in (record.get("files") or [])
      if (
        (item.get("stored_path") or item.get("local_path") or item.get("url"))
        and (not queryable_only or item.get("queryable"))
      )
    ]
    if file_name:
      selected = next((item for item in files if item.get("name") == file_name), None)
    else:
      selected = files[0] if files else None
    if selected is None:
      message = (
        "Dieser Datensatz enthält keine mit der Standardabfrage lesbare Datei."
        if queryable_only
        else "Die angeforderte Datei wurde nicht gefunden."
      )
      raise ProductionPublicationError(
        message,
        status_code=422 if queryable_only else 404,
        code="non_spatial_file_not_queryable" if queryable_only else "non_spatial_file_not_found",
      )
    return selected

  def _stored_path(self, record: Dict[str, Any], item: Dict[str, Any]) -> Path:
    local_path = str(item.get("local_path") or "").strip()
    if local_path:
      base = Path(self.config_cls.UPLOAD_ROOT_DIR).resolve(strict=False)
      path = Path(local_path).resolve(strict=False)
    else:
      base = (self.non_spatial_root / record["dataset_id"]).resolve(strict=False)
      path = (base / str(item.get("stored_path") or "")).resolve(strict=False)
    try:
      path.relative_to(base)
    except ValueError as exc:
      raise ProductionPublicationError(
        "Der gespeicherte Dateipfad ist ungültig.",
        status_code=500,
        code="non_spatial_path_invalid",
      ) from exc
    if not path.exists() or not path.is_file():
      raise ProductionPublicationError(
        "Die veröffentlichte Datei ist nicht verfügbar.",
        status_code=404,
        code="non_spatial_file_not_found",
      )
    return path
  def _record_paths(self) -> list[Path]:
    if not self.non_spatial_root.exists():
      return []
    return sorted(self.non_spatial_root.glob("*/publication.json"))

  @staticmethod
  def _approval_path(publication_dir: Path) -> Path:
    return publication_dir / "approval.json"

  @staticmethod
  def _review_path(publication_dir: Path) -> Path:
    return publication_dir / "review.json"

  @staticmethod
  def _approved_snapshot_path(publication_dir: Path) -> Path:
    return publication_dir / "approved-publication.json"

  def _refresh_approved_snapshot(self, record_path: Path, record: Dict[str, Any]) -> None:
    approval = self._read_json(self._approval_path(record_path.parent))
    if approval and approval.get("release_key") == record.get("release_key"):
      self._atomic_write_json(self._approved_snapshot_path(record_path.parent), deepcopy(record))

  def _persist_processed_record(self, record_path: Path, record: Dict[str, Any]) -> None:
    """Never let an older worker completion replace a newer scraper release."""
    with _PUBLICATION_LOCK:
      current = self._read_json(record_path)
      if (
        not current
        or current.get("release_key") == record.get("release_key")
      ):
        self._atomic_write_json(record_path, record)
      self._refresh_approved_snapshot(record_path, record)

  @staticmethod
  def openlayers_capable(publication: Dict[str, Any]) -> bool:
    urls = publication.get("urls") if isinstance(publication.get("urls"), dict) else {}
    # Der aktuelle OpenLayers-Consumer lädt dynamische Orchestrator-Daten per WFS.
    return bool(
      urls.get("wfs_url")
      or (urls.get("wms_url") and urls.get("wms_layer_name"))
    )

  def _public_file(
    self,
    record: Dict[str, Any],
    item: Dict[str, Any],
  ) -> Dict[str, Any]:
    dataset_id = str(record.get("dataset_id") or "")
    release_key = str(record.get("release_key") or "")
    name = str(item.get("name") or "")
    return {
      "name": name,
      "size_bytes": item.get("size_bytes") or item.get("downloaded_bytes"),
      "media_type": item.get("media_type"),
      "sha256": item.get("sha256"),
      "queryable": bool(item.get("stored_path") or item.get("local_path") or item.get("url")) and (
        bool(item.get("queryable"))
        or Path(name).suffix.lower() in _QUERYABLE_EXTENSIONS
      ),
      "available": bool(item.get("stored_path") or item.get("local_path") or item.get("url")),
      "download_url": (
        f"/admin/api/production-publications/{quote(dataset_id)}/files/{quote(name)}"
        f"?release_key={quote(release_key)}"
        if item.get("stored_path") or item.get("local_path") or item.get("url")
        else None
      ),
    }
  def _public_record(
    self,
    record: Dict[str, Any],
    *,
    approval: Optional[Dict[str, Any]] = None,
  ) -> Dict[str, Any]:
    dataset_id = str(record.get("dataset_id") or "")
    raster_import = self._read_json(
      self._raster_import_path(self.non_spatial_root / dataset_id)
    ) or {}
    release_key = str(record.get("release_key") or "")
    if approval is None:
      approval = self._read_json(self._approval_path(self.non_spatial_root / dataset_id)) or {}
    approved_release_key = str(approval.get("release_key") or "")
    review = self._read_json(self._review_path(self.non_spatial_root / dataset_id)) or {}
    review_release_key = str(review.get("release_key") or "")
    current_release_decided = bool(release_key and release_key == review_release_key)
    current_decision = (
      str(review.get("decision") or "").lower()
      if current_release_decided
      else "pending"
    )
    current_release_approved = bool(
      release_key and release_key == approved_release_key and current_decision != "rejected"
    )
    files = []
    for item in record.get("files") or record.get("artifacts") or []:
      name = str(item.get("name") or "")
      queryable = bool(
        item.get("stored_path") or item.get("local_path") or item.get("url")
      ) and (
        bool(item.get("queryable")) or Path(name).suffix.lower() in _QUERYABLE_EXTENSIONS
      )
      files.append(
        {
          "name": name,
          "size_bytes": item.get("size_bytes") or item.get("downloaded_bytes"),
          "media_type": item.get("media_type"),
          "queryable": queryable,
          "download_url": (
            f"/admin/api/production-publications/{quote(dataset_id)}/files/{quote(name)}?release_key={quote(release_key)}"
            if item.get("stored_path") or item.get("local_path") or item.get("url")
            else None
          ),
        }
      )
    file_count = len(files)
    public_files = files[:250]
    return {
      key: value
      for key, value in {
        "release_key": record.get("release_key"),
        "project_id": record.get("project_id"),
        "project_name": record.get("project_name"),
        "dataset_id": dataset_id,
        "kind": record.get("kind"),
        "publication_profile": record.get("publication_profile"),
        "delivery_services": record.get("delivery_services") or [],
        "status": record.get("status"),
        "job_id": record.get("job_id"),
        "job_uuid": record.get("job_uuid"),
        "progress_percent": record.get("progress_percent"),
        "detected_formats": record.get("detected_formats") or [],
        "urls": record.get("urls") or {},
        "wfs_url": record.get("wfs_url"),
        "file_count": file_count,
        "files": public_files,
        "files_truncated": file_count > len(public_files),
        "assessment_ids": record.get("assessment_ids") or [],
        "storage_mode": record.get("storage_mode"),
        "source_partial": bool(record.get("source_partial")),
        "source_files_completed": record.get("source_files_completed"),
        "raster_import": raster_import,
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
        "published_at": record.get("published_at"),
        "error": record.get("error"),
        "approval": {
          "has_approved_release": bool(approved_release_key),
          "current_release_approved": current_release_approved,
          "approved_release_key": approved_release_key or None,
          "approved_at": approval.get("approved_at"),
          "approved_by": approval.get("approved_by") or {},
        },
        "review": {
          "decision": current_decision,
          "current_release_decided": current_release_decided,
          "release_key": review_release_key or None,
          "reason": review.get("reason") if current_release_decided else None,
          "decided_at": review.get("decided_at") if current_release_decided else None,
          "decided_by": (
            review.get("decided_by") or {} if current_release_decided else {}
          ),
        },
        "approved_at": approval.get("approved_at") if current_release_approved else None,
        "openlayers_supported": self.openlayers_capable(record),
      }.items()
      if value is not None
    }

  @staticmethod
  def _wgs84_to_utm32(latitude: float, longitude: float, srid: int = 25832) -> tuple[float, float]:
    semi_major = 6378137.0
    flattening = 1.0 / 298.257223563
    scale = 0.9996
    eccentricity_squared = flattening * (2.0 - flattening)
    second_eccentricity_squared = eccentricity_squared / (1.0 - eccentricity_squared)
    latitude_rad = math.radians(latitude)
    longitude_rad = math.radians(longitude)
    central_meridian = math.radians(15.0 if srid == 25833 else 9.0)
    sin_latitude = math.sin(latitude_rad)
    cos_latitude = math.cos(latitude_rad)
    tangent = math.tan(latitude_rad)
    radius = semi_major / math.sqrt(1.0 - eccentricity_squared * sin_latitude ** 2)
    tangent_squared = tangent ** 2
    curvature = second_eccentricity_squared * cos_latitude ** 2
    delta = cos_latitude * (longitude_rad - central_meridian)
    meridian = semi_major * (
      (1.0 - eccentricity_squared / 4.0 - 3.0 * eccentricity_squared ** 2 / 64.0
       - 5.0 * eccentricity_squared ** 3 / 256.0) * latitude_rad
      - (3.0 * eccentricity_squared / 8.0 + 3.0 * eccentricity_squared ** 2 / 32.0
         + 45.0 * eccentricity_squared ** 3 / 1024.0) * math.sin(2.0 * latitude_rad)
      + (15.0 * eccentricity_squared ** 2 / 256.0
         + 45.0 * eccentricity_squared ** 3 / 1024.0) * math.sin(4.0 * latitude_rad)
      - (35.0 * eccentricity_squared ** 3 / 3072.0) * math.sin(6.0 * latitude_rad)
    )
    easting = 500000.0 + scale * radius * (
      delta
      + (1.0 - tangent_squared + curvature) * delta ** 3 / 6.0
      + (
        5.0 - 18.0 * tangent_squared + tangent_squared ** 2
        + 72.0 * curvature - 58.0 * second_eccentricity_squared
      ) * delta ** 5 / 120.0
    )
    northing = scale * (
      meridian + radius * tangent * (
        delta ** 2 / 2.0
        + (5.0 - tangent_squared + 9.0 * curvature + 4.0 * curvature ** 2)
        * delta ** 4 / 24.0
        + (
          61.0 - 58.0 * tangent_squared + tangent_squared ** 2
          + 600.0 * curvature - 330.0 * second_eccentricity_squared
        ) * delta ** 6 / 720.0
      )
    )
    if latitude < 0:
      northing += 10_000_000.0
    return easting, northing

  def _nearest_xyz_from_artifact(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
    target_x: float,
    target_y: float,
  ) -> Optional[Dict[str, Any]]:
    name = str(artifact.get('name') or '')
    suffix = Path(name).suffix.lower()
    if suffix not in {'.zip', '.xyz', '.txt', '.csv'}:
      return None
    if artifact.get('stored_path') or artifact.get('local_path'):
      data = self._stored_path(record, artifact).read_bytes()
    else:
      data = self._reference_bytes(artifact)
    maximum_points = int(
      getattr(self.config_cls, 'COORDINATE_QUERY_MAX_XYZ_POINTS', 4_100_000)
    )
    if suffix == '.zip':
      try:
        with ZipFile(io.BytesIO(data)) as archive:
          members = [
            member
            for member in archive.namelist()
            if Path(member).suffix.lower() in {'.xyz', '.txt', '.csv'}
          ]
          for member in members:
            with archive.open(member) as stream:
              point = self._nearest_xyz_lines(
                io.TextIOWrapper(stream, encoding='utf-8-sig', errors='replace'),
                target_x,
                target_y,
                maximum_points,
              )
            if point is not None:
              point['member'] = member
              return point
      except (BadZipFile, OSError):
        return None
      return None
    return self._nearest_xyz_lines(
      data.decode('utf-8-sig', errors='replace').splitlines(),
      target_x,
      target_y,
      maximum_points,
    )

  def _terrain_serving_artifacts(
    self,
    record: Dict[str, Any],
  ) -> list[Dict[str, Any]]:
    coordinate_pattern = re.compile(r'(?<!\d)(\d{3})[_-](\d{4})(?!\d)')
    result: list[Dict[str, Any]] = []
    identities: set[str] = set()
    for item in record.get('files') or record.get('artifacts') or []:
      if not isinstance(item, dict):
        continue
      name = str(item.get('name') or '')
      if (
        Path(name).suffix.lower() not in {'.zip', '.xyz', '.txt', '.csv'}
        or not coordinate_pattern.search(Path(name).name)
      ):
        continue
      identity = self._terrain_serving_artifact_identity(record, item)
      if identity in identities:
        continue
      identities.add(identity)
      result.append(item)
    return result

  def _terrain_serving_release_root(self, record: Dict[str, Any]) -> Path:
    dataset_id = self.config_cls.sanitize_dataset_id(record.get('dataset_id'))
    release_key = str(record.get('release_key') or '').strip().lower()
    if not re.fullmatch(r'[0-9a-f]{64}', release_key):
      raise ProductionPublicationError(
        'Der Terrain-Serving-Release-Schluessel ist ungueltig.',
        code='terrain_serving_release_invalid',
      )
    return (
      self.non_spatial_root
      / dataset_id
      / 'terrain-serving'
      / release_key
    )

  def _terrain_serving_manifest_path(self, record: Dict[str, Any]) -> Path:
    return self._terrain_serving_release_root(record) / 'manifest.json'

  def _terrain_serving_job_key(self, record: Dict[str, Any]) -> str:
    return self._terrain_serving_release_root(record).resolve(strict=False).as_posix()

  def _terrain_serving_artifact_identity(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
  ) -> str:
    checksum = str(artifact.get('sha256') or '').strip().lower()
    if len(checksum) == 64:
      return checksum
    path_value = artifact.get('stored_path') or artifact.get('local_path')
    if path_value:
      try:
        path = self._stored_path(record, artifact)
        stat = path.stat()
        value = f'{path.resolve(strict=False).as_posix()}|{stat.st_size}|{stat.st_mtime_ns}'
      except OSError:
        value = str(path_value)
    else:
      value = '|'.join(
        (
          str(artifact.get('url') or ''),
          str(artifact.get('name') or ''),
          str(artifact.get('size_bytes') or artifact.get('downloaded_bytes') or ''),
        )
      )
    return sha256(value.encode('utf-8')).hexdigest()

  def _terrain_serving_tile_path(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
  ) -> Path:
    identity = self._terrain_serving_artifact_identity(record, artifact)
    return self._terrain_serving_release_root(record) / 'tiles' / f'{identity}.vpt.gz'

  def _prepare_terrain_serving_artifact(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
  ) -> str:
    path = self._terrain_serving_tile_path(record, artifact)
    identity = self._terrain_serving_artifact_identity(record, artifact)
    cache_key = f'{path.resolve(strict=False).as_posix()}|{identity}'
    with _TERRAIN_SERVING_CACHE_LOCK:
      key_lock = _TERRAIN_SERVING_TILE_LOCKS.setdefault(cache_key, RLock())
    with key_lock:
      if path.is_file():
        try:
          self._read_terrain_serving_tile(record, artifact)
          return 'existing'
        except (OSError, ValueError, TypeError):
          path.unlink(missing_ok=True)
      name = str(artifact.get('name') or '')
      suffix = Path(name).suffix.lower()
      if artifact.get('stored_path') or artifact.get('local_path'):
        data = self._stored_path(record, artifact).read_bytes()
      else:
        data = self._reference_bytes(artifact)
      maximum_points = int(
        getattr(self.config_cls, 'COORDINATE_QUERY_MAX_XYZ_POINTS', 4_100_000)
      )
      points = self._xyz_points_from_bytes(
        data,
        suffix=suffix,
        maximum_points=maximum_points,
      )
      if not points:
        raise ValueError('Die Datei enthaelt keine lesbaren XYZ-Hoehenpunkte.')
      grid = self._regular_xyz_grid(points)
      header = {
        'schemaVersion': _TERRAIN_SERVING_TILE_SCHEMA,
        'datasetId': str(record.get('dataset_id') or ''),
        'releaseKey': str(record.get('release_key') or ''),
        'artifactIdentity': identity,
        'sourceName': name,
        'srid': self._terrain_artifact_srid(artifact),
        'originX': grid['originX'],
        'originY': grid['originY'],
        'stepX': grid['stepX'],
        'stepY': grid['stepY'],
        'width': grid['width'],
        'height': grid['height'],
        'valueScale': _TERRAIN_VALUE_SCALE,
        'nodata': _TERRAIN_NODATA,
        'pointCount': grid['pointCount'],
        'createdAt': self._now(),
      }
      header_bytes = json.dumps(
        header,
        ensure_ascii=True,
        separators=(',', ':'),
      ).encode('utf-8')
      values = array('i', grid['values'])
      if values.itemsize != 4:
        raise ValueError('Diese Plattform unterstuetzt keine 32-Bit-Terrainwerte.')
      if sys.byteorder != 'little':
        values.byteswap()
      path.parent.mkdir(parents=True, exist_ok=True)
      temporary = path.with_name(f'.{path.name}.{uuid4().hex}.tmp')
      try:
        with gzip.open(temporary, 'wb', compresslevel=6) as stream:
          stream.write(_TERRAIN_SERVING_MAGIC)
          stream.write(struct.pack('<I', len(header_bytes)))
          stream.write(header_bytes)
          stream.write(values.tobytes())
        os.replace(temporary, path)
      finally:
        temporary.unlink(missing_ok=True)
      with _TERRAIN_SERVING_CACHE_LOCK:
        _TERRAIN_SERVING_TILE_CACHE.pop(cache_key, None)
      return 'prepared'

  @staticmethod
  def _xyz_points_from_bytes(
    data: bytes,
    *,
    suffix: str,
    maximum_points: int,
  ) -> list[tuple[float, float, float]]:
    points: list[tuple[float, float, float]] = []

    def consume(lines: Iterable[str]) -> None:
      for line in lines:
        if len(points) >= maximum_points:
          raise ValueError('Das XYZ-Höhenmodell überschreitet die konfigurierte Punktgrenze.')
        parts = ProductionPublicationService._xyz_parts(line)
        if len(parts) < 3:
          continue
        try:
          points.append(tuple(map(float, parts[:3])))
        except ValueError:
          continue

    if suffix == '.zip':
      with ZipFile(io.BytesIO(data)) as archive:
        members = [
          member for member in archive.namelist()
          if Path(member).suffix.lower() in {'.xyz', '.txt', '.csv'}
        ]
        for member in members:
          if len(points) >= maximum_points:
            break
          with archive.open(member) as source:
            consume(
              io.TextIOWrapper(
                source,
                encoding='utf-8-sig',
                errors='replace',
              )
            )
    else:
      consume(data.decode('utf-8-sig', errors='replace').splitlines())
    return points

  @staticmethod
  def _regular_xyz_grid(
    points: list[tuple[float, float, float]],
  ) -> Dict[str, Any]:
    axis_x = sorted({point[0] for point in points})
    axis_y = sorted({point[1] for point in points})
    if not axis_x or not axis_y:
      raise ValueError('Das XYZ-Raster besitzt keine Koordinatenachsen.')

    def axis_step(axis: list[float]) -> float:
      if len(axis) < 2:
        return 5.0
      differences = sorted(
        value
        for value in (
          axis[index] - axis[index - 1]
          for index in range(1, len(axis))
        )
        if value > 0
      )
      if not differences:
        return 5.0
      step = differences[len(differences) // 2]
      tolerance = max(0.001, abs(step) * 0.01)
      if any(abs(value - step) > tolerance for value in differences):
        raise ValueError('Das XYZ-Hoehenmodell ist kein regelmaessiges Raster.')
      return float(step)

    width = len(axis_x)
    height = len(axis_y)
    if width * height > 4_100_000:
      raise ValueError('Das XYZ-Hoehenraster ist fuer eine einzelne Serving-Kachel zu gross.')
    x_index = {value: index for index, value in enumerate(axis_x)}
    y_index = {value: index for index, value in enumerate(axis_y)}
    values = [_TERRAIN_NODATA] * (width * height)
    for point_x, point_y, point_z in points:
      scaled = int(round(float(point_z) / _TERRAIN_VALUE_SCALE))
      if scaled <= _TERRAIN_NODATA or scaled > (2 ** 31) - 1:
        raise ValueError('Ein Hoehenwert liegt ausserhalb des Terrain-Serving-Bereichs.')
      values[x_index[point_x] + width * y_index[point_y]] = scaled
    populated = sum(1 for value in values if value != _TERRAIN_NODATA)
    if populated < max(1, int(width * height * 0.9)):
      raise ValueError('Das XYZ-Hoehenmodell deckt sein erkanntes Raster nicht ausreichend ab.')
    return {
      'originX': float(axis_x[0]),
      'originY': float(axis_y[0]),
      'stepX': axis_step(axis_x),
      'stepY': axis_step(axis_y),
      'width': width,
      'height': height,
      'pointCount': populated,
      'values': values,
    }

  def _read_terrain_serving_tile(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
  ) -> Dict[str, Any]:
    path = self._terrain_serving_tile_path(record, artifact)
    identity = self._terrain_serving_artifact_identity(record, artifact)
    cache_key = f'{path.resolve(strict=False).as_posix()}|{identity}'
    with _TERRAIN_SERVING_CACHE_LOCK:
      cached = _TERRAIN_SERVING_TILE_CACHE.get(cache_key)
      if cached is not None:
        _TERRAIN_SERVING_TILE_CACHE.move_to_end(cache_key)
        return cached
    with gzip.open(path, 'rb') as stream:
      if stream.read(4) != _TERRAIN_SERVING_MAGIC:
        raise ValueError('Ungueltige Terrain-Serving-Kachel.')
      header_size_raw = stream.read(4)
      if len(header_size_raw) != 4:
        raise ValueError('Terrain-Serving-Header fehlt.')
      header_size = struct.unpack('<I', header_size_raw)[0]
      if header_size <= 0 or header_size > 1024 * 1024:
        raise ValueError('Terrain-Serving-Header ist ungueltig.')
      header = json.loads(stream.read(header_size).decode('utf-8'))
      values = array('i')
      values.frombytes(stream.read())
    if sys.byteorder != 'little':
      values.byteswap()
    expected = int(header.get('width') or 0) * int(header.get('height') or 0)
    if (
      header.get('schemaVersion') != _TERRAIN_SERVING_TILE_SCHEMA
      or header.get('artifactIdentity') != identity
      or header.get('releaseKey') != str(record.get('release_key') or '')
      or expected <= 0
      or len(values) != expected
    ):
      raise ValueError('Terrain-Serving-Kachel passt nicht zum freigegebenen Release.')
    result = {'header': header, 'values': values}
    with _TERRAIN_SERVING_CACHE_LOCK:
      _TERRAIN_SERVING_TILE_CACHE[cache_key] = result
      _TERRAIN_SERVING_TILE_CACHE.move_to_end(cache_key)
      maximum_tiles = max(
        1,
        int(getattr(self.config_cls, 'TERRAIN_SERVING_MEMORY_CACHE_TILES', 64)),
      )
      while len(_TERRAIN_SERVING_TILE_CACHE) > maximum_tiles:
        stale_key, _ = _TERRAIN_SERVING_TILE_CACHE.popitem(last=False)
        _TERRAIN_SERVING_TILE_LOCKS.pop(stale_key, None)
    return result

  def _terrain_serving_points(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
    targets: list[Dict[str, Any]],
    *,
    maximum_distance: float,
  ) -> Optional[list[Optional[Dict[str, Any]]]]:
    path = self._terrain_serving_tile_path(record, artifact)
    if not path.is_file():
      return None
    tile = self._read_terrain_serving_tile(record, artifact)
    header = tile['header']
    values = tile['values']
    origin_x = float(header['originX'])
    origin_y = float(header['originY'])
    step_x = float(header['stepX'])
    step_y = float(header['stepY'])
    width = int(header['width'])
    height = int(header['height'])
    nodata = int(header.get('nodata', _TERRAIN_NODATA))
    scale = float(header.get('valueScale', _TERRAIN_VALUE_SCALE))
    maximum_squared = float(maximum_distance) ** 2
    result: list[Optional[Dict[str, Any]]] = []
    for target in targets:
      target_x = float(target['x'])
      target_y = float(target['y'])
      index_x = int(round((target_x - origin_x) / step_x))
      index_y = int(round((target_y - origin_y) / step_y))
      if index_x < 0 or index_x >= width or index_y < 0 or index_y >= height:
        result.append(None)
        continue
      point_x = origin_x + index_x * step_x
      point_y = origin_y + index_y * step_y
      distance_squared = (point_x - target_x) ** 2 + (point_y - target_y) ** 2
      value = int(values[index_x + width * index_y])
      if value == nodata or distance_squared > maximum_squared:
        result.append(None)
        continue
      result.append({
        'x': point_x,
        'y': point_y,
        'z': round(value * scale, 4),
        'srid': int(header.get('srid', 25832)),
        'distance_m': round(math.sqrt(distance_squared), 3),
        'serving_prepared': True,
        'serving_schema_version': _TERRAIN_SERVING_TILE_SCHEMA,
      })
    return result

  def _nearest_xyz_points_from_artifact(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
    targets: list[Dict[str, Any]],
    *,
    maximum_distance: float,
  ) -> list[Optional[Dict[str, Any]]]:
    name = str(artifact.get('name') or '')
    suffix = Path(name).suffix.lower()
    if suffix not in {'.zip', '.xyz', '.txt', '.csv'}:
      return [None] * len(targets)
    prepared = self._terrain_serving_points(
      record,
      artifact,
      targets,
      maximum_distance=maximum_distance,
    )
    if prepared is not None:
      return prepared
    try:
      self._prepare_terrain_serving_artifact(record, artifact)
      prepared = self._terrain_serving_points(
        record,
        artifact,
        targets,
        maximum_distance=maximum_distance,
      )
      if prepared is not None:
        return prepared
    except (OSError, ValueError, TypeError, BadZipFile):
      pass
    maximum_points = int(
      getattr(self.config_cls, 'COORDINATE_QUERY_MAX_XYZ_POINTS', 4_100_000)
    )
    bucket_size = max(5.0, float(maximum_distance) or 5.0)
    cache_key = self._xyz_tile_cache_key(
      record,
      artifact,
      bucket_size=bucket_size,
      maximum_points=maximum_points,
    )
    with _XYZ_TILE_CACHE_LOCK:
      key_lock = _XYZ_TILE_KEY_LOCKS.setdefault(cache_key, RLock())
    with key_lock:
      with _XYZ_TILE_CACHE_LOCK:
        cached = _XYZ_TILE_CACHE.get(cache_key)
        if cached is not None:
          _XYZ_TILE_CACHE.move_to_end(cache_key)
      if cached is None:
        if artifact.get('stored_path') or artifact.get('local_path'):
          data = self._stored_path(record, artifact).read_bytes()
        else:
          data = self._reference_bytes(artifact)
        lines: list[str] = []
        if suffix == '.zip':
          try:
            with ZipFile(io.BytesIO(data)) as archive:
              members = [
                member for member in archive.namelist()
                if Path(member).suffix.lower() in {'.xyz', '.txt', '.csv'}
              ]
              for member in members:
                with archive.open(member) as stream:
                  lines.extend(
                    io.TextIOWrapper(
                      stream,
                      encoding='utf-8-sig',
                      errors='replace',
                    ).read().splitlines()
                  )
          except (BadZipFile, OSError):
            return [None] * len(targets)
        else:
          lines = data.decode('utf-8-sig', errors='replace').splitlines()
        cached = self._build_xyz_bucket_index(
          lines,
          maximum_points=maximum_points,
          bucket_size=bucket_size,
        )
        with _XYZ_TILE_CACHE_LOCK:
          _XYZ_TILE_CACHE[cache_key] = cached
          _XYZ_TILE_CACHE.move_to_end(cache_key)
          maximum_tiles = max(
            1,
            int(getattr(self.config_cls, 'COORDINATE_QUERY_XYZ_CACHE_TILES', 12)),
          )
          while len(_XYZ_TILE_CACHE) > maximum_tiles:
            stale_key, _ = _XYZ_TILE_CACHE.popitem(last=False)
            _XYZ_TILE_KEY_LOCKS.pop(stale_key, None)
    return self._nearest_xyz_targets_from_index(
      cached,
      targets,
      maximum_distance=maximum_distance,
    )

  def _xyz_tile_cache_key(
    self,
    record: Dict[str, Any],
    artifact: Dict[str, Any],
    *,
    bucket_size: float,
    maximum_points: int,
  ) -> str:
    identity = str(artifact.get('sha256') or '').strip().lower()
    if not identity:
      path_value = artifact.get('stored_path') or artifact.get('local_path')
      if path_value:
        try:
          path = self._stored_path(record, artifact)
          stat = path.stat()
          identity = f'{path.as_posix()}:{stat.st_size}:{stat.st_mtime_ns}'
        except OSError:
          identity = str(path_value)
      else:
        identity = str(artifact.get('url') or artifact.get('name') or '')
    return (
      f"{record.get('release_key') or ''}|{identity}|"
      f"{float(bucket_size):.3f}|{int(maximum_points)}"
    )

  @staticmethod
  def _build_xyz_bucket_index(
    lines: Iterable[str],
    *,
    maximum_points: int,
    bucket_size: float,
  ) -> Dict[str, Any]:
    buckets: Dict[tuple[int, int], list[tuple[float, float, float]]] = {}
    scanned = 0
    for line in lines:
      if scanned >= maximum_points:
        break
      parts = ProductionPublicationService._xyz_parts(line)
      if len(parts) < 3:
        continue
      try:
        point_x, point_y, point_z = map(float, parts[:3])
      except ValueError:
        continue
      scanned += 1
      key = (
        math.floor(point_x / bucket_size),
        math.floor(point_y / bucket_size),
      )
      buckets.setdefault(key, []).append((point_x, point_y, point_z))
    return {
      'bucket_size': float(bucket_size),
      'buckets': buckets,
      'scanned': scanned,
    }

  @staticmethod
  def _nearest_xyz_targets_from_index(
    index: Dict[str, Any],
    targets: list[Dict[str, Any]],
    *,
    maximum_distance: float,
  ) -> list[Optional[Dict[str, Any]]]:
    bucket_size = float(index.get('bucket_size') or 5.0)
    buckets = index.get('buckets') or {}
    scanned = int(index.get('scanned') or 0)
    maximum_squared = float(maximum_distance) ** 2
    found: list[Optional[Dict[str, Any]]] = []
    for target in targets:
      target_x = float(target['x'])
      target_y = float(target['y'])
      center_x = math.floor(target_x / bucket_size)
      center_y = math.floor(target_y / bucket_size)
      nearest: Optional[tuple[float, float, float]] = None
      nearest_squared = math.inf
      for offset_x in (-1, 0, 1):
        for offset_y in (-1, 0, 1):
          candidates = buckets.get(
            (center_x + offset_x, center_y + offset_y),
            (),
          )
          for point in candidates:
            distance_squared = (
              (point[0] - target_x) ** 2
              + (point[1] - target_y) ** 2
            )
            if distance_squared < nearest_squared:
              nearest = point
              nearest_squared = distance_squared
      if nearest is None or nearest_squared > maximum_squared:
        found.append(None)
        continue
      found.append(
        {
          'x': nearest[0],
          'y': nearest[1],
          'z': nearest[2],
          'srid': int(target.get('srid', 25832)),
          'distance_m': round(math.sqrt(nearest_squared), 3),
          'scanned_points': scanned,
        }
      )
    return found

  @staticmethod
  def _nearest_xyz_targets(
    lines: Iterable[str],
    targets: list[Dict[str, Any]],
    *,
    maximum_points: int,
    maximum_distance: float,
  ) -> list[Optional[Dict[str, Any]]]:
    bucket_size = max(5.0, float(maximum_distance) or 5.0)
    index = ProductionPublicationService._build_xyz_bucket_index(
      lines,
      maximum_points=maximum_points,
      bucket_size=bucket_size,
    )
    return ProductionPublicationService._nearest_xyz_targets_from_index(
      index,
      targets,
      maximum_distance=maximum_distance,
    )

  @staticmethod
  def _nearest_xyz_lines(
    lines: Iterable[str],
    target_x: float,
    target_y: float,
    maximum_points: int,
  ) -> Optional[Dict[str, Any]]:
    nearest = None
    nearest_distance_squared = math.inf
    scanned = 0
    for line in lines:
      if scanned >= maximum_points:
        break
      parts = ProductionPublicationService._xyz_parts(line)
      if len(parts) < 3:
        continue
      try:
        point_x, point_y, point_z = map(float, parts[:3])
      except ValueError:
        continue
      scanned += 1
      distance_squared = (point_x - target_x) ** 2 + (point_y - target_y) ** 2
      if distance_squared >= nearest_distance_squared:
        continue
      nearest_distance_squared = distance_squared
      nearest = {
        'x': point_x,
        'y': point_y,
        'z': point_z,
        'srid': 25832,
        'distance_m': round(math.sqrt(distance_squared), 3),
      }
      if distance_squared == 0:
        break
    if nearest is not None:
      nearest['scanned_points'] = scanned
    return nearest

  @staticmethod
  def _xyz_parts(line: str) -> list[str]:
    text = str(line).strip()
    if ';' in text:
      return [part.replace(',', '.') for part in text.split(';')]
    parts = text.split()
    return [part.replace(',', '.') for part in parts] if len(parts) >= 3 else text.split(',')

  @staticmethod
  def _terrain_artifact_srid(artifact: Dict[str, Any]) -> int:
    source = str(artifact.get('source_url') or '')
    name = str(artifact.get('name') or '')
    if (urlsplit(source).hostname == 'gdi.berlin.de' and '/data/dgm1/' in source) or re.search(r'dgm\d?[_-]33[_-]', name, re.I):
      return 25833
    return 25832

  @staticmethod
  def _terrain_artifact_width_km(artifact: Dict[str, Any]) -> int:
    source = str(artifact.get('source_url') or '')
    if urlsplit(source).hostname == 'gdi.berlin.de' and '/data/dgm1/' in source:
      return 2
    match = re.search(r'dgm\d?[_-](?:32|33)[_-]\d{3}[_-]\d{4}[_-]([12])(?:[_-]|\.)', str(artifact.get('name') or ''), re.I)
    return int(match.group(1)) if match else 1

  @classmethod
  def _coordinate_file_index(
    cls,
    record: Dict[str, Any],
  ) -> Dict[tuple[int, int], list[Dict[str, Any]]]:
    pattern = re.compile(r'(?<!\d)(\d{3})[_-](\d{4})(?!\d)')
    index: Dict[tuple[int, int], list[Dict[str, Any]]] = {}
    for artifact_index, item in enumerate(record.get('files') or record.get('artifacts') or []):
      if not isinstance(item, dict):
        continue
      name = str(item.get('name') or '')
      match = pattern.search(Path(name).name)
      if not match:
        continue
      item_x, item_y = int(match.group(1)), int(match.group(2))
      span = cls._terrain_artifact_width_km(item)
      srid = cls._terrain_artifact_srid(item)
      entry = {
        'artifact': item,
        'rank': 0 if Path(name).suffix.lower() in {'.zip', '.xyz', '.txt', '.csv'} else 1,
        'index': artifact_index,
        'tile': {
          'id': f'{item_x}_{item_y}',
          'srid': srid,
          'bbox': [item_x * 1000, item_y * 1000, (item_x + span) * 1000, (item_y + span) * 1000],
        },
      }
      for dx in range(span):
        for dy in range(span):
          index.setdefault((item_x + dx, item_y + dy), []).append(entry)
    for entries in index.values():
      entries.sort(key=lambda item: (item['rank'], -item['index']))
    return index

  @classmethod
  def _terrain_target(cls, index, *, lat=None, lon=None, x=None, y=None, srid=25832):
    # A release can contain both German UTM zones. Select in the CRS belonging
    # to each source tile; never apply UTM32 coordinates to Berlin UTM33 data.
    candidates = sorted({entry['tile']['srid'] for entries in index.values() for entry in entries}) if lat is not None else [srid]
    fallback = None
    for candidate in candidates or [srid]:
      px, py = cls._wgs84_to_utm32(lat, lon, candidate) if lat is not None else (x, y)
      matches = [entry for entry in index.get((math.floor(px / 1000), math.floor(py / 1000)), []) if entry['tile']['srid'] == candidate]
      result = (px, py, candidate, matches)
      if matches:
        return result
      fallback = fallback or result
    return fallback

  @classmethod
  def _matching_coordinate_files(
    cls,
    record: Dict[str, Any],
    x: float,
    y: float,
  ) -> list[Dict[str, Any]]:
    key = (math.floor(x / 1000.0), math.floor(y / 1000.0))
    return list(cls._coordinate_file_index(record).get(key, []))

  @classmethod
  def _coordinate_filter(
    cls,
    *,
    latitude: Any,
    longitude: Any,
    x: Any,
    y: Any,
    radius_m: Any,
    tolerance: Any,
  ) -> Optional[Dict[str, Any]]:
    lat = cls._optional_float(latitude)
    lon = cls._optional_float(longitude)
    projected_x = cls._optional_float(x)
    projected_y = cls._optional_float(y)
    if (lat is None) != (lon is None):
      raise ProductionPublicationError(
        "lat und lon muessen gemeinsam angegeben werden.",
        code="coordinate_pair_incomplete",
      )
    if (projected_x is None) != (projected_y is None):
      raise ProductionPublicationError(
        "x und y muessen gemeinsam angegeben werden.",
        code="coordinate_pair_incomplete",
      )
    if lat is not None:
      return {
        "mode": "geographic",
        "latitude": lat,
        "longitude": lon,
        "radius_m": max(0.0, cls._optional_float(radius_m) or 5.0),
      }
    if projected_x is not None:
      return {
        "mode": "projected",
        "x": projected_x,
        "y": projected_y,
        "tolerance": max(0.0, cls._optional_float(tolerance) or 0.0),
      }
    return None

  @classmethod
  def _matches_coordinate(cls, row: Dict[str, Any], target: Dict[str, Any]) -> bool:
    lowered = {str(key).casefold(): value for key, value in row.items()}
    geometry = row.get("geometry") if isinstance(row.get("geometry"), dict) else {}
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if target["mode"] == "geographic":
      lat = cls._first_float(lowered, ("lat", "latitude", "breitengrad"))
      lon = cls._first_float(lowered, ("lon", "lng", "longitude", "laengengrad"))
      if (lat is None or lon is None) and isinstance(coordinates, list) and len(coordinates) >= 2:
        lon = cls._optional_float(coordinates[0])
        lat = cls._optional_float(coordinates[1])
      if lat is None or lon is None:
        return False
      phi1 = math.radians(float(target["latitude"]))
      phi2 = math.radians(lat)
      delta_phi = math.radians(lat - float(target["latitude"]))
      delta_lambda = math.radians(lon - float(target["longitude"]))
      value = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
      distance = 2 * 6371000.0 * math.asin(min(1.0, math.sqrt(value)))
      return distance <= float(target["radius_m"])
    point_x = cls._first_float(lowered, ("x", "easting", "rechtswert"))
    point_y = cls._first_float(lowered, ("y", "northing", "hochwert"))
    if (point_x is None or point_y is None) and isinstance(coordinates, list) and len(coordinates) >= 2:
      point_x = cls._optional_float(coordinates[0])
      point_y = cls._optional_float(coordinates[1])
    if point_x is None or point_y is None:
      return False
    tolerance_value = float(target["tolerance"])
    return abs(point_x - float(target["x"])) <= tolerance_value and abs(point_y - float(target["y"])) <= tolerance_value

  @classmethod
  def _first_float(cls, values: Dict[str, Any], aliases: Iterable[str]) -> Optional[float]:
    for alias in aliases:
      value = cls._optional_float(values.get(alias))
      if value is not None:
        return value
    return None

  @staticmethod
  def _optional_float(value: Any) -> Optional[float]:
    try:
      return float(str(value).replace(",", ".")) if value is not None and str(value).strip() else None
    except (TypeError, ValueError):
      return None
  @staticmethod
  def _row_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
      return {str(key): item for key, item in value.items()}
    if isinstance(value, list):
      return {str(index): item for index, item in enumerate(value)}
    return {"value": value}

  @staticmethod
  def _sha256_path(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
      for block in iter(lambda: handle.read(4 * 1024 * 1024), b""):
        digest.update(block)
    return digest.hexdigest()
  @staticmethod
  def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
      value = json.loads(path.read_text(encoding="utf-8"))
      return value if isinstance(value, dict) else None
    except (OSError, ValueError, TypeError):
      return None

  @staticmethod
  def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    temporary.write_text(
      json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
      encoding="utf-8",
      newline="\n",
    )
    os.replace(temporary, path)

  @staticmethod
  def _unique_name(name: str, used: set[str]) -> str:
    candidate = name
    path = Path(name)
    index = 2
    while candidate.lower() in used:
      candidate = f"{path.stem}-{index}{path.suffix}"
      index += 1
    used.add(candidate.lower())
    return candidate

  @staticmethod
  def _optional_nonnegative_int(value: Any) -> Optional[int]:
    try:
      number = int(value)
    except (TypeError, ValueError):
      return None
    return number if number >= 0 else None

  @staticmethod
  def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

