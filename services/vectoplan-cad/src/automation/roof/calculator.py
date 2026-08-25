from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping, Sequence
from typing import Any


REQUEST_CONTRACT = "cad-roof-calculation-request/0.1"
RESULT_CONTRACT = "cad-roof-calculation-result/0.1"
SUPPORTED_ROOF_TYPES = {
    "flat", "gable", "hipped", "half_hipped", "pent", "mansard", "trapezoid", "butterfly",
    "pyramid", "barrel", "sawtooth",
}
PURLIN_BEARING_OFFSET_MM = 205.0
ROOF_TYPE_ALIASES = {
    "flachdach": "flat",
    "satteldach": "gable",
    "walmdach": "hipped",
    "krueppelwalmdach": "half_hipped",
    "krüppelwalmdach": "half_hipped",
    "pultdach": "pent",
    "mansarddach": "mansard",
    "trapezdach": "trapezoid",
    "trapezoidal": "trapezoid",
    "schmetterlingsdach": "butterfly",
    "zeltdach": "pyramid",
    "pyramidendach": "pyramid",
    "tonnendach": "barrel",
    "sheddach": "sawtooth",
}


class RoofCalculationError(ValueError):
    def __init__(self, errors: Sequence[str]):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors))


def _number(value: Any, default: float, minimum: float | None = None, maximum: float | None = None) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(result):
        return default
    if minimum is not None:
        result = max(minimum, result)
    if maximum is not None:
        result = min(maximum, result)
    return result


def _point(value: Any, path: str, errors: list[str]) -> list[float] | None:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)) or len(value) != 2:
        errors.append(f"{path} must contain exactly two coordinates")
        return None
    try:
        result = [float(value[0]), float(value[1])]
    except (TypeError, ValueError):
        errors.append(f"{path} coordinates must be numbers")
        return None
    if not all(math.isfinite(coordinate) for coordinate in result):
        errors.append(f"{path} coordinates must be finite")
        return None
    return result


def _ring_area(ring: Sequence[Sequence[float]]) -> float:
    return sum(
        ring[index][0] * ring[(index + 1) % len(ring)][1]
        - ring[(index + 1) % len(ring)][0] * ring[index][1]
        for index in range(len(ring))
    ) / 2


def _cross2(first: Sequence[float], second: Sequence[float], third: Sequence[float]) -> float:
    return (
        (second[0] - first[0]) * (third[1] - first[1])
        - (second[1] - first[1]) * (third[0] - first[0])
    )


def _point_on_segment(point: Sequence[float], start: Sequence[float], end: Sequence[float]) -> bool:
    return (
        abs(_cross2(start, end, point)) <= 1e-7
        and min(start[0], end[0]) - 1e-7 <= point[0] <= max(start[0], end[0]) + 1e-7
        and min(start[1], end[1]) - 1e-7 <= point[1] <= max(start[1], end[1]) + 1e-7
    )


def _segments_intersect(
    first_start: Sequence[float], first_end: Sequence[float], second_start: Sequence[float], second_end: Sequence[float]
) -> bool:
    first_a = _cross2(first_start, first_end, second_start)
    first_b = _cross2(first_start, first_end, second_end)
    second_a = _cross2(second_start, second_end, first_start)
    second_b = _cross2(second_start, second_end, first_end)
    if (
        ((first_a > 1e-7 and first_b < -1e-7) or (first_a < -1e-7 and first_b > 1e-7))
        and ((second_a > 1e-7 and second_b < -1e-7) or (second_a < -1e-7 and second_b > 1e-7))
    ):
        return True
    return (
        (abs(first_a) <= 1e-7 and _point_on_segment(second_start, first_start, first_end))
        or (abs(first_b) <= 1e-7 and _point_on_segment(second_end, first_start, first_end))
        or (abs(second_a) <= 1e-7 and _point_on_segment(first_start, second_start, second_end))
        or (abs(second_b) <= 1e-7 and _point_on_segment(first_end, second_start, second_end))
    )


def _ring_self_intersects(ring: Sequence[Sequence[float]]) -> bool:
    for first in range(len(ring)):
        first_end = (first + 1) % len(ring)
        for second in range(first + 1, len(ring)):
            second_end = (second + 1) % len(ring)
            if first == second or first_end == second or second_end == first:
                continue
            if first == 0 and second_end == 0:
                continue
            if _segments_intersect(ring[first], ring[first_end], ring[second], ring[second_end]):
                return True
    return False


def _point_in_ring(point: Sequence[float], ring: Sequence[Sequence[float]]) -> bool:
    inside = False
    for index, start in enumerate(ring):
        end = ring[(index + 1) % len(ring)]
        if _point_on_segment(point, start, end):
            return True
        if (start[1] > point[1]) == (end[1] > point[1]):
            continue
        crossing_x = (end[0] - start[0]) * (point[1] - start[1]) / (end[1] - start[1]) + start[0]
        if point[0] < crossing_x:
            inside = not inside
    return inside


def _distance3(left: Sequence[float], right: Sequence[float]) -> float:
    return math.sqrt(sum((right[index] - left[index]) ** 2 for index in range(3)))


def _line_intersection(
    first_point: Sequence[float], first_direction: Sequence[float], second_point: Sequence[float], second_direction: Sequence[float]
) -> list[float] | None:
    denominator = first_direction[0] * second_direction[1] - first_direction[1] * second_direction[0]
    if abs(denominator) < 1e-9:
        return None
    delta = [second_point[0] - first_point[0], second_point[1] - first_point[1]]
    parameter = (delta[0] * second_direction[1] - delta[1] * second_direction[0]) / denominator
    return [first_point[0] + parameter * first_direction[0], first_point[1] + parameter * first_direction[1]]


def _edge_overhangs(raw: Any, ring: Sequence[Sequence[float]]) -> list[float]:
    if isinstance(raw, (int, float)):
        return [_number(raw, 500, 0, 5000)] * len(ring)
    source = raw if isinstance(raw, Mapping) else {}
    default = _number(source.get("default_mm"), 500, 0, 5000)
    explicit = source.get("edges_mm") if isinstance(source.get("edges_mm"), Sequence) else []
    result: list[float] = []
    area_sign = 1 if _ring_area(ring) > 0 else -1
    for index, start in enumerate(ring):
        if index < len(explicit):
            result.append(_number(explicit[index], default, 0, 5000))
            continue
        end = ring[(index + 1) % len(ring)]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = max(math.hypot(dx, dy), 1e-9)
        outward = [dy / length * area_sign, -dx / length * area_sign]
        cardinal = "east" if abs(outward[0]) >= abs(outward[1]) and outward[0] >= 0 else (
            "west" if abs(outward[0]) >= abs(outward[1]) else ("south" if outward[1] >= 0 else "north")
        )
        result.append(_number(source.get(f"{cardinal}_mm"), default, 0, 5000))
    return result


def _offset_polygon(ring: Sequence[Sequence[float]], distances: Sequence[float]) -> list[list[float]]:
    area_sign = 1 if _ring_area(ring) > 0 else -1
    lines: list[tuple[list[float], list[float], list[float]]] = []
    for index, start in enumerate(ring):
        end = ring[(index + 1) % len(ring)]
        direction = [end[0] - start[0], end[1] - start[1]]
        length = max(math.hypot(direction[0], direction[1]), 1e-9)
        normal = [direction[1] / length * area_sign, -direction[0] / length * area_sign]
        offset_start = [start[0] + normal[0] * distances[index], start[1] + normal[1] * distances[index]]
        lines.append((offset_start, direction, normal))
    result: list[list[float]] = []
    for index in range(len(ring)):
        previous = lines[index - 1]
        current = lines[index]
        incoming = previous[1]
        outgoing = current[1]
        convexity = (incoming[0] * outgoing[1] - incoming[1] * outgoing[0]) * area_sign
        if convexity < -1e-8:
            # A concave corner has no outward miter intersection on the buffer
            # boundary.  A bevel preserves the recess without producing the
            # long inward spike of intersecting both infinite offset lines.
            vertex = ring[index]
            for line, distance in ((previous, distances[index - 1]), (current, distances[index])):
                candidate = [
                    vertex[0] + line[2][0] * distance,
                    vertex[1] + line[2][1] * distance,
                ]
                if not result or math.dist(candidate, result[-1]) > 1e-7:
                    result.append([round(candidate[0], 6), round(candidate[1], 6)])
            continue
        intersection = _line_intersection(previous[0], previous[1], current[0], current[1])
        if intersection is None:
            average = [previous[2][0] + current[2][0], previous[2][1] + current[2][1]]
            length = max(math.hypot(average[0], average[1]), 1e-9)
            distance = max(distances[index - 1], distances[index])
            intersection = [ring[index][0] + average[0] / length * distance, ring[index][1] + average[1] / length * distance]
        result.append([round(intersection[0], 6), round(intersection[1], 6)])
    return result


def _normalize_request(payload: Mapping[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if str(payload.get("contract_version") or REQUEST_CONTRACT) != REQUEST_CONTRACT:
        errors.append(f"$.contract_version must be {REQUEST_CONTRACT}")
    roof_type = str(payload.get("roof_type") or "gable").strip().lower()
    roof_type = ROOF_TYPE_ALIASES.get(roof_type, roof_type)
    if roof_type not in SUPPORTED_ROOF_TYPES:
        errors.append(f"$.roof_type must be one of {', '.join(sorted(SUPPORTED_ROOF_TYPES))}")

    footprint = payload.get("footprint") if isinstance(payload.get("footprint"), Mapping) else {}
    raw_ring = footprint.get("outer_ring_mm") or footprint.get("outline_mm") or []
    ring = [point for index, value in enumerate(raw_ring) if (point := _point(value, f"$.footprint.outer_ring_mm[{index}]", errors))]
    if len(ring) > 1 and math.dist(ring[0], ring[-1]) < 1e-6:
        ring.pop()
    deduplicated: list[list[float]] = []
    for point in ring:
        if not deduplicated or math.dist(point, deduplicated[-1]) >= 1e-6:
            deduplicated.append(point)
    ring = deduplicated
    if len(ring) >= 3:
        simplified: list[list[float]] = []
        for index, point in enumerate(ring):
            previous = ring[index - 1]
            following = ring[(index + 1) % len(ring)]
            if abs(_cross2(previous, point, following)) <= 1e-7 and _point_on_segment(point, previous, following):
                continue
            simplified.append(point)
        ring = simplified
    if len(ring) < 3:
        errors.append("$.footprint.outer_ring_mm must contain at least three different points")
    elif _ring_self_intersects(ring):
        errors.append("$.footprint.outer_ring_mm must not self-intersect")
    elif abs(_ring_area(ring)) < 1:
        errors.append("$.footprint.outer_ring_mm must enclose an area")

    parameters = payload.get("parameters") if isinstance(payload.get("parameters"), Mapping) else {}
    structure = parameters.get("structure") if isinstance(parameters.get("structure"), Mapping) else {}
    rafter = structure.get("rafter") if isinstance(structure.get("rafter"), Mapping) else {}
    purlin = structure.get("purlin") if isinstance(structure.get("purlin"), Mapping) else {}
    roof_build_up = parameters.get("roof_build_up") if isinstance(parameters.get("roof_build_up"), Mapping) else {}
    counter_batten = roof_build_up.get("counter_batten") if isinstance(roof_build_up.get("counter_batten"), Mapping) else {}
    tile_batten = roof_build_up.get("tile_batten") if isinstance(roof_build_up.get("tile_batten"), Mapping) else {}
    insulation_mode = str(roof_build_up.get("insulation_mode") or "between").strip().lower()
    if insulation_mode not in {"between", "below", "above"}:
        insulation_mode = "between"
    insulation_thickness = _number(
        roof_build_up.get("insulation_thickness_mm"),
        _number(parameters.get("roof_skin_thickness_mm"), 200, 20, 500),
        20,
        500,
    )
    legacy_timber_defaults = (
        "birdsmouth_depth_mm" not in rafter
        and "middle_span_threshold_mm" not in purlin
        and _number(rafter.get("spacing_mm"), 700) == 700
        and _number(purlin.get("width_mm"), 160) == 160
        and _number(purlin.get("height_mm"), 240) == 240
        and _number(purlin.get("maximum_spacing_mm"), 2500) == 2500
    )
    normalized_parameters = {
        "pitch_deg": int(math.floor(_number(parameters.get("pitch_deg"), 35, 0, 80) + 0.5)),
        "eaves_height_mm": _number(parameters.get("eaves_height_mm"), 6000, -100000, 100000),
        "ridge_direction": parameters.get("ridge_direction", "auto"),
        "overhang_mm": parameters.get("overhang_mm", {"default_mm": 500}),
        # Kept for request/result compatibility.  The explicit build-up below is
        # the authoritative model for new callers.
        "roof_skin_thickness_mm": insulation_thickness,
        "roof_skin_material": str(parameters.get("roof_skin_material") or roof_build_up.get("tile_material_ref") or "clay-roof-tile"),
        "roof_build_up": {
            "insulation_mode": insulation_mode,
            "insulation_thickness_mm": insulation_thickness,
            "sheathing_thickness_mm": _number(roof_build_up.get("sheathing_thickness_mm"), 22, 8, 80),
            "underlay_thickness_mm": _number(roof_build_up.get("underlay_thickness_mm"), 3, 1, 20),
            "counter_batten": {
                "width_mm": _number(counter_batten.get("width_mm"), 60, 20, 120),
                "height_mm": _number(counter_batten.get("height_mm"), 40, 20, 100),
            },
            "tile_batten": {
                "width_mm": _number(tile_batten.get("width_mm"), 50, 20, 100),
                "height_mm": _number(tile_batten.get("height_mm"), 30, 20, 80),
                "spacing_mm": _number(tile_batten.get("spacing_mm"), 330, 200, 500),
            },
            "tile_thickness_mm": _number(roof_build_up.get("tile_thickness_mm"), 20, 8, 80),
            "tile_material_ref": str(roof_build_up.get("tile_material_ref") or parameters.get("roof_skin_material") or "clay-roof-tile"),
        },
        "plateau_width_ratio": _number(parameters.get("plateau_width_ratio"), 0.25, 0.05, 0.8),
        "mansard_break_ratio": _number(parameters.get("mansard_break_ratio"), 0.38, 0.1, 0.8),
        "mansard_lower_pitch_deg": _number(parameters.get("mansard_lower_pitch_deg"), 70, 10, 85),
        "mansard_upper_pitch_deg": _number(parameters.get("mansard_upper_pitch_deg"), 28, 1, 70),
        "hip_end_ratio": _number(parameters.get("hip_end_ratio"), 0.5, 0.1, 1.0),
        "barrel_rise_mm": _number(parameters.get("barrel_rise_mm"), 3000, 100, 30000),
        "barrel_segment_count": int(_number(parameters.get("barrel_segment_count"), 12, 4, 64)),
        "sawtooth_count": int(_number(parameters.get("sawtooth_count"), 3, 1, 20)),
        "sawtooth_pitch_deg": _number(parameters.get("sawtooth_pitch_deg"), 35, 5, 80),
        "structure": {
            "rafter": {
                "width_mm": _number(rafter.get("width_mm"), 80, 20, 1000),
                "height_mm": _number(rafter.get("height_mm"), 200, 180, 240),
                "spacing_mm": 650 if legacy_timber_defaults else _number(rafter.get("spacing_mm"), 650, 100, 3000),
                "birdsmouth_depth_mm": _number(rafter.get("birdsmouth_depth_mm"), 30, 20, 50),
            },
            "purlin": {
                "width_mm": 140 if legacy_timber_defaults else _number(purlin.get("width_mm"), 140, 20, 1500),
                "height_mm": 200 if legacy_timber_defaults else _number(purlin.get("height_mm"), 200, 20, 2000),
                "maximum_spacing_mm": 4500 if legacy_timber_defaults else _number(purlin.get("maximum_spacing_mm"), 4500, 250, 10000),
                "middle_span_threshold_mm": _number(purlin.get("middle_span_threshold_mm"), 4500, 1000, 15000),
            },
        },
    }
    if errors:
        raise RoofCalculationError(errors)
    return {"contract_version": REQUEST_CONTRACT, "roof_type": roof_type, "footprint": {"outer_ring_mm": ring}, "parameters": normalized_parameters}


def _ridge_angle(parameters: Mapping[str, Any], ring: Sequence[Sequence[float]]) -> float:
    raw = parameters["ridge_direction"]
    if isinstance(raw, (int, float)):
        return math.radians(float(raw))
    value = str(raw).lower()
    if value in {"x", "east-west", "ost-west"}:
        return 0.0
    if value in {"y", "north-south", "nord-sued", "nord-süd"}:
        return math.pi / 2
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    return 0.0 if max(xs) - min(xs) >= max(ys) - min(ys) else math.pi / 2


def _to_local(point: Sequence[float], angle: float) -> list[float]:
    cosine, sine = math.cos(angle), math.sin(angle)
    return [point[0] * cosine + point[1] * sine, -point[0] * sine + point[1] * cosine]


def _to_world(point: Sequence[float], angle: float) -> list[float]:
    cosine, sine = math.cos(angle), math.sin(angle)
    return [point[0] * cosine - point[1] * sine, point[0] * sine + point[1] * cosine]


def _point_in_triangle(point: Sequence[float], triangle: Sequence[Sequence[float]]) -> bool:
    signs = [_cross2(triangle[index], triangle[(index + 1) % 3], point) for index in range(3)]
    return not (any(value > 1e-7 for value in signs) and any(value < -1e-7 for value in signs))


def _triangulate_polygon(ring: Sequence[Sequence[float]]) -> list[list[list[float]]]:
    """Ear-clip a simple straight-edged polygon without external geometry dependencies."""
    points = [[float(point[0]), float(point[1])] for point in ring]
    if _ring_area(points) < 0:
        points.reverse()
    indices = list(range(len(points)))
    triangles: list[list[list[float]]] = []
    guard = 0
    while len(indices) > 3 and guard < len(points) * len(points):
        guard += 1
        ear_found = False
        for position, current in enumerate(indices):
            previous = indices[position - 1]
            following = indices[(position + 1) % len(indices)]
            triangle = [points[previous], points[current], points[following]]
            if _cross2(*triangle) <= 1e-7:
                continue
            if any(
                candidate not in {previous, current, following}
                and _point_in_triangle(points[candidate], triangle)
                for candidate in indices
            ):
                continue
            triangles.append([point[:] for point in triangle])
            indices.pop(position)
            ear_found = True
            break
        if not ear_found:
            break
    if len(indices) == 3:
        triangle = [points[index] for index in indices]
        if abs(_ring_area(triangle)) > 1e-7:
            triangles.append([point[:] for point in triangle])
    if len(triangles) != max(1, len(points) - 2):
        raise RoofCalculationError(["$.footprint.outer_ring_mm could not be triangulated"])
    return triangles


def _clip_polygon_coordinate(
    polygon: Sequence[Sequence[float]], coordinate_index: int, boundary: float, keep_greater: bool
) -> list[list[float]]:
    if not polygon:
        return []
    result: list[list[float]] = []

    def inside(point: Sequence[float]) -> bool:
        return point[coordinate_index] >= boundary - 1e-7 if keep_greater else point[coordinate_index] <= boundary + 1e-7

    for index, current in enumerate(polygon):
        previous = polygon[index - 1]
        current_inside = inside(current)
        previous_inside = inside(previous)
        if current_inside != previous_inside:
            delta = current[coordinate_index] - previous[coordinate_index]
            if abs(delta) > 1e-9:
                ratio = (boundary - previous[coordinate_index]) / delta
                intersection = [
                    previous[0] + (current[0] - previous[0]) * ratio,
                    previous[1] + (current[1] - previous[1]) * ratio,
                ]
                result.append(intersection)
        if current_inside:
            result.append([float(current[0]), float(current[1])])
    return result


def _clip_polygon_band(
    polygon: Sequence[Sequence[float]], minimum_v: float, maximum_v: float
) -> list[list[float]]:
    lower = _clip_polygon_coordinate(polygon, 1, minimum_v, True)
    return _clip_polygon_coordinate(lower, 1, maximum_v, False)


def _distance_to_ring(point: Sequence[float], ring: Sequence[Sequence[float]]) -> float:
    closest = float("inf")
    for index, start in enumerate(ring):
        end = ring[(index + 1) % len(ring)]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length_squared = dx * dx + dy * dy
        ratio = 0.0 if length_squared <= 1e-12 else max(0.0, min(1.0, (
            (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
        ) / length_squared))
        projection = [start[0] + ratio * dx, start[1] + ratio * dy]
        closest = min(closest, math.dist(point, projection))
    return closest


def _coverage_matches_bounds(local_ring: Sequence[Sequence[float]], bounds: Mapping[str, float]) -> bool:
    if len(local_ring) != 4:
        return False
    corners = {
        (round(bounds["umin"], 6), round(bounds["vmin"], 6)),
        (round(bounds["umax"], 6), round(bounds["vmin"], 6)),
        (round(bounds["umax"], 6), round(bounds["vmax"], 6)),
        (round(bounds["umin"], 6), round(bounds["vmax"], 6)),
    }
    return {(round(point[0], 6), round(point[1], 6)) for point in local_ring} == corners


def _profile_breaks(roof_type: str, bounds: Mapping[str, float], parameters: Mapping[str, Any]) -> list[float]:
    vmin, vmax = bounds["vmin"], bounds["vmax"]
    middle = (vmin + vmax) / 2
    span = vmax - vmin
    if roof_type in {"gable", "butterfly"}:
        return [vmin, middle, vmax]
    if roof_type == "trapezoid":
        half = span * parameters["plateau_width_ratio"] / 2
        return [vmin, middle - half, middle + half, vmax]
    if roof_type == "mansard":
        break_run = span / 2 * parameters["mansard_break_ratio"]
        return [vmin, vmin + break_run, middle, vmax - break_run, vmax]
    if roof_type == "barrel":
        count = parameters["barrel_segment_count"]
        return [vmin + span * index / count for index in range(count + 1)]
    return [vmin, vmax]


def _subdivide_triangle(triangle: Sequence[Sequence[float]], depth: int) -> list[list[list[float]]]:
    if depth <= 0:
        return [[list(point) for point in triangle]]
    first, second, third = triangle
    midpoint_ab = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
    midpoint_bc = [(second[0] + third[0]) / 2, (second[1] + third[1]) / 2]
    midpoint_ca = [(third[0] + first[0]) / 2, (third[1] + first[1]) / 2]
    children = [
        [first, midpoint_ab, midpoint_ca],
        [midpoint_ab, second, midpoint_bc],
        [midpoint_ca, midpoint_bc, third],
        [midpoint_ab, midpoint_bc, midpoint_ca],
    ]
    return [part for child in children for part in _subdivide_triangle(child, depth - 1)]


def _polygon_surface_area(points: Sequence[Sequence[float]]) -> float:
    if len(points) < 3:
        return 0.0
    origin = points[0]
    total = 0.0
    for index in range(1, len(points) - 1):
        left = [points[index][axis] - origin[axis] for axis in range(3)]
        right = [points[index + 1][axis] - origin[axis] for axis in range(3)]
        cross = [
            left[1] * right[2] - left[2] * right[1],
            left[2] * right[0] - left[0] * right[2],
            left[0] * right[1] - left[1] * right[0],
        ]
        total += math.sqrt(sum(value * value for value in cross)) / 2
    return total


def _face(face_ref: str, role: str, points: Sequence[Sequence[float]], pitch_deg: float) -> dict[str, Any]:
    surface = _polygon_surface_area(points)
    plan = abs(_ring_area([[point[0], point[1]] for point in points]))
    return {
        "face_ref": face_ref,
        "role": role,
        "pitch_deg": round(pitch_deg, 6),
        "polygon_3d_mm": [[round(coordinate, 6) for coordinate in point] for point in points],
        "plan_area_m2": round(plan / 1_000_000, 6),
        "surface_area_m2": round(surface / 1_000_000, 6),
    }


def _barrel_rise_for_pitch(bounds: Mapping[str, float], pitch_deg: float) -> float:
    """Return the circular-segment rise whose eave tangent matches ``pitch_deg``."""
    half_span = max((bounds["vmax"] - bounds["vmin"]) / 2, 0.5)
    return half_span * math.tan(math.radians(max(0.0, min(80.0, pitch_deg))) / 2)


def _roof_profile(roof_type: str, v: float, bounds: Mapping[str, float], parameters: Mapping[str, Any]) -> float:
    vmin, vmax = bounds["vmin"], bounds["vmax"]
    span = max(vmax - vmin, 1)
    middle = (vmin + vmax) / 2
    eaves = parameters["eaves_height_mm"]
    pitch = math.tan(math.radians(parameters["pitch_deg"]))
    distance_to_eave = min(v - vmin, vmax - v)
    if roof_type == "flat":
        return eaves + (v - vmin) * pitch
    if roof_type == "pent":
        return eaves + (v - vmin) * pitch
    if roof_type == "butterfly":
        return eaves + abs(v - middle) * pitch
    if roof_type == "trapezoid":
        plateau_half = span * parameters["plateau_width_ratio"] / 2
        return eaves + min(max(0, distance_to_eave), span / 2 - plateau_half) * pitch
    if roof_type == "mansard":
        half = span / 2
        run = max(0, distance_to_eave)
        break_run = half * parameters["mansard_break_ratio"]
        if run <= break_run:
            return eaves + run * math.tan(math.radians(parameters["mansard_lower_pitch_deg"]))
        break_height = break_run * math.tan(math.radians(parameters["mansard_lower_pitch_deg"]))
        return eaves + break_height + (run - break_run) * math.tan(math.radians(parameters["mansard_upper_pitch_deg"]))
    if roof_type == "barrel":
        half = span / 2
        # A barrel has no single planar slope.  The common pitch control is
        # therefore defined as the tangent angle at both eaves.  For a circular
        # segment this gives rise = half_span * tan(pitch / 2).
        rise = _barrel_rise_for_pitch(bounds, parameters["pitch_deg"])
        if rise <= 1e-9:
            return eaves
        radius = (half * half + rise * rise) / max(2 * rise, 1)
        centre_height = rise - radius
        return eaves + centre_height + math.sqrt(max(0, radius * radius - (v - middle) ** 2))
    if roof_type == "sawtooth":
        tooth_width = span / max(1, parameters["sawtooth_count"])
        local = (v - vmin) % tooth_width
        return eaves + local * pitch
    return eaves + max(0, distance_to_eave) * pitch


def _build_faces(roof_type: str, bounds: Mapping[str, float], parameters: Mapping[str, Any], angle: float, coverage: Sequence[Sequence[float]]) -> list[dict[str, Any]]:
    umin, umax, vmin, vmax = bounds["umin"], bounds["umax"], bounds["vmin"], bounds["vmax"]
    middle = (vmin + vmax) / 2
    span = vmax - vmin

    def vertex(u: float, v: float, roof: str = roof_type) -> list[float]:
        x, y = _to_world([u, v], angle)
        return [x, y, _roof_profile(roof, v, bounds, parameters)]

    if roof_type in {"flat", "pent"}:
        points = [[point[0], point[1], _roof_profile(roof_type, _to_local(point, angle)[1], bounds, parameters)] for point in coverage]
        return [_face("roof_face_1", roof_type, points, parameters["pitch_deg"])]
    if roof_type == "barrel":
        count = parameters["barrel_segment_count"]
        faces = []
        for index in range(count):
            first = vmin + span * index / count
            second = vmin + span * (index + 1) / count
            rise = abs(_roof_profile("barrel", second, bounds, parameters) - _roof_profile("barrel", first, bounds, parameters))
            segment_pitch = math.degrees(math.atan2(rise, max(second - first, 1)))
            faces.append(_face(
                f"roof_face_{index + 1}", "barrel-segment",
                [vertex(umin, first), vertex(umax, first), vertex(umax, second), vertex(umin, second)], segment_pitch,
            ))
        return faces
    if roof_type == "sawtooth":
        count = parameters["sawtooth_count"]
        tooth_width = span / count
        faces = []
        eaves = parameters["eaves_height_mm"]
        peak_height = eaves + tooth_width * math.tan(math.radians(parameters["pitch_deg"]))
        for index in range(count):
            first = vmin + tooth_width * index
            second = first + tooth_width
            first_world_left = _to_world([umin, first], angle)
            first_world_right = _to_world([umax, first], angle)
            second_world_left = _to_world([umin, second], angle)
            second_world_right = _to_world([umax, second], angle)
            faces.extend([
                _face(f"roof_face_{index * 2 + 1}", "sawtooth-slope", [
                    [*first_world_left, eaves], [*first_world_right, eaves],
                    [*second_world_right, peak_height], [*second_world_left, peak_height],
                ], parameters["pitch_deg"]),
                _face(f"roof_face_{index * 2 + 2}", "northlight", [
                    [*second_world_left, peak_height], [*second_world_right, peak_height],
                    [*second_world_right, eaves], [*second_world_left, eaves],
                ], 90),
            ])
        return faces
    if roof_type == "pyramid":
        centre_u, centre_v = (umin + umax) / 2, middle
        apex_height = parameters["eaves_height_mm"] + min(umax - umin, vmax - vmin) / 2 * math.tan(math.radians(parameters["pitch_deg"]))
        centre_world = _to_world([centre_u, centre_v], angle)
        apex = [*centre_world, apex_height]
        corners = [
            [*_to_world([umin, vmin], angle), parameters["eaves_height_mm"]],
            [*_to_world([umax, vmin], angle), parameters["eaves_height_mm"]],
            [*_to_world([umax, vmax], angle), parameters["eaves_height_mm"]],
            [*_to_world([umin, vmax], angle), parameters["eaves_height_mm"]],
        ]
        return [
            _face(f"roof_face_{index + 1}", "pyramid-slope", [corners[index], corners[(index + 1) % 4], apex], parameters["pitch_deg"])
            for index in range(4)
        ]
    if roof_type == "trapezoid":
        half = span * parameters["plateau_width_ratio"] / 2
        low, high = middle - half, middle + half
        return [
            _face("roof_face_1", "slope-a", [vertex(umin, vmin), vertex(umax, vmin), vertex(umax, low), vertex(umin, low)], parameters["pitch_deg"]),
            _face("roof_face_2", "plateau", [vertex(umin, low), vertex(umax, low), vertex(umax, high), vertex(umin, high)], 0),
            _face("roof_face_3", "slope-b", [vertex(umin, high), vertex(umax, high), vertex(umax, vmax), vertex(umin, vmax)], parameters["pitch_deg"]),
        ]
    if roof_type == "mansard":
        break_run = span / 2 * parameters["mansard_break_ratio"]
        low, high = vmin + break_run, vmax - break_run
        return [
            _face("roof_face_1", "lower-a", [vertex(umin, vmin), vertex(umax, vmin), vertex(umax, low), vertex(umin, low)], parameters["mansard_lower_pitch_deg"]),
            _face("roof_face_2", "upper-a", [vertex(umin, low), vertex(umax, low), vertex(umax, middle), vertex(umin, middle)], parameters["mansard_upper_pitch_deg"]),
            _face("roof_face_3", "upper-b", [vertex(umin, middle), vertex(umax, middle), vertex(umax, high), vertex(umin, high)], parameters["mansard_upper_pitch_deg"]),
            _face("roof_face_4", "lower-b", [vertex(umin, high), vertex(umax, high), vertex(umax, vmax), vertex(umin, vmax)], parameters["mansard_lower_pitch_deg"]),
        ]
    if roof_type in {"hipped", "half_hipped"}:
        half_span = span / 2
        inset = min((umax - umin) / 2, half_span * (1 if roof_type == "hipped" else parameters["hip_end_ratio"]))
        ridge_start, ridge_end = umin + inset, umax - inset
        ridge_height = _roof_profile("gable", middle, bounds, parameters)

        def hip_vertex(u: float, v: float, ridge: bool = False) -> list[float]:
            x, y = _to_world([u, v], angle)
            return [x, y, ridge_height if ridge else parameters["eaves_height_mm"]]

        return [
            _face("roof_face_1", "slope-a", [hip_vertex(umin, vmin), hip_vertex(umax, vmin), hip_vertex(ridge_end, middle, True), hip_vertex(ridge_start, middle, True)], parameters["pitch_deg"]),
            _face("roof_face_2", "slope-b", [hip_vertex(ridge_start, middle, True), hip_vertex(ridge_end, middle, True), hip_vertex(umax, vmax), hip_vertex(umin, vmax)], parameters["pitch_deg"]),
            _face("roof_face_3", "hip-a", [hip_vertex(umin, vmin), hip_vertex(ridge_start, middle, True), hip_vertex(umin, vmax)], parameters["pitch_deg"]),
            _face("roof_face_4", "hip-b", [hip_vertex(ridge_end, middle, True), hip_vertex(umax, vmin), hip_vertex(umax, vmax)], parameters["pitch_deg"]),
        ]
    pitch = parameters["pitch_deg"]
    role_a, role_b = ("inverted-a", "inverted-b") if roof_type == "butterfly" else ("slope-a", "slope-b")
    return [
        _face("roof_face_1", role_a, [vertex(umin, vmin), vertex(umax, vmin), vertex(umax, middle), vertex(umin, middle)], pitch),
        _face("roof_face_2", role_b, [vertex(umin, middle), vertex(umax, middle), vertex(umax, vmax), vertex(umin, vmax)], pitch),
    ]


def _height_for_local(
    roof_type: str,
    point: Sequence[float],
    local_ring: Sequence[Sequence[float]],
    bounds: Mapping[str, float],
    parameters: Mapping[str, Any],
) -> float:
    if roof_type not in {"hipped", "half_hipped", "pyramid"}:
        return _roof_profile(roof_type, point[1], bounds, parameters)
    eaves = parameters["eaves_height_mm"]
    slope = math.tan(math.radians(parameters["pitch_deg"]))
    boundary_run = _distance_to_ring(point, local_ring)
    if roof_type == "pyramid":
        return eaves + boundary_run * slope
    gable_run = min(point[1] - bounds["vmin"], bounds["vmax"] - point[1])
    hip_ratio = 1.0 if roof_type == "hipped" else parameters["hip_end_ratio"]
    return eaves + max(0.0, min(gable_run, boundary_run / max(hip_ratio, 1e-6))) * slope


def _line_intervals_in_ring(
    ring: Sequence[Sequence[float]], fixed_axis: int, fixed_value: float
) -> list[tuple[float, float]]:
    varying_axis = 1 - fixed_axis
    candidates: list[float] = []
    for index, start in enumerate(ring):
        end = ring[(index + 1) % len(ring)]
        start_fixed = start[fixed_axis]
        end_fixed = end[fixed_axis]
        if abs(start_fixed - fixed_value) <= 1e-7 and abs(end_fixed - fixed_value) <= 1e-7:
            candidates.extend([start[varying_axis], end[varying_axis]])
            continue
        if (start_fixed <= fixed_value < end_fixed) or (end_fixed <= fixed_value < start_fixed):
            ratio = (fixed_value - start_fixed) / (end_fixed - start_fixed)
            candidates.append(start[varying_axis] + (end[varying_axis] - start[varying_axis]) * ratio)
    ordered: list[float] = []
    for value in sorted(candidates):
        if not ordered or abs(value - ordered[-1]) > 1e-6:
            ordered.append(value)
    intervals: list[tuple[float, float]] = []
    for start, end in zip(ordered, ordered[1:]):
        if end - start <= 1e-6:
            continue
        midpoint = (start + end) / 2
        point = [fixed_value, midpoint] if fixed_axis == 0 else [midpoint, fixed_value]
        if _point_in_ring(point, ring):
            intervals.append((start, end))
    return intervals


def _build_polygon_faces(
    roof_type: str,
    bounds: Mapping[str, float],
    parameters: Mapping[str, Any],
    angle: float,
    coverage: Sequence[Sequence[float]],
) -> list[dict[str, Any]]:
    local_ring = [_to_local(point, angle) for point in coverage]
    triangles = _triangulate_polygon(local_ring)
    faces: list[dict[str, Any]] = []

    def world_vertex(point: Sequence[float], height: float | None = None) -> list[float]:
        world = _to_world(point, angle)
        return [*world, _height_for_local(roof_type, point, local_ring, bounds, parameters) if height is None else height]

    if roof_type in {"hipped", "half_hipped", "pyramid"}:
        role = "pyramid-slope" if roof_type == "pyramid" else "hip-slope"
        for triangle in triangles:
            for part in _subdivide_triangle(triangle, 2):
                faces.append(_face(
                    f"roof_face_{len(faces) + 1}", role,
                    [world_vertex(point) for point in part], parameters["pitch_deg"],
                ))
        return faces

    if roof_type == "sawtooth":
        count = parameters["sawtooth_count"]
        vmin, vmax = bounds["vmin"], bounds["vmax"]
        tooth_width = (vmax - vmin) / count
        pitch = parameters["pitch_deg"]
        slope = math.tan(math.radians(pitch))
        eaves = parameters["eaves_height_mm"]
        for tooth in range(count):
            first = vmin + tooth_width * tooth
            second = first + tooth_width
            for triangle in triangles:
                clipped = _clip_polygon_band(triangle, first, second)
                if len(clipped) < 3 or abs(_ring_area(clipped)) <= 1e-6:
                    continue
                faces.append(_face(
                    f"roof_face_{len(faces) + 1}", "sawtooth-slope",
                    [world_vertex(point, eaves + max(0.0, point[1] - first) * slope) for point in clipped], pitch,
                ))
            if tooth >= count - 1:
                continue
            for interval_start, interval_end in _line_intervals_in_ring(local_ring, 1, second):
                peak = eaves + tooth_width * slope
                faces.append(_face(
                    f"roof_face_{len(faces) + 1}", "northlight",
                    [
                        world_vertex([interval_start, second], peak),
                        world_vertex([interval_end, second], peak),
                        world_vertex([interval_end, second], eaves),
                        world_vertex([interval_start, second], eaves),
                    ], 90,
                ))
        return faces

    breaks = _profile_breaks(roof_type, bounds, parameters)
    roles = {
        "gable": ["slope-a", "slope-b"],
        "butterfly": ["inverted-a", "inverted-b"],
        "trapezoid": ["slope-a", "plateau", "slope-b"],
        "mansard": ["lower-a", "upper-a", "upper-b", "lower-b"],
    }.get(roof_type, [roof_type] * max(1, len(breaks) - 1))
    for band, (minimum_v, maximum_v) in enumerate(zip(breaks, breaks[1:])):
        for triangle in triangles:
            clipped = _clip_polygon_band(triangle, minimum_v, maximum_v)
            if len(clipped) < 3 or abs(_ring_area(clipped)) <= 1e-6:
                continue
            start_height = _roof_profile(roof_type, minimum_v, bounds, parameters)
            end_height = _roof_profile(roof_type, maximum_v, bounds, parameters)
            segment_pitch = math.degrees(math.atan2(abs(end_height - start_height), max(maximum_v - minimum_v, 1)))
            if roof_type == "flat":
                segment_pitch = parameters["pitch_deg"]
            faces.append(_face(
                f"roof_face_{len(faces) + 1}", roles[min(band, len(roles) - 1)],
                [world_vertex(point) for point in clipped], segment_pitch,
            ))
    return faces


def _normalized3(vector: Sequence[float]) -> list[float]:
    length = math.sqrt(sum(value * value for value in vector))
    return [value / length for value in vector] if length > 1e-12 else [0.0, 0.0, 1.0]


def _rafter_height_axis(start: Sequence[float], end: Sequence[float]) -> list[float]:
    length_axis = _normalized3([end[axis] - start[axis] for axis in range(3)])
    plan_length = math.hypot(length_axis[0], length_axis[1])
    width_axis = (
        [-length_axis[1] / plan_length, length_axis[0] / plan_length, 0.0]
        if plan_length > 1e-12
        else [1.0, 0.0, 0.0]
    )
    height_axis = _normalized3(_cross3(length_axis, width_axis))
    return height_axis if height_axis[2] >= 0 else [-value for value in height_axis]


def _offset3(point: Sequence[float], direction: Sequence[float], distance: float) -> list[float]:
    return [point[axis] + direction[axis] * distance for axis in range(3)]


def _member(
    member_ref: str,
    role: str,
    start: Sequence[float],
    end: Sequence[float],
    section: Mapping[str, float],
    *,
    height_axis: Sequence[float] | None = None,
    support_start: Sequence[float] | None = None,
    support_end: Sequence[float] | None = None,
    notches: Sequence[Mapping[str, Any]] = (),
    section_orientation: str | None = None,
) -> dict[str, Any]:
    length = _distance3(start, end)
    result = {
        "member_ref": member_ref,
        "role": role,
        "start_3d_mm": [round(value, 6) for value in start],
        "end_3d_mm": [round(value, 6) for value in end],
        "length_mm": round(length, 3),
        "section_mm": {"width": section["width_mm"], "height": section["height_mm"]},
        "timber_volume_m3": round(length * section["width_mm"] * section["height_mm"] / 1_000_000_000, 8),
    }
    if height_axis is not None:
        result["height_axis_3d"] = [round(value, 9) for value in _normalized3(height_axis)]
    if section_orientation is not None:
        result["section_orientation"] = section_orientation
    if support_start is not None and support_end is not None:
        result["support_start_3d_mm"] = [round(value, 6) for value in support_start]
        result["support_end_3d_mm"] = [round(value, 6) for value in support_end]
    if notches:
        result["notches"] = [dict(notch) for notch in notches]
        removed_volume = sum(
            float(notch["length_mm"]) * float(notch["depth_mm"]) * section["width_mm"]
            for notch in notches
        ) / 1_000_000_000
        result["timber_volume_m3"] = round(max(0.0, result["timber_volume_m3"] - removed_volume), 8)
    return result


def _plane_for_face(points: Sequence[Sequence[float]]) -> tuple[float, float, float] | None:
    """Return z = a*x + b*y + c for a non-vertical roof face."""
    if len(points) < 3:
        return None
    origin = points[0]
    for first_index in range(1, len(points) - 1):
        first = points[first_index]
        first_dx = first[0] - origin[0]
        first_dy = first[1] - origin[1]
        first_dz = first[2] - origin[2]
        for second_index in range(first_index + 1, len(points)):
            second = points[second_index]
            second_dx = second[0] - origin[0]
            second_dy = second[1] - origin[1]
            second_dz = second[2] - origin[2]
            determinant = first_dx * second_dy - second_dx * first_dy
            if abs(determinant) <= 1e-9:
                continue
            a = (first_dz * second_dy - second_dz * first_dy) / determinant
            b = (first_dx * second_dz - second_dx * first_dz) / determinant
            return a, b, origin[2] - a * origin[0] - b * origin[1]
    return None


def _dot2(left: Sequence[float], right: Sequence[float]) -> float:
    return left[0] * right[0] + left[1] * right[1]


def _normalized2(vector: Sequence[float]) -> list[float]:
    length = math.hypot(vector[0], vector[1])
    return [vector[0] / length, vector[1] / length] if length > 1e-12 else [1.0, 0.0]


def _grid_positions(minimum: float, maximum: float, spacing: float, anchor: float) -> list[float]:
    """Create a stable interior grid without turning face/triangle seams into members."""
    if maximum - minimum <= 1e-6:
        return []
    spacing = max(spacing, 1.0)
    first_index = math.ceil((minimum - anchor + 1e-6) / spacing)
    last_index = math.floor((maximum - anchor - 1e-6) / spacing)
    positions = [anchor + index * spacing for index in range(first_index, last_index + 1)]
    return positions or [(minimum + maximum) / 2]


def _face_grid_segments(
    points: Sequence[Sequence[float]],
    plane: tuple[float, float, float],
    line_direction: Sequence[float],
    spacing: float,
    anchor_point: Sequence[float],
    role: str,
) -> list[dict[str, Any]]:
    direction = _normalized2(line_direction)
    normal = [-direction[1], direction[0]]
    transformed_ring = [
        [_dot2(point, direction), _dot2(point, normal)]
        for point in points
    ]
    normal_values = [point[1] for point in transformed_ring]
    anchor = _dot2(anchor_point, normal)
    positions = _grid_positions(min(normal_values), max(normal_values), spacing, anchor)
    return _face_segments_at_positions(points, plane, line_direction, positions, role)


def _face_segments_at_positions(
    points: Sequence[Sequence[float]],
    plane: tuple[float, float, float],
    line_direction: Sequence[float],
    positions: Sequence[float],
    role: str,
) -> list[dict[str, Any]]:
    direction = _normalized2(line_direction)
    normal = [-direction[1], direction[0]]
    transformed_ring = [
        [_dot2(point, direction), _dot2(point, normal)]
        for point in points
    ]
    a, b, c = plane
    segments: list[dict[str, Any]] = []
    for position in positions:
        for interval_start, interval_end in _line_intervals_in_ring(transformed_ring, 1, position):
            if interval_end - interval_start <= 1e-3:
                continue
            start_xy = [
                direction[0] * interval_start + normal[0] * position,
                direction[1] * interval_start + normal[1] * position,
            ]
            end_xy = [
                direction[0] * interval_end + normal[0] * position,
                direction[1] * interval_end + normal[1] * position,
            ]
            segments.append({
                "role": role,
                "start": [*start_xy, a * start_xy[0] + b * start_xy[1] + c],
                "end": [*end_xy, a * end_xy[0] + b * end_xy[1] + c],
            })
    return segments


def _clip_segment_to_plan_ring(
    segment: Mapping[str, Any],
    ring: Sequence[Sequence[float]],
) -> list[dict[str, Any]]:
    """Clip a sloped 3D support line to a 2D plan polygon."""
    start = segment["start"]
    end = segment["end"]
    direction = _normalized2([end[0] - start[0], end[1] - start[1]])
    plan_length = math.hypot(end[0] - start[0], end[1] - start[1])
    if plan_length <= 1e-6:
        return []
    normal = [-direction[1], direction[0]]
    transformed_ring = [
        [_dot2(point, direction), _dot2(point, normal)]
        for point in ring
    ]
    fixed_value = _dot2(start, normal)
    start_u = _dot2(start, direction)
    end_u = _dot2(end, direction)
    segment_min, segment_max = sorted((start_u, end_u))
    result: list[dict[str, Any]] = []
    for interval_start, interval_end in _line_intervals_in_ring(transformed_ring, 1, fixed_value):
        clipped_start = max(segment_min, interval_start)
        clipped_end = min(segment_max, interval_end)
        if clipped_end - clipped_start <= 1e-3:
            continue

        def point_at(coordinate: float) -> list[float]:
            ratio = (coordinate - start_u) / (end_u - start_u)
            return [
                direction[0] * coordinate + normal[0] * fixed_value,
                direction[1] * coordinate + normal[1] * fixed_value,
                start[2] + (end[2] - start[2]) * ratio,
            ]

        result.append({
            "role": segment["role"],
            "start": point_at(clipped_start),
            "end": point_at(clipped_end),
        })
    return result


def _segment_on_plan_ring_boundary(
    start: Sequence[float],
    end: Sequence[float],
    ring: Sequence[Sequence[float]],
) -> bool:
    return any(
        _point_on_segment(start, edge_start, ring[(index + 1) % len(ring)])
        and _point_on_segment(end, edge_start, ring[(index + 1) % len(ring)])
        for index, edge_start in enumerate(ring)
    )


def _cross3(left: Sequence[float], right: Sequence[float]) -> list[float]:
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]


def _try_merge_segments(first: Mapping[str, Any], second: Mapping[str, Any]) -> dict[str, Any] | None:
    if first["role"] != second["role"]:
        return None
    first_direction = [first["end"][axis] - first["start"][axis] for axis in range(3)]
    second_direction = [second["end"][axis] - second["start"][axis] for axis in range(3)]
    first_length = math.sqrt(sum(value * value for value in first_direction))
    second_length = math.sqrt(sum(value * value for value in second_direction))
    if first_length <= 1e-6 or second_length <= 1e-6:
        return None
    unit = [value / first_length for value in first_direction]
    second_unit = [value / second_length for value in second_direction]
    if abs(abs(sum(unit[axis] * second_unit[axis] for axis in range(3))) - 1) > 1e-7:
        return None
    offset = [second["start"][axis] - first["start"][axis] for axis in range(3)]
    if math.sqrt(sum(value * value for value in _cross3(offset, unit))) > 0.05:
        return None

    candidates = [first["start"], first["end"], second["start"], second["end"]]
    projections = [
        sum((point[axis] - first["start"][axis]) * unit[axis] for axis in range(3))
        for point in candidates
    ]
    first_interval = sorted(projections[:2])
    second_interval = sorted(projections[2:])
    if max(first_interval[0], second_interval[0]) - min(first_interval[1], second_interval[1]) > 0.05:
        return None
    minimum_index = min(range(4), key=projections.__getitem__)
    maximum_index = max(range(4), key=projections.__getitem__)
    return {"role": first["role"], "start": list(candidates[minimum_index]), "end": list(candidates[maximum_index])}


def _segment_line_key(segment: Mapping[str, Any]) -> tuple[Any, ...] | None:
    direction = [segment["end"][axis] - segment["start"][axis] for axis in range(3)]
    length = math.sqrt(sum(value * value for value in direction))
    if length <= 1e-6:
        return None
    unit = [value / length for value in direction]
    for value in unit:
        if abs(value) <= 1e-9:
            continue
        if value < 0:
            unit = [-coordinate for coordinate in unit]
        break
    moment = _cross3(segment["start"], unit)
    return (
        segment["role"],
        *(round(value, 6) for value in unit),
        *(round(value, 1) for value in moment),
    )


def _merge_collinear_segments(segments: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
    for source in segments:
        current = {"role": source["role"], "start": list(source["start"]), "end": list(source["end"])}
        key = _segment_line_key(current)
        if key is None:
            continue
        buckets.setdefault(key, []).append(current)

    merged: list[dict[str, Any]] = []
    for bucket in buckets.values():
        bucket_merged: list[dict[str, Any]] = []
        for current in bucket:
            index = 0
            while index < len(bucket_merged):
                combination = _try_merge_segments(current, bucket_merged[index])
                if combination is None:
                    index += 1
                    continue
                current = combination
                bucket_merged.pop(index)
                index = 0
            bucket_merged.append(current)
        merged.extend(bucket_merged)
    return merged


def _edge_key(start: Sequence[float], end: Sequence[float]) -> tuple[tuple[float, ...], tuple[float, ...]]:
    first = tuple(round(value, 3) for value in start)
    second = tuple(round(value, 3) for value in end)
    return (first, second) if first <= second else (second, first)


def _planes_match(first: Sequence[float], second: Sequence[float]) -> bool:
    return (
        abs(first[0] - second[0]) <= 1e-6
        and abs(first[1] - second[1]) <= 1e-6
        and abs(first[2] - second[2]) <= 0.02
    )


def _segment_intersection_parameters(
    first_start: Sequence[float],
    first_end: Sequence[float],
    second_start: Sequence[float],
    second_end: Sequence[float],
) -> tuple[float, float] | None:
    first_direction = [first_end[0] - first_start[0], first_end[1] - first_start[1]]
    second_direction = [second_end[0] - second_start[0], second_end[1] - second_start[1]]
    denominator = first_direction[0] * second_direction[1] - first_direction[1] * second_direction[0]
    if abs(denominator) <= 1e-9:
        return None
    delta = [second_start[0] - first_start[0], second_start[1] - first_start[1]]
    first_ratio = (delta[0] * second_direction[1] - delta[1] * second_direction[0]) / denominator
    second_ratio = (delta[0] * first_direction[1] - delta[1] * first_direction[0]) / denominator
    if -1e-7 <= first_ratio <= 1 + 1e-7 and -1e-7 <= second_ratio <= 1 + 1e-7:
        return max(0.0, min(1.0, first_ratio)), max(0.0, min(1.0, second_ratio))
    return None


def _rafter_notches(
    rafter: Mapping[str, Any],
    purlins: Sequence[Mapping[str, Any]],
    rafter_config: Mapping[str, float],
    purlin_config: Mapping[str, float],
) -> list[dict[str, Any]]:
    notches: list[dict[str, Any]] = []
    rafter_plan = [
        rafter["end"][0] - rafter["start"][0],
        rafter["end"][1] - rafter["start"][1],
    ]
    rafter_plan_length = math.hypot(*rafter_plan)
    if rafter_plan_length <= 1e-6:
        return notches
    for index, purlin in enumerate(purlins):
        intersection = _segment_intersection_parameters(
            rafter["start"], rafter["end"], purlin["start"], purlin["end"]
        )
        if intersection is None:
            continue
        purlin_plan = [
            purlin["end"][0] - purlin["start"][0],
            purlin["end"][1] - purlin["start"][1],
        ]
        purlin_plan_length = math.hypot(*purlin_plan)
        if purlin_plan_length <= 1e-6:
            continue
        sine = abs(
            rafter_plan[0] * purlin_plan[1] - rafter_plan[1] * purlin_plan[0]
        ) / (rafter_plan_length * purlin_plan_length)
        notch_length = min(
            purlin_config["width_mm"] * 3,
            purlin_config["width_mm"] / max(0.35, sine),
        )
        notches.append({
            "notch_ref": f"birdsmouth_{index + 1}",
            "support_role": purlin["role"],
            "center_ratio": round(intersection[0], 9),
            "length_mm": round(notch_length, 3),
            "depth_mm": rafter_config["birdsmouth_depth_mm"],
            "cut_from": "underside",
        })
    notches.sort(key=lambda notch: notch["center_ratio"])
    return notches


def _purlin_support_vertical_factor(
    segment: Mapping[str, Any],
    prepared_faces: Sequence[Mapping[str, Any]],
) -> float:
    """Return cos(slope) for the roof face(s) carried by one purlin segment."""
    midpoint = [
        (segment["start"][0] + segment["end"][0]) / 2,
        (segment["start"][1] + segment["end"][1]) / 2,
    ]
    support_height = (segment["start"][2] + segment["end"][2]) / 2
    factors: list[float] = []
    for face in prepared_faces:
        ring = [[point[0], point[1]] for point in face["points"]]
        if not _point_in_ring(midpoint, ring):
            continue
        a, b, c = face["plane"]
        if abs(a * midpoint[0] + b * midpoint[1] + c - support_height) > 0.5:
            continue
        factors.append(1 / math.sqrt(1 + a * a + b * b))
    if not factors:
        return 1.0
    return max(1e-6, sum(factors) / len(factors))


def _surface_structure(
    faces: Sequence[Mapping[str, Any]],
    parameters: Mapping[str, Any],
    angle: float,
    coverage: Sequence[Sequence[float]],
    roof_type: str,
    purlin_bearing_ring: Sequence[Sequence[float]],
) -> dict[str, Any]:
    """Generate members on the actual roof faces instead of a generic roof profile."""
    rafter_config = parameters["structure"]["rafter"]
    purlin_config = parameters["structure"]["purlin"]
    default_rafter = _normalized2(_to_world([0, 1], angle))
    centre = [
        sum(point[0] for point in coverage) / len(coverage),
        sum(point[1] for point in coverage) / len(coverage),
    ]
    prepared: list[dict[str, Any]] = []
    raw_rafters: list[dict[str, Any]] = []
    raw_purlins: list[dict[str, Any]] = []

    for face in faces:
        points = face["polygon_3d_mm"]
        plane = _plane_for_face(points)
        if plane is None or abs(_ring_area([[point[0], point[1]] for point in points])) <= 1e-3:
            # Northlights and other vertical closure faces are not roof-bearing planes.
            continue
        gradient = [plane[0], plane[1]]
        gradient_length = math.hypot(*gradient)
        rafter_direction = _normalized2(gradient) if gradient_length > 1e-9 else default_rafter
        purlin_direction = [-rafter_direction[1], rafter_direction[0]]
        prepared.append({
            "points": points,
            "plane": plane,
            "rafter_direction": rafter_direction,
            "purlin_direction": purlin_direction,
        })
        raw_rafters.extend(_face_grid_segments(
            points, plane, rafter_direction, rafter_config["spacing_mm"], centre, "rafter",
        ))
        surface_factor = math.sqrt(1 + gradient_length * gradient_length)
        purlin_normal = [-purlin_direction[1], purlin_direction[0]]
        projected = [_dot2(point, purlin_normal) for point in points]
        sloped_span = (max(projected) - min(projected)) * surface_factor
        if sloped_span > purlin_config["middle_span_threshold_mm"] + 1e-6:
            middle_count = max(1, math.ceil(sloped_span / purlin_config["maximum_spacing_mm"]) - 1)
            positions = [
                min(projected) + (max(projected) - min(projected)) * index / (middle_count + 1)
                for index in range(1, middle_count + 1)
            ]
            raw_purlins.extend(_face_segments_at_positions(
                points,
                plane,
                purlin_direction,
                positions,
                "middle_purlin",
            ))

    edges: dict[tuple[tuple[float, ...], tuple[float, ...]], list[dict[str, Any]]] = {}
    for face_index, face in enumerate(prepared):
        points = face["points"]
        for point_index, start in enumerate(points):
            end = points[(point_index + 1) % len(points)]
            if _distance3(start, end) <= 1e-3:
                continue
            edges.setdefault(_edge_key(start, end), []).append({
                "start": start,
                "end": end,
                "face_index": face_index,
            })

    all_heights = [point[2] for face in prepared for point in face["points"]]
    minimum_height = min(all_heights) if all_heights else 0
    maximum_height = max(all_heights) if all_heights else 0
    for occurrences in edges.values():
        first = occurrences[0]
        start, end = first["start"], first["end"]
        plan_length = math.hypot(end[0] - start[0], end[1] - start[1])
        if plan_length <= 1e-3:
            continue
        face = prepared[first["face_index"]]
        shared_feature = len(occurrences) > 1 and any(
            not _planes_match(face["plane"], prepared[item["face_index"]]["plane"])
            for item in occurrences[1:]
        )
        if len(occurrences) > 1 and not shared_feature:
            continue

        edge_direction = [(end[0] - start[0]) / plan_length, (end[1] - start[1]) / plan_length]
        rafter_alignment = abs(_dot2(edge_direction, face["rafter_direction"]))
        purlin_alignment = abs(_dot2(edge_direction, face["purlin_direction"]))
        height_delta = abs(end[2] - start[2])
        if shared_feature:
            if height_delta > 0.05:
                raw_rafters.append({"role": "hip_rafter", "start": start, "end": end})
                continue
            average_height = (start[2] + end[2]) / 2
            role = "ridge_purlin" if average_height >= maximum_height - 0.05 else (
                "valley_purlin" if average_height <= minimum_height + 0.05 else "purlin"
            )
            raw_purlins.append({"role": role, "start": start, "end": end})
        elif rafter_alignment >= purlin_alignment:
            raw_rafters.append({"role": "edge_rafter", "start": start, "end": end})
        elif not _segment_on_plan_ring_boundary(start, end, coverage):
            average_height = (start[2] + end[2]) / 2
            role = "ridge_purlin" if average_height >= maximum_height - 0.05 else "purlin"
            raw_purlins.append({"role": role, "start": start, "end": end})

    # Roof coverage moves with the overhang. The load-bearing eaves purlins
    # belong to the marked building footprint and therefore use a fixed inset.
    for edge_index, start_xy in enumerate(purlin_bearing_ring):
        end_xy = purlin_bearing_ring[(edge_index + 1) % len(purlin_bearing_ring)]
        plan_length = math.dist(start_xy, end_xy)
        if plan_length <= 1e-3:
            continue
        edge_direction = [
            (end_xy[0] - start_xy[0]) / plan_length,
            (end_xy[1] - start_xy[1]) / plan_length,
        ]
        for face in prepared:
            rafter_alignment = abs(_dot2(edge_direction, face["rafter_direction"]))
            purlin_alignment = abs(_dot2(edge_direction, face["purlin_direction"]))
            if (
                roof_type not in {"hipped", "half_hipped", "pyramid"}
                and purlin_alignment + 1e-7 < rafter_alignment
            ):
                continue
            a, b, c = face["plane"]
            candidate = {
                "role": "eaves_purlin",
                "start": [start_xy[0], start_xy[1], a * start_xy[0] + b * start_xy[1] + c],
                "end": [end_xy[0], end_xy[1], a * end_xy[0] + b * end_xy[1] + c],
            }
            face_ring = [[point[0], point[1]] for point in face["points"]]
            raw_purlins.extend(_clip_segment_to_plan_ring(candidate, face_ring))

    # Ridge and middle purlins are also cut back to the same bearing polygon so
    # no purlin end can drift into the roof overhang.
    raw_purlins = [
        clipped
        for segment in raw_purlins
        for clipped in _clip_segment_to_plan_ring(segment, purlin_bearing_ring)
    ]

    rafter_segments = _merge_collinear_segments(raw_rafters)
    purlin_segments = _merge_collinear_segments(raw_purlins)
    rafters = []
    for index, segment in enumerate(rafter_segments):
        height_axis = _rafter_height_axis(segment["start"], segment["end"])
        centre_offset = -rafter_config["height_mm"] / 2
        notches = _rafter_notches(segment, purlin_segments, rafter_config, purlin_config)
        rafters.append(_member(
            f"rafter_{index + 1}",
            segment["role"],
            _offset3(segment["start"], height_axis, centre_offset),
            _offset3(segment["end"], height_axis, centre_offset),
            rafter_config,
            height_axis=height_axis,
            support_start=segment["start"],
            support_end=segment["end"],
            notches=notches,
        ))
    purlins = []
    purlin_height_axis = [0.0, 0.0, 1.0]
    for index, segment in enumerate(purlin_segments):
        vertical_height_factor = _purlin_support_vertical_factor(segment, prepared)
        # The rafter height is perpendicular to the roof face. At the fixed
        # purlin plan coordinate the corresponding vertical drop is d/cos(a),
        # not d*cos(a). The old multiplication made purlins float inside/above
        # pitched rafters and became increasingly wrong at steep pitches.
        contact_drop = (
            rafter_config["height_mm"] - rafter_config["birdsmouth_depth_mm"]
        ) / vertical_height_factor
        purlin_centre_drop = contact_drop + purlin_config["height_mm"] / 2
        member = _member(
            f"purlin_{index + 1}",
            segment["role"],
            _offset3(segment["start"], purlin_height_axis, -purlin_centre_drop),
            _offset3(segment["end"], purlin_height_axis, -purlin_centre_drop),
            purlin_config,
            height_axis=purlin_height_axis,
            support_start=segment["start"],
            support_end=segment["end"],
            section_orientation="vertical",
        )
        member["support_vertical_factor"] = round(vertical_height_factor, 9)
        member["top_bearing_start_3d_mm"] = [
            round(segment["start"][0], 6),
            round(segment["start"][1], 6),
            round(segment["start"][2] - contact_drop, 6),
        ]
        member["top_bearing_end_3d_mm"] = [
            round(segment["end"][0], 6),
            round(segment["end"][1], 6),
            round(segment["end"][2] - contact_drop, 6),
        ]
        purlins.append(member)
    return {
        "rafter_configuration": rafter_config,
        "purlin_configuration": purlin_config,
        "bearing_model": {
            "birdsmouth_depth_mm": rafter_config["birdsmouth_depth_mm"],
            "purlin_top_penetration_mm": rafter_config["birdsmouth_depth_mm"],
            "purlin_edge_offset_mm": PURLIN_BEARING_OFFSET_MM,
            "purlin_plan_reference": "source_footprint",
            "purlin_bearing_polygon_mm": [list(point) for point in purlin_bearing_ring],
            "description": "Vertical purlin top bears directly in the rafter underside birdsmouth",
        },
        "rafters": rafters,
        "purlins": purlins,
        "summary": {
            "rafter_count": len(rafters),
            "purlin_count": len(purlins),
            "timber_volume_m3": round(sum(member["timber_volume_m3"] for member in [*rafters, *purlins]), 6),
        },
    }


def _roof_build_up(
    faces: Sequence[Mapping[str, Any]],
    parameters: Mapping[str, Any],
    angle: float,
    coverage: Sequence[Sequence[float]],
) -> dict[str, Any]:
    config = parameters["roof_build_up"]
    rafter_config = parameters["structure"]["rafter"]
    counter_config = config["counter_batten"]
    tile_batten_config = config["tile_batten"]
    mode = config["insulation_mode"]
    insulation = config["insulation_thickness_mm"]
    above_rafter_insulation = insulation if mode == "above" else 0.0
    sheathing_bottom = above_rafter_insulation
    sheathing_top = sheathing_bottom + config["sheathing_thickness_mm"]
    underlay_top = sheathing_top + config["underlay_thickness_mm"]
    counter_top = underlay_top + counter_config["height_mm"]
    tile_batten_top = counter_top + tile_batten_config["height_mm"]
    tile_top = tile_batten_top + config["tile_thickness_mm"]
    if mode == "between":
        insulation_bottom, insulation_top = -insulation, 0.0
    elif mode == "below":
        insulation_top = -rafter_config["height_mm"]
        insulation_bottom = insulation_top - insulation
    else:
        insulation_bottom, insulation_top = 0.0, insulation

    centre = [
        sum(point[0] for point in coverage) / len(coverage),
        sum(point[1] for point in coverage) / len(coverage),
    ]
    default_rafter = _normalized2(_to_world([0, 1], angle))
    counter_battens: list[dict[str, Any]] = []
    tile_battens: list[dict[str, Any]] = []
    roof_caps: list[dict[str, Any]] = []
    top_faces: list[dict[str, Any]] = []
    edge_occurrences: dict[tuple[tuple[float, ...], tuple[float, ...]], list[dict[str, Any]]] = {}

    for face in faces:
        points = face["polygon_3d_mm"]
        plane = _plane_for_face(points)
        if plane is None or abs(_ring_area([[point[0], point[1]] for point in points])) <= 1e-3:
            continue
        gradient = [plane[0], plane[1]]
        gradient_length = math.hypot(*gradient)
        rafter_direction = _normalized2(gradient) if gradient_length > 1e-9 else default_rafter
        purlin_direction = [-rafter_direction[1], rafter_direction[0]]
        height_axis = _normalized3([-plane[0], -plane[1], 1.0])
        top_faces.append({
            "face_ref": face["face_ref"],
            "outward_normal_3d": [round(value, 9) for value in height_axis],
            "polygon_3d_mm": [
                [round(value, 6) for value in _offset3(point, height_axis, tile_top)]
                for point in points
            ],
        })
        for edge_index, edge_start in enumerate(points):
            edge_end = points[(edge_index + 1) % len(points)]
            if _distance3(edge_start, edge_end) <= 1e-3:
                continue
            edge_occurrences.setdefault(_edge_key(edge_start, edge_end), []).append({
                "start": edge_start,
                "end": edge_end,
                "normal": height_axis,
                "face_role": face["role"],
            })

        for raw in _face_grid_segments(
            points, plane, rafter_direction, rafter_config["spacing_mm"], centre, "counter_batten"
        ):
            centre_offset = underlay_top + counter_config["height_mm"] / 2
            member = _member(
                f"counter_batten_{len(counter_battens) + 1}",
                raw["role"],
                _offset3(raw["start"], height_axis, centre_offset),
                _offset3(raw["end"], height_axis, centre_offset),
                counter_config,
                height_axis=height_axis,
                support_start=raw["start"],
                support_end=raw["end"],
            )
            member["face_ref"] = face["face_ref"]
            counter_battens.append(member)

        surface_factor = math.sqrt(1 + gradient_length * gradient_length)
        for raw in _face_grid_segments(
            points,
            plane,
            purlin_direction,
            tile_batten_config["spacing_mm"] / surface_factor,
            centre,
            "tile_batten",
        ):
            centre_offset = counter_top + tile_batten_config["height_mm"] / 2
            member = _member(
                f"tile_batten_{len(tile_battens) + 1}",
                raw["role"],
                _offset3(raw["start"], height_axis, centre_offset),
                _offset3(raw["end"], height_axis, centre_offset),
                tile_batten_config,
                height_axis=height_axis,
                support_start=raw["start"],
                support_end=raw["end"],
            )
            member["face_ref"] = face["face_ref"]
            tile_battens.append(member)

    all_face_heights = [point[2] for face in faces for point in face["polygon_3d_mm"]]
    maximum_height = max(all_face_heights) if all_face_heights else 0.0
    for occurrences in edge_occurrences.values():
        if len(occurrences) < 2:
            continue
        first = occurrences[0]
        barrel_transition = any(
            occurrence["face_role"] == "barrel-segment"
            for occurrence in occurrences
        )
        if not barrel_transition and all(
            sum(first["normal"][axis] * occurrence["normal"][axis] for axis in range(3))
            >= math.cos(math.radians(20))
            for occurrence in occurrences[1:]
        ):
            continue
        average_normal = _normalized3([
            sum(occurrence["normal"][axis] for occurrence in occurrences)
            for axis in range(3)
        ])
        average_height = (first["start"][2] + first["end"][2]) / 2
        height_delta = abs(first["end"][2] - first["start"][2])
        role = "barrel_transition_cap" if barrel_transition else (
            "ridge_cap" if height_delta <= 0.05 and average_height >= maximum_height - 0.05 else (
                "hip_cap" if height_delta > 0.05 else "roof_transition_cap"
            )
        )
        cap_section = (
            {"width_mm": 120.0, "height_mm": 30.0}
            if barrel_transition
            else {"width_mm": 300.0, "height_mm": 50.0}
        )
        roof_caps.append(_member(
            f"roof_cap_{len(roof_caps) + 1}",
            role,
            _offset3(first["start"], average_normal, tile_top),
            _offset3(first["end"], average_normal, tile_top),
            cap_section,
            height_axis=average_normal,
            support_start=first["start"],
            support_end=first["end"],
        ))

    layers = [
        {
            "role": "insulation",
            "placement": mode,
            "material_ref": "mineral-wool-insulation",
            "thickness_mm": insulation,
            "bottom_offset_mm": round(insulation_bottom, 3),
            "top_offset_mm": round(insulation_top, 3),
        },
        {
            "role": "roof_sheathing",
            "material_ref": "timber-roof-sheathing",
            "thickness_mm": config["sheathing_thickness_mm"],
            "bottom_offset_mm": round(sheathing_bottom, 3),
            "top_offset_mm": round(sheathing_top, 3),
        },
        {
            "role": "underlay",
            "material_ref": "roof-underlay-membrane",
            "thickness_mm": config["underlay_thickness_mm"],
            "bottom_offset_mm": round(sheathing_top, 3),
            "top_offset_mm": round(underlay_top, 3),
        },
        {
            "role": "counter_batten",
            "material_ref": "construction-timber",
            "thickness_mm": counter_config["height_mm"],
            "bottom_offset_mm": round(underlay_top, 3),
            "top_offset_mm": round(counter_top, 3),
        },
        {
            "role": "tile_batten",
            "material_ref": "construction-timber",
            "thickness_mm": tile_batten_config["height_mm"],
            "bottom_offset_mm": round(counter_top, 3),
            "top_offset_mm": round(tile_batten_top, 3),
        },
        {
            "role": "roof_tile",
            "material_ref": config["tile_material_ref"],
            "thickness_mm": config["tile_thickness_mm"],
            "bottom_offset_mm": round(tile_batten_top, 3),
            "top_offset_mm": round(tile_top, 3),
        },
    ]
    return {
        "insulation_mode": mode,
        "layers": layers,
        "exterior_offset_mm": round(tile_top, 3),
        "top_faces": top_faces,
        "counter_battens": counter_battens,
        "tile_battens": tile_battens,
        "roof_caps": roof_caps,
        "summary": {
            "counter_batten_count": len(counter_battens),
            "tile_batten_count": len(tile_battens),
            "roof_cap_count": len(roof_caps),
            "top_material_ref": config["tile_material_ref"],
        },
    }


def calculate_roof(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Calculate a deterministic parametric roof envelope, skin, rafters and purlins."""
    if not isinstance(payload, Mapping):
        raise RoofCalculationError(["$ must be a JSON object"])
    request = _normalize_request(payload)
    ring = request["footprint"]["outer_ring_mm"]
    parameters = request["parameters"]
    overhangs = _edge_overhangs(parameters["overhang_mm"], ring)
    coverage = _offset_polygon(ring, overhangs)
    warnings: list[str] = []
    if len(coverage) < 3 or abs(_ring_area(coverage)) < 1 or _ring_self_intersects(coverage):
        coverage = [point[:] for point in ring]
        warnings.append(
            "The requested edge offsets produced an ambiguous polygon; the source footprint was used as roof coverage."
        )
    purlin_bearing_ring = _offset_polygon(
        ring, [-PURLIN_BEARING_OFFSET_MM] * len(ring)
    )
    if (
        len(purlin_bearing_ring) < 3
        or abs(_ring_area(purlin_bearing_ring)) < 1
        or _ring_self_intersects(purlin_bearing_ring)
    ):
        raise RoofCalculationError([
            "$.footprint.outer_ring_mm must leave a valid interior for the required 205 mm purlin edge offset"
        ])
    angle = _ridge_angle(parameters, coverage)
    local = [_to_local(point, angle) for point in coverage]
    bounds = {
        "umin": min(point[0] for point in local),
        "umax": max(point[0] for point in local),
        "vmin": min(point[1] for point in local),
        "vmax": max(point[1] for point in local),
    }
    rectangular_envelope = _coverage_matches_bounds(local, bounds)
    faces = (
        _build_faces(request["roof_type"], bounds, parameters, angle, coverage)
        if rectangular_envelope
        else _build_polygon_faces(request["roof_type"], bounds, parameters, angle, coverage)
    )
    structure = _surface_structure(
        faces, parameters, angle, coverage, request["roof_type"], purlin_bearing_ring
    )
    roof_build_up = _roof_build_up(faces, parameters, angle, coverage)
    surface_area = sum(face["surface_area_m2"] for face in faces)
    skin_thickness = roof_build_up["exterior_offset_mm"]
    normalized = {**request, "parameters": {**parameters, "overhang_mm": {"edges_mm": overhangs}}}
    fingerprint_source = json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:20]
    middle_v = (bounds["vmin"] + bounds["vmax"]) / 2
    ridge_intervals = _line_intervals_in_ring(local, 1, middle_v)
    ridge_interval = max(ridge_intervals, key=lambda interval: interval[1] - interval[0]) if ridge_intervals else (bounds["umin"], bounds["umax"])
    ridge_local = [[ridge_interval[0], middle_v], [ridge_interval[1], middle_v]]
    ridge_world = [_to_world(point, angle) for point in ridge_local]
    return {
        "ok": True,
        "contract_version": RESULT_CONTRACT,
        "calculation_id": f"roof_{fingerprint}",
        "input_fingerprint": fingerprint,
        "roof_type": request["roof_type"],
        "geometry_method": "parametric-envelope-v1" if rectangular_envelope else "polygon-clipped-v2",
        "warnings": warnings,
        "coordinate_system": {"plan_unit": "mm", "height_unit": "mm", "axes": "cad-plan-x-y-z"},
        "normalized_request": normalized,
        "geometry": {
            "source_footprint_mm": ring,
            "roof_coverage_polygon_mm": coverage,
            "purlin_bearing_polygon_mm": purlin_bearing_ring,
            "edge_overhangs_mm": overhangs,
            "ridge_direction_deg": round(math.degrees(angle), 6),
            "ridge_line_mm": [[round(value, 6) for value in point] for point in ridge_world],
            "envelope_bounds_local_mm": {key: round(value, 6) for key, value in bounds.items()},
            "faces": faces,
        },
        "roof_skin": {
            "material_ref": parameters["roof_build_up"]["tile_material_ref"],
            "thickness_mm": skin_thickness,
            "surface_area_m2": round(surface_area, 6),
            "volume_m3": round(surface_area * skin_thickness / 1000, 6),
            "face_refs": [face["face_ref"] for face in faces],
        },
        "roof_build_up": roof_build_up,
        "structure": structure,
        "summary": {
            "face_count": len(faces),
            "roof_surface_area_m2": round(surface_area, 6),
            "maximum_height_mm": round(max(point[2] for face in faces for point in face["polygon_3d_mm"]), 3),
            "rafter_count": structure["summary"]["rafter_count"],
            "purlin_count": structure["summary"]["purlin_count"],
            "counter_batten_count": roof_build_up["summary"]["counter_batten_count"],
            "tile_batten_count": roof_build_up["summary"]["tile_batten_count"],
        },
        "recalculation": {
            "stateless": True,
            "variables": [
                "footprint.outer_ring_mm", "roof_type", "parameters.pitch_deg", "parameters.eaves_height_mm",
                "parameters.ridge_direction", "parameters.overhang_mm.default_mm", "parameters.overhang_mm.north_mm",
                "parameters.overhang_mm.east_mm", "parameters.overhang_mm.south_mm", "parameters.overhang_mm.west_mm",
                "parameters.overhang_mm.edges_mm", "parameters.roof_skin_thickness_mm", "parameters.roof_skin_material",
                "parameters.roof_build_up",
                "parameters.plateau_width_ratio", "parameters.hip_end_ratio",
                "parameters.mansard_break_ratio", "parameters.mansard_lower_pitch_deg", "parameters.mansard_upper_pitch_deg",
                "parameters.barrel_rise_mm", "parameters.barrel_segment_count", "parameters.sawtooth_count", "parameters.sawtooth_pitch_deg",
                "parameters.structure.rafter", "parameters.structure.purlin",
            ],
            "dependent_results": ["geometry.faces", "roof_skin", "roof_build_up", "structure.rafters", "structure.purlins", "summary"],
        },
        "export": {"media_type": "application/json", "suggested_filename": f"vectoplan-roof-{request['roof_type']}-{fingerprint}.json"},
    }
