from pathlib import Path
from types import SimpleNamespace
from zipfile import ZipFile

import pytest

from src.publications.raster_service import RasterPublicationService
from src.publications.service import ProductionPublicationError, ProductionPublicationService


class TestConfig:
  PRODUCTION_PUBLICATION_ALLOWED_SOURCE_HOSTS = ("host.docker.internal",)
  NONSPATIAL_QUERY_MAX_JSON_BYTES = 1024 * 1024
  INGESTION_DOWNLOAD_CONNECT_TIMEOUT_SECONDS = 1
  INGESTION_DOWNLOAD_READ_TIMEOUT_SECONDS = 1
  GEOSERVER_INTERNAL_BASE_URL = "http://geoserver:8080/geoserver"
  GEOSERVER_REST_BASE_URL = "http://geoserver:8080/geoserver/rest"
  GEOSERVER_PUBLIC_BASE_URL = "http://localhost:5182/geoserver"
  GEOSERVER_USERNAME = "admin"
  GEOSERVER_PASSWORD = "test"
  GEOSERVER_REQUEST_TIMEOUT_SECONDS = 1
  SERVICE_PUBLIC_BASE_URL = "http://localhost:5110"

  @staticmethod
  def sanitize_dataset_id(value):
    return "-".join(
      part for part in "".join(char.lower() if char.isalnum() else "-" for char in value).split("-") if part
    )


def service(tmp_path: Path) -> ProductionPublicationService:
  TestConfig.UPLOAD_ROOT_DIR = str(tmp_path)
  return ProductionPublicationService(TestConfig, ingestion_service=object())


def payload():
  return {
    "release_key": "a" * 64,
    "project_id": "project-1",
    "project_name": "Interne Daten",
    "kind": "non_spatial",
    "artifacts": [
      {
        "name": "werte.csv",
        "url": "http://host.docker.internal:8080/api/internal/publications/artifacts/signed",
        "size_bytes": 20,
        "sha256": None,
        "media_type": "text/csv",
      }
    ],
  }


def test_non_spatial_publication_is_durable_and_hides_source_url(tmp_path):
  publications = service(tmp_path)

  result = publications.publish(payload())

  assert result["dataset_id"] == "interne-daten"
  assert result["status"] == "published"
  assert result["storage_mode"] == "reference"
  assert result["files"][0]["download_url"]
  assert "url" not in result["files"][0]
  assert (tmp_path / ".production-publications/non-spatial/interne-daten/publication.json").is_file()



def test_batch_metalink_uses_public_orchestrator_download_urls(tmp_path):
  publications = service(tmp_path)
  created = publications.publish(payload())

  metalink = publications.batch_metalink(
    created["dataset_id"],
    release_key=created["release_key"],
  ).decode("utf-8")

  assert "http://localhost:5110/admin/api/production-publications/" in metalink
  assert "host.docker.internal" not in metalink

def test_publication_rejects_arbitrary_download_hosts(tmp_path):
  publications = service(tmp_path)
  invalid = payload()
  invalid["artifacts"][0]["url"] = "https://example.org/data.csv"

  with pytest.raises(ProductionPublicationError):
    publications.publish(invalid)


def test_standard_query_filters_csv_rows(tmp_path):
  publications = service(tmp_path)
  record_path = tmp_path / ".production-publications/non-spatial/interne-daten/publication.json"
  file_path = record_path.parent / "files" / ("a" * 64) / "werte.csv"
  file_path.parent.mkdir(parents=True)
  file_path.write_text("ort,wert\nBerlin,12\nBonn,7\n", encoding="utf-8")
  record = {
    **payload(),
    "dataset_id": "interne-daten",
    "status": "published",
    "files": [
      {
        "name": "werte.csv",
        "stored_path": file_path.relative_to(record_path.parent).as_posix(),
        "queryable": True,
        "size_bytes": file_path.stat().st_size,
      }
    ],
  }
  publications._atomic_write_json(record_path, record)

  result = publications.query("interne-daten", field="ort", value="ber", limit=10)

  assert result["items"] == [{"ort": "Berlin", "wert": "12"}]
  assert result["has_more"] is False

def test_coordinate_query_explains_usage_and_returns_dgm_height(tmp_path):
  publications = service(tmp_path)
  candidate = payload()
  candidate.update({
    'project_name': 'DGM Test',
    'kind': 'file_collection',
    'publication_profile': 'raster',
    'detected_formats': ['XYZ'],
  })
  candidate['artifacts'][0].update({
    'name': '579_5490-test.zip',
    'media_type': 'application/zip',
  })
  created = publications.publish(candidate)
  record_path = (
    tmp_path / '.production-publications/non-spatial/dgm-test/publication.json'
  )
  archive_path = record_path.parent / 'files' / 'dgm-tile.zip'
  archive_path.parent.mkdir(parents=True)
  with ZipFile(archive_path, 'w') as archive:
    archive.writestr(
      '579_5490.txt',
      '579002.50 5490997.50 296.70\n'
      '579007.50 5490997.50 296.56\n'
      '579012.50 5490997.50 296.44\n',
    )
  record = publications._read_json(record_path)
  record['files'][0].update({
    'stored_path': archive_path.relative_to(record_path.parent).as_posix(),
    'size_bytes': archive_path.stat().st_size,
  })
  publications._atomic_write_json(record_path, record)
  publications.approve_file_collection(
    created['dataset_id'],
    release_key=created['release_key'],
  )

  help_result = publications.coordinate_query(created['dataset_id'])
  result = publications.coordinate_query(
    created['dataset_id'],
    x=579007.5,
    y=5490997.5,
  )

  assert help_result['help'] is True
  assert 'projected' in help_result['examples']
  assert result['found'] is True
  assert result['result']['value'] == 296.56
  assert result['result']['point']['distance_m'] == 0.0
  assert result['result']['source_file']['tile']['id'] == '579_5490'


def test_wgs84_coordinates_are_transformed_to_utm32():
  x, y = ProductionPublicationService._wgs84_to_utm32(48.137154, 11.576124)

  assert 691_000 < x < 692_500
  assert 5_332_000 < y < 5_335_000


def test_coordinate_batch_reads_one_dgm_tile_for_multiple_points(tmp_path):
  publications = service(tmp_path)
  candidate = payload()
  candidate.update({
    'project_name': 'DGM Batch',
    'kind': 'file_collection',
    'publication_profile': 'raster',
    'detected_formats': ['XYZ'],
  })
  candidate['artifacts'][0].update({
    'name': '579_5490-batch.zip',
    'media_type': 'application/zip',
  })
  created = publications.publish(candidate)
  record_path = (
    tmp_path / '.production-publications/non-spatial/dgm-batch/publication.json'
  )
  archive_path = record_path.parent / 'files' / 'dgm-batch.zip'
  archive_path.parent.mkdir(parents=True)
  with ZipFile(archive_path, 'w') as archive:
    archive.writestr(
      '579_5490.xyz',
      '579002.50 5490997.50 296.70\n'
      '579007.50 5490997.50 296.56\n'
      '579012.50 5490997.50 296.44\n',
    )
  record = publications._read_json(record_path)
  record['files'][0].update({
    'stored_path': archive_path.relative_to(record_path.parent).as_posix(),
    'size_bytes': archive_path.stat().st_size,
  })
  publications._atomic_write_json(record_path, record)
  publications.approve_file_collection(
    created['dataset_id'],
    release_key=created['release_key'],
  )
  serving = publications.prepare_terrain_serving(
    created['dataset_id'],
    release_key=created['release_key'],
    background=False,
  )

  schema = publications.coordinate_query_schema(created['dataset_id'])
  result = publications.coordinate_batch_query(
    created['dataset_id'],
    points=[
      {'id': 'a', 'x': 579002.5, 'y': 5490997.5, 'srid': 25832},
      {'id': 'b', 'x': 579007.5, 'y': 5490997.5, 'srid': 25832},
      {'id': 'c', 'x': 579012.5, 'y': 5490997.5, 'srid': 25832},
    ],
  )

  assert schema['release_key'] == created['release_key']
  assert serving['status'] == 'complete'
  assert serving['totalFiles'] == 1
  assert serving['preparedFiles'] == 1
  assert serving['rawDataDuplicated'] is False
  assert schema['terrain_serving']['status'] == 'complete'
  assert result['release_key'] == created['release_key']
  assert result['counts'] == {
    'requested': 3,
    'found': 3,
    'missing': 0,
    'source_files_read': 1,
  }
  assert [item['value'] for item in result['items']] == [296.70, 296.56, 296.44]
  assert all(
    item['point']['serving_prepared'] is True
    for item in result['items']
  )


def test_geospatial_publication_rejects_raster_only_dataset(tmp_path):
  publications = service(tmp_path)
  invalid = payload()
  invalid.update(
    {
      "project_name": "DGM Raster",
      "kind": "geospatial",
      "detected_formats": ["GeoTIFF"],
    }
  )
  invalid["artifacts"][0].update(
    {
      "name": "dgm5.tif",
      "media_type": "image/tiff",
    }
  )

  with pytest.raises(ProductionPublicationError) as error:
    publications.publish(invalid)

  assert error.value.code == "dataset_not_wfs_compatible"


def test_publication_urls_are_read_from_ingestion_catalog():
  job = SimpleNamespace(
    result_payload={
      "sync": {
        "catalog_entry": {
          "urls": {
            "wfs_url": "http://localhost:8082/geoserver/public/wfs",
            "capabilities_url": "http://localhost:8082/geoserver/public/wfs?service=WFS",
          }
        }
      }
    }
  )

  urls = ProductionPublicationService._publication_urls(job)

  assert urls["wfs_url"].endswith("/public/wfs")

@pytest.mark.parametrize(
  ("profile", "name", "media_type"),
  [
    ("raster", "dgm5.xyz", "text/plain"),
    ("city_model", "lod2.citygml", "application/gml+xml"),
  ],
)
def test_file_collection_accepts_geodata_formats(tmp_path, profile, name, media_type):
  publications = service(tmp_path)
  candidate = payload()
  candidate.update(
    {
      "project_name": "Breite Geodaten",
      "kind": "file_collection",
      "publication_profile": profile,
      "detected_formats": [profile],
    }
  )
  candidate["artifacts"][0].update(
    {
      "name": name,
      "media_type": media_type,
    }
  )

  result = publications.publish(candidate)

  assert result["status"] == "published"
  assert result["storage_mode"] == "reference"
  assert result["publication_profile"] == profile
  assert result["delivery_services"] == ["DOWNLOAD"]


def test_partial_approved_raster_snapshot_can_be_queued(tmp_path):
  publications = service(tmp_path)
  candidate = payload()
  candidate.update(
    {
      "kind": "file_collection",
      "project_name": "DGM Snapshot",
      "publication_profile": "raster",
      "detected_formats": ["XYZ"],
      "partial": True,
    }
  )
  candidate["artifacts"][0].update(
    {"name": "dgm.xyz", "media_type": "text/plain"}
  )
  created = publications.publish(candidate)
  publications.approve_file_collection(
    created["dataset_id"],
    release_key=created["release_key"],
  )

  state = publications.request_raster_import(
    created["dataset_id"],
    release_key=created["release_key"],
  )

  assert state["status"] == "queued"
  assert "Snapshot" in state["message"]


def test_transient_raster_sources_are_removed(tmp_path):
  TestConfig.PRODUCTION_RASTER_WORK_DIR = str(tmp_path / "raster-work")
  TestConfig.PRODUCTION_RASTER_DATA_DIR = str(tmp_path / "raster-data")
  raster = RasterPublicationService(config_cls=TestConfig)
  record = {
    "dataset_id": "DGM Snapshot",
    "release_key": "a" * 64,
  }
  source_dir = (
    Path(TestConfig.PRODUCTION_RASTER_WORK_DIR)
    / "dgm-snapshot"
    / ("a" * 64)
    / "sources"
  )
  source_dir.mkdir(parents=True)
  transient = source_dir / "tile.zip"
  transient.write_bytes(b"temporary")

  raster.cleanup_record_sources(record)

  assert not transient.exists()


def test_file_collection_approval_is_release_specific_and_keeps_previous_release(tmp_path):
  publications = service(tmp_path)
  first = payload()
  first.update(
    {
      "kind": "file_collection",
      "project_name": "DGM Freigabe",
      "publication_profile": "raster",
      "detected_formats": ["XYZ"],
    }
  )
  first["artifacts"][0].update(
    {"name": "dgm-a.xyz", "media_type": "text/plain", "size_bytes": 3}
  )
  created = publications.publish(first)
  record_path = tmp_path / ".production-publications/non-spatial/dgm-freigabe/publication.json"
  record = publications._read_json(record_path)
  stored = record_path.parent / "files/objects/dgm-a.xyz"
  stored.parent.mkdir(parents=True)
  stored.write_bytes(b"123")
  record["files"][0].update(
    {
      "stored_path": stored.relative_to(record_path.parent).as_posix(),
      "downloaded_bytes": 3,
    }
  )
  record["status"] = "published"
  publications._atomic_write_json(record_path, record)

  approved = publications.approve_file_collection(
    "dgm-freigabe",
    release_key=created["release_key"],
    approved_by={"id": 7, "email": "admin@example.test"},
  )

  assert approved["approval"]["current_release_approved"] is True
  assert approved["approval"]["approved_by"]["id"] == "7"
  assert f"release_key={created['release_key']}" in approved["files"][0]["download_url"]

  second = payload()
  second.update(
    {
      "release_key": "b" * 64,
      "kind": "file_collection",
      "project_name": "DGM Freigabe",
      "publication_profile": "raster",
      "detected_formats": ["XYZ"],
    }
  )
  second["artifacts"][0].update(
    {"name": "dgm-b.xyz", "media_type": "text/plain", "size_bytes": 4}
  )
  publications.publish(second)

  current = publications.list_non_spatial()[0]
  central = publications.list_approved_file_collections()[0]
  assert current["release_key"] == "b" * 64
  assert current["approval"]["current_release_approved"] is False
  assert current["approval"]["has_approved_release"] is True
  assert central["release_key"] == "a" * 64

  completed_old_release = publications._read_json(
    record_path.parent / "approved-publication.json"
  )
  completed_old_release["error"] = "old release completed after update"
  publications._persist_processed_record(record_path, completed_old_release)
  assert publications._read_json(record_path)["release_key"] == "b" * 64
  assert publications._read_json(record_path.parent / "approved-publication.json")["error"] == "old release completed after update"

  assert publications.download_path(
    "dgm-freigabe",
    "dgm-a.xyz",
    release_key="a" * 64,
  )[0] == stored

  with pytest.raises(ProductionPublicationError) as error:
    publications.approve_file_collection("dgm-freigabe", release_key="a" * 64)
  assert error.value.code == "stale_release_approval"


def test_release_can_be_rejected_with_reason_and_reapproved(tmp_path):
  publications = service(tmp_path)
  candidate = payload()
  candidate.update(
    {
      "kind": "file_collection",
      "project_name": "DGM Review",
      "publication_profile": "raster",
      "detected_formats": ["XYZ"],
    }
  )
  created = publications.publish(candidate)
  dataset_id = created["dataset_id"]
  release_key = created["release_key"]

  approved = publications.approve_file_collection(
    dataset_id,
    release_key=release_key,
    approved_by={"id": "admin-1"},
  )
  assert approved["review"]["decision"] == "approved"
  assert [item["dataset_id"] for item in publications.list_approved_file_collections()] == [
    dataset_id
  ]

  rejected = publications.reject_file_collection(
    dataset_id,
    release_key=release_key,
    reason="H?henbezug muss vor Ver?ffentlichung gepr?ft werden.",
    rejected_by={"id": "admin-2"},
  )
  assert rejected["approval"]["current_release_approved"] is False
  assert rejected["review"]["decision"] == "rejected"
  assert rejected["review"]["reason"].startswith("H?henbezug")
  assert publications.list_approved_file_collections() == []

  approved_again = publications.approve_file_collection(
    dataset_id,
    release_key=release_key,
    approved_by={"id": "admin-3"},
  )
  assert approved_again["approval"]["current_release_approved"] is True
  assert approved_again["review"]["decision"] == "approved"

  with pytest.raises(ProductionPublicationError) as missing_reason:
    publications.reject_file_collection(
      dataset_id,
      release_key=release_key,
      reason="",
    )
  assert missing_reason.value.code == "release_rejection_reason_required"

  with pytest.raises(ProductionPublicationError) as stale:
    publications.reject_file_collection(
      dataset_id,
      release_key="f" * 64,
      reason="Veralteter Release",
    )
  assert stale.value.code == "stale_release_rejection"
