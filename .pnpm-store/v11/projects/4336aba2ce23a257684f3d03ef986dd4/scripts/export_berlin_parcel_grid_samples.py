"""Export deterministic real Berlin parcel/LoD2 fixtures for the grid audit.

Run this inside a container that can read the local Berlin LoD2 SQLite store,
reach the VECTOPLAN Geo PostGIS service and has Shapely + psycopg installed.
The output contains translated metre coordinates only; no application data is
created or changed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sqlite3
from dataclasses import dataclass
from pathlib import Path

import psycopg
from shapely import constrained_delaunay_triangles, make_valid, union_all
from shapely.geometry import MultiPolygon, Point, Polygon, shape
from shapely.strtree import STRtree

from src.geodata.lod2_conversion import convert_building


@dataclass(frozen=True)
class Building:
    building_id: str
    tile: str
    footprints: tuple[Polygon, ...]
    geometry: Polygon | MultiPolygon
    polygons: tuple[dict, ...]
    source_sha256: str


def open_plan_ring(ring: list[list[float]]) -> list[tuple[float, float]]:
    # The persisted Berlin raw store keeps source CRS coordinates as X/Y/Z.
    result = [(float(point[0]), float(point[1])) for point in ring]
    if len(result) > 1 and math.dist(result[0], result[-1]) < 1e-6:
        result.pop()
    return result


def load_buildings(database: Path) -> list[Building]:
    connection = sqlite3.connect(database)
    result: list[Building] = []
    for tile, building_id, raw_feature, source_sha256 in connection.execute(
        """SELECT b.tile, b.object_id, b.feature, t.sha256
           FROM buildings b JOIN tiles t ON t.name=b.tile
           ORDER BY b.tile, b.object_id"""
    ):
        feature = json.loads(raw_feature)
        footprints: list[Polygon] = []
        for surface in feature.get("polygons", []):
            if surface.get("surface") != "GroundSurface":
                continue
            rings = [open_plan_ring(ring) for ring in surface.get("rings", [])]
            if not rings or len(rings[0]) < 3:
                continue
            polygon = make_valid(Polygon(rings[0], rings[1:]))
            parts = list(polygon.geoms) if isinstance(polygon, MultiPolygon) else [polygon]
            footprints.extend(part for part in parts if isinstance(part, Polygon) and part.area > .05)
        if not footprints:
            continue
        merged = make_valid(union_all(footprints, grid_size=.001))
        if merged.is_empty or merged.area < 5:
            continue
        result.append(Building(
            str(building_id), str(tile), tuple(footprints), merged,
            tuple(feature.get("polygons", [])), str(source_sha256),
        ))
    return result


def translated_ring(coordinates, origin: tuple[float, float]) -> list[list[float]]:
    values = [[round(float(x) - origin[0], 4), round(float(z) - origin[1], 4)] for x, z in coordinates]
    if len(values) > 1 and values[0] == values[-1]:
        values.pop()
    return values


def polygon_payload(polygon: Polygon, origin: tuple[float, float]) -> dict:
    return {
        "outer": translated_ring(polygon.exterior.coords, origin),
        "holes": [translated_ring(ring.coords, origin) for ring in polygon.interiors],
    }


def polygons(value) -> list[Polygon]:
    if isinstance(value, Polygon):
        return [value]
    if isinstance(value, MultiPolygon):
        return list(value.geoms)
    return [part for part in getattr(value, "geoms", []) if isinstance(part, Polygon)]


def triangulate(value, origin: tuple[float, float]) -> list[list[list[float]]]:
    triangles = []
    for polygon in polygons(value):
        for triangle in constrained_delaunay_triangles(polygon).geoms:
            clipped = triangle.intersection(polygon)
            for part in polygons(clipped):
                if part.area <= 1e-7 or len(part.exterior.coords) != 4:
                    continue
                triangles.append(translated_ring(part.exterior.coords, origin))
    return triangles


def parcel_boundaries(value, parcel_id: str, origin: tuple[float, float]) -> list[dict]:
    result = []
    for polygon_index, polygon in enumerate(polygons(value)):
        for ring_index, ring in enumerate([polygon.exterior, *polygon.interiors]):
            coordinates = list(ring.coords)
            for edge in range(len(coordinates) - 1):
                start, end = coordinates[edge], coordinates[edge + 1]
                dx, dz = end[0] - start[0], end[1] - start[1]
                length = math.hypot(dx, dz)
                if length < .05:
                    continue
                inward = (-dz / length, dx / length)
                midpoint = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
                if not value.covers(Point(midpoint[0] + inward[0] * .05, midpoint[1] + inward[1] * .05)):
                    inward = (-inward[0], -inward[1])
                result.append({
                    "id": f"parcel:{parcel_id}:{polygon_index}:{ring_index}:{edge}",
                    "parcelId": parcel_id,
                    "start": [round(start[0] - origin[0], 4), round(start[1] - origin[1], 4)],
                    "end": [round(end[0] - origin[0], 4), round(end[1] - origin[1], 4)],
                    "inward": [round(inward[0], 8), round(inward[1], 8)],
                    "length": round(length, 6),
                    "depth": 3,
                    "boundaryKind": "parcel",
                })
    return result


def fixture_building(building: Building, parcel, origin: tuple[float, float]) -> dict:
    # Test the same dissolved GroundSurface contract used at runtime.  Raw
    # CityGML may split a single slab into touching surfaces; their shared
    # seams are not building facades.
    footprint_parts = polygons(building.geometry)
    return {
        "buildingId": building.building_id,
        "sourceTile": building.tile,
        "parcelOverlapM2": round(building.geometry.intersection(parcel).area, 6),
        "footprints": [polygon_payload(part, origin) for part in footprint_parts],
        "triangles": triangulate(building.geometry, origin),
    }


def fixture_envelope(building: Building, origin: tuple[float, float]) -> dict:
    """Serialize one real 3D LoD2 envelope and its production conversion.

    Heights are translated to a local one-metre world whose visible ground top
    is Y=1, matching the editor's Earth-world contract. Horizontal coordinates
    share the parcel fixture origin. This keeps the fixture compact and makes
    the geometry deterministic without changing slopes, wall spans or topology.
    """
    ground_heights = [
        float(point[2])
        for surface in building.polygons if surface.get("surface") == "GroundSurface"
        for ring in surface.get("rings", []) for point in ring
    ]
    all_heights = [
        float(point[2])
        for surface in building.polygons
        for ring in surface.get("rings", []) for point in ring
    ]
    base_height = min(ground_heights or all_heights)
    local_polygons = []
    for surface in building.polygons:
        rings = []
        for ring in surface.get("rings", []):
            rings.append([
                [
                    round(float(point[0]) - origin[0], 4),
                    round(float(point[2]) - base_height + 1, 4),
                    round(float(point[1]) - origin[1], 4),
                ]
                for point in ring
            ])
        if rings:
            local_polygons.append({"surface": str(surface.get("surface", "Surface")), "rings": rings})
    local_feature = {
        "id": building.building_id,
        "sourceTile": building.tile,
        "sourceSha256": building.source_sha256,
        "polygons": local_polygons,
    }
    try:
        converted = convert_building(local_feature)
        conversion_error = None
    except Exception as exc:
        converted = None
        conversion_error = f"{type(exc).__name__}: {exc}"
    return {
        "buildingId": building.building_id,
        "sourceTile": building.tile,
        "baseElevationM": round(base_height, 4),
        "surfaces": local_polygons,
        "converted": converted,
        "conversionError": conversion_error,
    }


def choose_samples(buildings: list[Building], connection, count: int) -> list[dict]:
    tree = STRtree([building.geometry for building in buildings])
    by_tile: dict[str, list[int]] = {}
    for index, building in enumerate(buildings):
        by_tile.setdefault(building.tile, []).append(index)
    for tile, indices in by_tile.items():
        indices.sort(key=lambda index: hashlib.sha256(
            f"vectoplan-grid-audit:{tile}:{buildings[index].building_id}".encode()
        ).hexdigest())
    tile_names = sorted(by_tile)
    cursors = {tile: 0 for tile in tile_names}
    samples: list[dict] = []
    seen_parcels: set[str] = set()
    attempts = 0
    while len(samples) < count and attempts < len(buildings) * 2:
        tile = tile_names[attempts % len(tile_names)]
        indices = by_tile[tile]
        cursor = cursors[tile]
        cursors[tile] += 1
        attempts += 1
        if cursor >= len(indices):
            continue
        seed = buildings[indices[cursor]]
        point = seed.geometry.representative_point()
        row = connection.execute(
            """
            SELECT COALESCE(NULLIF(\"UUID\", ''), 'fid:' || fid::text) AS parcel_id,
                   ST_AsGeoJSON(ST_Transform(geom, 25833), 6)
            FROM pub.flurstuecke
            WHERE ST_Covers(geom, ST_Transform(ST_SetSRID(ST_Point(%s, %s), 25833), 4326))
            ORDER BY ST_Area(geom::geography)
            LIMIT 1
            """,
            (point.x, point.y),
        ).fetchone()
        if not row or row[0] in seen_parcels:
            continue
        parcel = make_valid(shape(json.loads(row[1])))
        if parcel.is_empty or parcel.area < 20 or parcel.area > 200_000:
            continue
        intersecting = [buildings[int(index)] for index in tree.query(parcel)
                        if buildings[int(index)].geometry.intersection(parcel).area > .05]
        if not intersecting:
            continue
        intersecting.sort(key=lambda building: (
            -building.geometry.intersection(parcel).area,
            building.building_id,
        ))
        origin = (round(parcel.centroid.x), round(parcel.centroid.y))
        occupied = make_valid(union_all([building.geometry for building in intersecting], grid_size=.001)).intersection(parcel)
        seen_parcels.add(str(row[0]))
        samples.append({
            "sampleId": f"berlin-{len(samples)+1:02d}",
            "parcelId": str(row[0]),
            "sourceTiles": sorted({building.tile for building in intersecting}),
            "originEpsg25833": [origin[0], origin[1]],
            "parcelAreaM2": round(parcel.area, 6),
            "occupiedAreaM2": round(occupied.area, 6),
            "buildableAreaM2": round(parcel.area - occupied.area, 6),
            "parcelTriangles": triangulate(parcel, origin),
            "parcelBoundarySegments": parcel_boundaries(parcel, str(row[0]), origin),
            "buildings": [fixture_building(building, parcel, origin) for building in intersecting],
            "envelope": fixture_envelope(intersecting[0], origin),
        })
    if len(samples) < count:
        raise RuntimeError(f"Only {len(samples)} unique built parcels found after {attempts} attempts")
    return samples


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite", type=Path, required=True)
    parser.add_argument("--postgres", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--count", type=int, default=40)
    args = parser.parse_args()
    buildings = load_buildings(args.sqlite)
    with psycopg.connect(args.postgres) as connection:
        samples = choose_samples(buildings, connection, max(30, args.count))
    payload = {
        "schemaVersion": "vectoplan-berlin-parcel-grid-samples.v2",
        "coordinateReferenceSystem": "EPSG:25833 translated per sample",
        "source": {
            "lod2": "Berlin official LoD2 local raw store",
            "parcels": "VECTOPLAN Geo pub.flurstuecke",
            "availableLod2Buildings": len(buildings),
        },
        "sampleCount": len(samples),
        "samples": samples,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "samples": len(samples),
        "buildings": sum(len(sample["buildings"]) for sample in samples),
        "tiles": sorted({tile for sample in samples for tile in sample["sourceTiles"]}),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
