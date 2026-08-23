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
    normalized_parameters = {
        "pitch_deg": _number(parameters.get("pitch_deg"), 35, 0, 80),
        "eaves_height_mm": _number(parameters.get("eaves_height_mm"), 6000, -100000, 100000),
        "ridge_direction": parameters.get("ridge_direction", "auto"),
        "overhang_mm": parameters.get("overhang_mm", {"default_mm": 500}),
        "roof_skin_thickness_mm": _number(parameters.get("roof_skin_thickness_mm"), 180, 1, 2000),
        "roof_skin_material": str(parameters.get("roof_skin_material") or "generic-roof-build-up"),
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
                "height_mm": _number(rafter.get("height_mm"), 200, 20, 1500),
                "spacing_mm": _number(rafter.get("spacing_mm"), 700, 100, 3000),
            },
            "purlin": {
                "width_mm": _number(purlin.get("width_mm"), 160, 20, 1500),
                "height_mm": _number(purlin.get("height_mm"), 240, 20, 2000),
                "maximum_spacing_mm": _number(purlin.get("maximum_spacing_mm"), 2500, 250, 10000),
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
        rise = min(parameters["barrel_rise_mm"], half * 3)
        radius = (half * half + rise * rise) / max(2 * rise, 1)
        centre_height = rise - radius
        return eaves + centre_height + math.sqrt(max(0, radius * radius - (v - middle) ** 2))
    if roof_type == "sawtooth":
        tooth_width = span / max(1, parameters["sawtooth_count"])
        local = (v - vmin) % tooth_width
        return eaves + local * math.tan(math.radians(parameters["sawtooth_pitch_deg"]))
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
        peak_height = eaves + tooth_width * math.tan(math.radians(parameters["sawtooth_pitch_deg"]))
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
                ], parameters["sawtooth_pitch_deg"]),
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
        pitch = parameters["sawtooth_pitch_deg"]
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


def _member(member_ref: str, role: str, start: Sequence[float], end: Sequence[float], section: Mapping[str, float]) -> dict[str, Any]:
    length = _distance3(start, end)
    return {
        "member_ref": member_ref,
        "role": role,
        "start_3d_mm": [round(value, 6) for value in start],
        "end_3d_mm": [round(value, 6) for value in end],
        "length_mm": round(length, 3),
        "section_mm": {"width": section["width_mm"], "height": section["height_mm"]},
        "timber_volume_m3": round(length * section["width_mm"] * section["height_mm"] / 1_000_000_000, 8),
    }


def _structure(roof_type: str, bounds: Mapping[str, float], parameters: Mapping[str, Any], angle: float) -> dict[str, Any]:
    umin, umax, vmin, vmax = bounds["umin"], bounds["umax"], bounds["vmin"], bounds["vmax"]
    middle = (vmin + vmax) / 2
    rafter_config = parameters["structure"]["rafter"]
    purlin_config = parameters["structure"]["purlin"]
    rafter_count = max(2, math.ceil((umax - umin) / rafter_config["spacing_mm"]) + 1)
    rafter_positions = [umin + (umax - umin) * index / (rafter_count - 1) for index in range(rafter_count)]

    def vertex(u: float, v: float) -> list[float]:
        x, y = _to_world([u, v], angle)
        return [x, y, _roof_profile(roof_type, v, bounds, parameters)]

    rafters: list[dict[str, Any]] = []
    for index, u in enumerate(rafter_positions):
        if roof_type in {"flat", "pent"}:
            rafters.append(_member(f"rafter_{index + 1}", "rafter", vertex(u, vmin), vertex(u, vmax), rafter_config))
        else:
            rafters.extend([
                _member(f"rafter_{index + 1}_a", "rafter", vertex(u, vmin), vertex(u, middle), rafter_config),
                _member(f"rafter_{index + 1}_b", "rafter", vertex(u, middle), vertex(u, vmax), rafter_config),
            ])

    half_span = max((vmax - vmin) / 2, 1)
    purlin_steps = max(1, math.ceil(half_span / purlin_config["maximum_spacing_mm"]))
    v_positions = sorted({
        vmin + half_span * step / purlin_steps for step in range(purlin_steps + 1)
    } | {
        middle + half_span * step / purlin_steps for step in range(purlin_steps + 1)
    })
    purlins = [
        _member(f"purlin_{index + 1}", "ridge_purlin" if abs(v - middle) < 1e-6 else "purlin", vertex(umin, v), vertex(umax, v), purlin_config)
        for index, v in enumerate(v_positions)
    ]
    return {
        "rafter_configuration": rafter_config,
        "purlin_configuration": purlin_config,
        "rafters": rafters,
        "purlins": purlins,
        "summary": {
            "rafter_count": len(rafters),
            "purlin_count": len(purlins),
            "timber_volume_m3": round(sum(member["timber_volume_m3"] for member in [*rafters, *purlins]), 6),
        },
    }


def _polygon_structure(
    roof_type: str,
    bounds: Mapping[str, float],
    parameters: Mapping[str, Any],
    angle: float,
    coverage: Sequence[Sequence[float]],
) -> dict[str, Any]:
    local_ring = [_to_local(point, angle) for point in coverage]
    umin, umax, vmin, vmax = bounds["umin"], bounds["umax"], bounds["vmin"], bounds["vmax"]
    middle = (vmin + vmax) / 2
    rafter_config = parameters["structure"]["rafter"]
    purlin_config = parameters["structure"]["purlin"]

    def vertex(u: float, v: float) -> list[float]:
        world = _to_world([u, v], angle)
        return [*world, _height_for_local(roof_type, [u, v], local_ring, bounds, parameters)]

    rafter_count = max(2, math.ceil((umax - umin) / rafter_config["spacing_mm"]) + 1)
    rafter_positions = [umin + (umax - umin) * index / (rafter_count - 1) for index in range(rafter_count)]
    if roof_type == "sawtooth":
        tooth_width = (vmax - vmin) / parameters["sawtooth_count"]
        profile_breaks = [vmin + tooth_width * index for index in range(parameters["sawtooth_count"] + 1)]
    elif roof_type in {"flat", "pent"}:
        profile_breaks = [vmin, vmax]
    else:
        profile_breaks = sorted(set([*_profile_breaks(roof_type, bounds, parameters), middle]))
    rafters: list[dict[str, Any]] = []
    for u in rafter_positions:
        for interval_start, interval_end in _line_intervals_in_ring(local_ring, 0, u):
            parts = [interval_start, *(
                value for value in profile_breaks if interval_start + 1e-6 < value < interval_end - 1e-6
            ), interval_end]
            for start, end in zip(parts, parts[1:]):
                if end - start <= 1e-6:
                    continue
                rafters.append(_member(
                    f"rafter_{len(rafters) + 1}", "rafter", vertex(u, start), vertex(u, end), rafter_config,
                ))

    half_span = max((vmax - vmin) / 2, 1)
    purlin_steps = max(1, math.ceil(half_span / purlin_config["maximum_spacing_mm"]))
    v_positions = sorted({
        vmin + half_span * step / purlin_steps for step in range(purlin_steps + 1)
    } | {
        middle + half_span * step / purlin_steps for step in range(purlin_steps + 1)
    })
    purlins: list[dict[str, Any]] = []
    for v in v_positions:
        for interval_start, interval_end in _line_intervals_in_ring(local_ring, 1, v):
            purlins.append(_member(
                f"purlin_{len(purlins) + 1}",
                "ridge_purlin" if abs(v - middle) < 1e-6 else "purlin",
                vertex(interval_start, v), vertex(interval_end, v), purlin_config,
            ))
    return {
        "rafter_configuration": rafter_config,
        "purlin_configuration": purlin_config,
        "rafters": rafters,
        "purlins": purlins,
        "summary": {
            "rafter_count": len(rafters),
            "purlin_count": len(purlins),
            "timber_volume_m3": round(sum(member["timber_volume_m3"] for member in [*rafters, *purlins]), 6),
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
    structure = (
        _structure(request["roof_type"], bounds, parameters, angle)
        if rectangular_envelope
        else _polygon_structure(request["roof_type"], bounds, parameters, angle, coverage)
    )
    surface_area = sum(face["surface_area_m2"] for face in faces)
    skin_thickness = parameters["roof_skin_thickness_mm"]
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
            "edge_overhangs_mm": overhangs,
            "ridge_direction_deg": round(math.degrees(angle), 6),
            "ridge_line_mm": [[round(value, 6) for value in point] for point in ridge_world],
            "envelope_bounds_local_mm": {key: round(value, 6) for key, value in bounds.items()},
            "faces": faces,
        },
        "roof_skin": {
            "material_ref": parameters["roof_skin_material"],
            "thickness_mm": skin_thickness,
            "surface_area_m2": round(surface_area, 6),
            "volume_m3": round(surface_area * skin_thickness / 1000, 6),
            "face_refs": [face["face_ref"] for face in faces],
        },
        "structure": structure,
        "summary": {
            "face_count": len(faces),
            "roof_surface_area_m2": round(surface_area, 6),
            "maximum_height_mm": round(max(point[2] for face in faces for point in face["polygon_3d_mm"]), 3),
            "rafter_count": structure["summary"]["rafter_count"],
            "purlin_count": structure["summary"]["purlin_count"],
        },
        "recalculation": {
            "stateless": True,
            "variables": [
                "footprint.outer_ring_mm", "roof_type", "parameters.pitch_deg", "parameters.eaves_height_mm",
                "parameters.ridge_direction", "parameters.overhang_mm.default_mm", "parameters.overhang_mm.north_mm",
                "parameters.overhang_mm.east_mm", "parameters.overhang_mm.south_mm", "parameters.overhang_mm.west_mm",
                "parameters.overhang_mm.edges_mm", "parameters.roof_skin_thickness_mm", "parameters.roof_skin_material",
                "parameters.plateau_width_ratio", "parameters.hip_end_ratio",
                "parameters.mansard_break_ratio", "parameters.mansard_lower_pitch_deg", "parameters.mansard_upper_pitch_deg",
                "parameters.barrel_rise_mm", "parameters.barrel_segment_count", "parameters.sawtooth_count", "parameters.sawtooth_pitch_deg",
                "parameters.structure.rafter", "parameters.structure.purlin",
            ],
            "dependent_results": ["geometry.faces", "roof_skin", "structure.rafters", "structure.purlins", "summary"],
        },
        "export": {"media_type": "application/json", "suggested_filename": f"vectoplan-roof-{request['roof_type']}-{fingerprint}.json"},
    }
