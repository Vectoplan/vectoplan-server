from zipfile import ZipFile

import pytest

from test_production_publications import payload, service
from src.publications.service import ProductionPublicationService


def test_berlin_utm33_two_km_tile_is_served_across_both_kilometres(tmp_path):
  publications = service(tmp_path)
  candidate = payload()
  candidate.update(project_name='Berlin Terrain', kind='file_collection', publication_profile='terrain')
  candidate['artifacts'][0].update(
    name='DGM1_390_5818-test.zip', media_type='application/zip',
    source_url='https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5818.zip',
  )
  created = publications.publish(candidate)
  record_path = tmp_path / '.production-publications/non-spatial/berlin-terrain/publication.json'
  archive_path = record_path.parent / 'files/berlin.zip'
  archive_path.parent.mkdir(parents=True)
  with ZipFile(archive_path, 'w') as archive:
    archive.writestr('dgm1_33_390_5818_2_be.xyz',
      '390000.5 5818000.5 36.83\n391000.5 5818000.5 37.42\n'
      '390000.5 5819000.5 38.17\n391000.5 5819000.5 42.65\n')
  record = publications._read_json(record_path)
  record['files'][0]['stored_path'] = archive_path.relative_to(record_path.parent).as_posix()
  publications._atomic_write_json(record_path, record)
  publications.approve_file_collection(created['dataset_id'], release_key=created['release_key'])
  prepared = publications.prepare_terrain_serving(created['dataset_id'], background=False)
  assert prepared['preparedFiles'] == 1
  result = publications.coordinate_batch_query(created['dataset_id'], points=[
    {'id': 'south', 'x': 390000.5, 'y': 5818000.5, 'srid': 25833},
    {'id': 'north-east', 'x': 391000.5, 'y': 5819000.5, 'srid': 25833},
  ])
  assert result['counts']['found'] == 2
  assert [item['value'] for item in result['items']] == [36.83, 42.65]
  assert all(item['point']['srid'] == 25833 for item in result['items'])
  assert all(item['normalized_coordinates']['srid'] == 25833 for item in result['items'])
  single = publications.coordinate_query(created['dataset_id'], x=391000.5, y=5819000.5, srid=25833)
  assert single['result']['value'] == 42.65
  assert single['result']['source_file']['tile']['bbox'] == [390000, 5818000, 392000, 5820000]
  assert publications.coordinate_batch_query(created['dataset_id'], points=[
    {'x': 391000.5, 'y': 5819000.5, 'srid': 25832},
  ])['counts']['found'] == 0


def test_berlin_wgs84_uses_utm33_source_projection():
  index = ProductionPublicationService._coordinate_file_index({'files': [{
    'name': 'DGM1_390_5820.zip',
    'source_url': 'https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5820.zip',
  }]})
  x, y, srid, matches = ProductionPublicationService._terrain_target(index, lat=52.52, lon=13.405)
  assert srid == 25833
  assert 391770 < x < 391790
  assert 5820060 < y < 5820090
  assert len(matches) == 1


def test_xyz_csv_and_point_limit_do_not_silently_truncate():
  parsed = ProductionPublicationService._xyz_points_from_bytes(
    b'x;y;z\n390000,5;5818000,5;36,83\n391000,5;5819000,5;42,65',
    suffix='.csv', maximum_points=2,
  )
  assert parsed[-1] == (391000.5, 5819000.5, 42.65)
  with pytest.raises(ValueError, match='Punktgrenze'):
    ProductionPublicationService._xyz_points_from_bytes(
      b'1 2 3\n4 5 6\n7 8 9', suffix='.xyz', maximum_points=2,
    )
