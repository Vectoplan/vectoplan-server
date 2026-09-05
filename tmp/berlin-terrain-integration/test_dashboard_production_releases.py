from extensions import db
import src.services.production_releases as production_releases

from models import Project
from src.services.production_releases import (
    _artifact_name,
    _collect_artifacts,
    _job_geospatial_formats,
    _is_geospatial_artifact,
    _ensure_release_requested,
    _publication_profile,
)


def test_collect_artifacts_only_keeps_unique_persisted_data():
    runs = [
        {
            "status": "COMPLETED",
            "steps": [
                {
                    "output_references": [
                        {"ref": "s3://vectoplan-raw/sha256/a", "kind": "raw"},
                        {"ref": "s3://vectoplan-raw/sha256/a", "kind": "raw"},
                        {"ref": "s3://vectoplan-raw/sha256/meta", "kind": "execution_metadata"},
                    ]
                }
            ],
        },
        {"status": "RUNNING", "steps": [{"output_references": [{"ref": "s3://vectoplan-raw/sha256/b"}]}]},
    ]

    assert [item["ref"] for item in _collect_artifacts(runs)] == [
        "s3://vectoplan-raw/sha256/a"
    ]


def test_geo_artifact_detection_and_safe_name():
    artifact = {
        "ref": "s3://vectoplan-raw/sha256/abc",
        "sha256": "abcdef1234567890",
        "media_type": "application/geo+json",
        "metadata": {"original_url": "https://example.test/export/Gel%C3%A4nde.geojson?download=1"},
    }

    assert _is_geospatial_artifact(artifact) is True
    assert _artifact_name(artifact, 1) == "Gelande-abcdef1234.geojson"


def test_non_geo_csv_gets_inferred_extension():
    artifact = {
        "ref": "s3://vectoplan-raw/sha256/csv",
        "media_type": "text/csv",
        "metadata": {"original_url": "https://example.test/download"},
    }

    assert _is_geospatial_artifact(artifact) is False
    assert _artifact_name(artifact, 2) == "download.csv"

def test_publication_profile_routes_terrain_and_citygml_to_file_collections():
    terrain = {
        "media_type": "text/plain",
        "metadata": {"original_url": "https://example.test/dgm/123.xyz"},
    }
    city_model = {
        "media_type": "application/gml+xml",
        "metadata": {"original_url": "https://example.test/lod2/model.citygml"},
    }

    assert _publication_profile({"XYZ"}, [terrain], True) == "raster"
    assert _publication_profile({"CityGML"}, [city_model], True) == "city_model"


def test_publication_profile_keeps_vector_data_in_wfs_pipeline():
    vector = {
        "media_type": "application/geo+json",
        "metadata": {"original_url": "https://example.test/parcels.geojson"},
    }

    assert _publication_profile({"GeoJSON"}, [vector], True) == "vector"


def test_berlin_dgm_archive_preserves_terrain_profile_without_llm():
    artifact = {
        "media_type": "application/zip",
        "metadata": {"original_url": "https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5818.zip"},
    }
    assert _publication_profile(set(), [artifact], False) == "terrain"
    assert _publication_profile({"XYZ"}, [artifact], True) == "terrain"

def test_release_request_is_persisted_before_data_is_ready(app):
    with app.app_context():
        project = Project(name="Wartendes Projekt")
        db.session.add(project)
        db.session.commit()

        _ensure_release_requested(project)

        release = db.session.get(Project, project.id).metadata_json["production_release"]
        assert release["eligible"] is True
        assert release["auto_update"] is True
        assert release["integration_status"] == "REQUESTED"


def test_direct_download_job_detects_dgm_xyz_without_llm():
    jobs = [
        {
            "input_reference": {
                "url": "https://geodaten.bayern.de/odd/a/dgm/dgm5xyz/meta/metalink/09.meta4"
            }
        }
    ]


def test_partial_release_is_reused_only_for_same_reference_version(monkeypatch):
    release = {
        "partial": True,
        "dataset_id": "terrain",
        "release_key": "version-a",
    }
    publication = {
        "status": "published",
        "storage_mode": "reference",
    }
    monkeypatch.setattr(
        production_releases,
        "_get_geoserver_publication",
        lambda dataset_id, release_key: publication,
    )

    assert production_releases._defer_to_existing_partial(
        release,
        active=True,
        current_release_key="version-a",
    ) == publication
    assert production_releases._defer_to_existing_partial(
        release,
        active=True,
        current_release_key="version-b",
    ) is None

    publication["storage_mode"] = "local"
    assert production_releases._defer_to_existing_partial(
        release,
        active=True,
        current_release_key="version-a",
    ) is None
