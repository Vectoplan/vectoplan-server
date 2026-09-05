import json
from config import Config
from src.publications.service import ProductionPublicationService

service = ProductionPublicationService(Config, ingestion_service=object())
record = service.get_non_spatial('digitales-gelaendemodell-5m')
result = []
for artifact in record['files']:
    tile = service._read_terrain_serving_tile(record, artifact)
    header = tile['header']
    values = tile['values']
    valid = [value for value in values if value != header['nodata']]
    result.append({
        'name': artifact['name'], 'sha256': artifact['sha256'],
        'srid': header['srid'], 'width': header['width'], 'height': header['height'],
        'points': header['pointCount'], 'min_m': min(valid)*header['valueScale'],
        'max_m': max(valid)*header['valueScale'],
    })
print(json.dumps(result))
