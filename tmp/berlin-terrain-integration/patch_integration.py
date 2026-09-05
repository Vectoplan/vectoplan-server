from pathlib import Path

root = Path(__file__).parent
p = root / 'production_releases.py'
s = p.read_text(encoding='utf-8')
s = s.replace('    runs = _latest_release_runs(all_runs)\n', '''    runs = _latest_release_runs(all_runs)
    # The list endpoint returns summaries. Immutable artifact manifests live on
    # run details and must be loaded before collecting completed downloads.
    runs = [
        _request("GET", f"/api/v1/runs/{run['id']}")
        if not run.get("steps") and run.get("id") else run
        for run in runs
    ]
''')
s = s.replace('    format_tokens = {\n', '''    if artifacts and all(
        urlsplit(str((item.get("metadata") or {}).get("original_url") or "")).hostname == "gdi.berlin.de"
        and "/data/dgm1/" in str((item.get("metadata") or {}).get("original_url") or "")
        for item in artifacts
    ):
        return "terrain"
    format_tokens = {
''')
s = s.replace('            "name": _artifact_name(artifact, index),\n', '            "name": _artifact_name(artifact, index),\n            "source_url": str((artifact.get("metadata") or {}).get("original_url") or ""),\n')
p.write_text(s, encoding='utf-8')

p = root / 'service.py'
s = p.read_text(encoding='utf-8')
s = s.replace('          "url": url,\n', '          "url": url,\n          "source_url": str(item.get("source_url") or ""),\n')
s = s.replace("'COORDINATE_QUERY_MAX_XYZ_POINTS', 2_000_000", "'COORDINATE_QUERY_MAX_XYZ_POINTS', 4_100_000")
s = s.replace('if width * height > 2_000_000:', 'if width * height > 4_100_000:')
s = s.replace("{'.xyz', '.txt'}", "{'.xyz', '.txt', '.csv'}")
s = s.replace("{'.zip', '.xyz', '.txt'}", "{'.zip', '.xyz', '.txt', '.csv'}")
s = s.replace("parts = str(line).strip().replace(',', '.').split()", "parts = ProductionPublicationService._xyz_parts(line)")
s = s.replace("          break\n        parts = ProductionPublicationService._xyz_parts(line)", "          raise ValueError('Das XYZ-Höhenmodell überschreitet die konfigurierte Punktgrenze.')\n        parts = ProductionPublicationService._xyz_parts(line)")
s = s.replace('def _wgs84_to_utm32(latitude: float, longitude: float) -> tuple[float, float]:', 'def _wgs84_to_utm32(latitude: float, longitude: float, srid: int = 25832) -> tuple[float, float]:')
s = s.replace('central_meridian = math.radians(9.0)', "central_meridian = math.radians(15.0 if srid == 25833 else 9.0)")

start = s.index('  @staticmethod\n  def _coordinate_file_index(')
end = s.index('  @classmethod\n  def _matching_coordinate_files(', start)
s = s[:start] + '''  @staticmethod
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
    if (urlsplit(source).hostname == 'gdi.berlin.de' and '/data/dgm1/' in source) or re.search(r'dgm\\d?[_-]33[_-]', name, re.I):
      return 25833
    return 25832

  @staticmethod
  def _terrain_artifact_width_km(artifact: Dict[str, Any]) -> int:
    source = str(artifact.get('source_url') or '')
    if urlsplit(source).hostname == 'gdi.berlin.de' and '/data/dgm1/' in source:
      return 2
    match = re.search(r'dgm\\d?[_-](?:32|33)[_-]\\d{3}[_-]\\d{4}[_-]([12])(?:[_-]|\\.)', str(artifact.get('name') or ''), re.I)
    return int(match.group(1)) if match else 1

  @classmethod
  def _coordinate_file_index(
    cls,
    record: Dict[str, Any],
  ) -> Dict[tuple[int, int], list[Dict[str, Any]]]:
    pattern = re.compile(r'(?<!\\d)(\\d{3})[_-](\\d{4})(?!\\d)')
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

''' + s[end:]

# Resolve geographic inputs after reading the release and its source index.
s = s.replace('    normalized_points: list[Dict[str, Any]] = []\n', '''    release_key = str(publication.get('release_key') or '')
    record = self.get_non_spatial(dataset_id, release_key=release_key)
    coordinate_files = self._coordinate_file_index(record)
    normalized_points: list[Dict[str, Any]] = []
''')
s = s.replace('        projected_x, projected_y = self._wgs84_to_utm32(lat, float(lon))\n', "        projected_x, projected_y, target_srid, _ = self._terrain_target(coordinate_files, lat=lat, lon=float(lon))\n")
s = s.replace('or requested_srid != 25832:', 'or requested_srid not in {25832, 25833}:')
s = s.replace("f'points[{index}] benötigt lat/lon oder x/y in EPSG:25832.'", "f'points[{index}] benötigt lat/lon oder x/y in EPSG:25832/25833.'")
s = s.replace("supplied = {'x': projected_x, 'y': projected_y, 'srid': 25832}", "target_srid = requested_srid\n        supplied = {'x': projected_x, 'y': projected_y, 'srid': requested_srid}")
s = s.replace("          'input_coordinates': supplied,", "          'input_coordinates': supplied,\n          'srid': target_srid,")
s = s.replace("      if not matches:\n        results[target['index']]", "      matches = [entry for entry in matches if entry['tile']['srid'] == target['srid']]\n      if not matches:\n        results[target['index']]")
s = s.replace("        'srid': 25832,\n      },\n      'found': point is not None", "        'srid': target.get('srid', 25832),\n      },\n      'found': point is not None")
s = s.replace("      'srid': 25832,\n      'radius_m': maximum_distance,", "      'srid': normalized_points[0]['srid'] if len({item['srid'] for item in normalized_points}) == 1 else None,\n      'radius_m': maximum_distance,")
s = s.replace("    lat = self._optional_float(latitude)\n", "    release_key = str(publication.get('release_key') or '')\n    record = self.get_non_spatial(dataset_id, release_key=release_key)\n    coordinate_files = self._coordinate_file_index(record)\n    lat = self._optional_float(latitude)\n", 1)
s = s.replace("      projected_x, projected_y = self._wgs84_to_utm32(lat, float(lon))\n", "      projected_x, projected_y, target_srid, matches = self._terrain_target(coordinate_files, lat=lat, lon=float(lon))\n", 1)
s = s.replace("      if requested_srid != 25832:\n", "      if requested_srid not in {25832, 25833}:\n", 1)
s = s.replace("'x/y werden aktuell in EPSG:25832 erwartet. Fuer WGS84 bitte lat/lon verwenden.'", "'x/y werden in EPSG:25832/25833 erwartet. Fuer WGS84 bitte lat/lon verwenden.'")
s = s.replace("      input_coordinates = {'x': projected_x, 'y': projected_y, 'srid': requested_srid}\n", "      target_srid = requested_srid\n      _, _, _, matches = self._terrain_target(coordinate_files, x=projected_x, y=projected_y, srid=target_srid)\n      input_coordinates = {'x': projected_x, 'y': projected_y, 'srid': requested_srid}\n", 1)
s = s.replace("    matches = self._matching_coordinate_files(record, projected_x, projected_y)\n", '')
s = s.replace("        'srid': 25832,\n      },\n      'source_partial':", "        'srid': target_srid,\n      },\n      'source_partial':", 1)
s = s.replace("    point = self._nearest_xyz_from_artifact(record, selected, projected_x, projected_y)\n", "    point = self._nearest_xyz_from_artifact(record, selected, projected_x, projected_y)\n    if point is not None:\n      point['srid'] = target_srid\n")
s = s.replace("        'srid': 25832,\n        'originX':", "        'srid': self._terrain_artifact_srid(artifact),\n        'originX':")
s = s.replace("        'srid': 25832,\n        'distance_m': round(math.sqrt(distance_squared), 3),\n        'serving_prepared':", "        'srid': int(header.get('srid', 25832)),\n        'distance_m': round(math.sqrt(distance_squared), 3),\n        'serving_prepared':")
s = s.replace("        'srid': 25832,\n          'distance_m':", "        'srid': int(target.get('srid', 25832)),\n          'distance_m':")
p.write_text(s, encoding='utf-8')
