from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping, Sequence
from typing import Any


REQUEST_CONTRACT = "cad-auto-dimension-request/0.1"
RESULT_CONTRACT = "cad-auto-dimension-result/0.1"


class DimensionCalculationError(ValueError):
    def __init__(self, errors: Sequence[str]):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors))


def _point(value: Any, path: str, errors: list[str]) -> list[float] | None:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)) or len(value) != 2:
        errors.append(f"{path} must contain exactly two coordinates")
        return None
    try:
        point = [float(value[0]), float(value[1])]
    except (TypeError, ValueError):
        errors.append(f"{path} coordinates must be numbers")
        return None
    if not all(math.isfinite(coordinate) for coordinate in point):
        errors.append(f"{path} coordinates must be finite")
        return None
    return point


def _positive(value: Any, default: float, minimum: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) and number >= minimum else default


def _distance(left: Sequence[float], right: Sequence[float]) -> float:
    return math.hypot(right[0] - left[0], right[1] - left[1])


def _ring_area(ring: Sequence[Sequence[float]]) -> float:
    return sum(
        ring[index][0] * ring[(index + 1) % len(ring)][1]
        - ring[(index + 1) % len(ring)][0] * ring[index][1]
        for index in range(len(ring))
    ) / 2


def _normal(start: Sequence[float], end: Sequence[float], *, outward_sign: float = 1.0) -> list[float]:
    length = max(_distance(start, end), 1e-9)
    return [(end[1] - start[1]) / length * outward_sign, -(end[0] - start[0]) / length * outward_sign]


def _offset(point: Sequence[float], normal: Sequence[float], distance: float) -> list[float]:
    return [round(point[0] + normal[0] * distance, 6), round(point[1] + normal[1] * distance, 6)]


def _projection_parameter(point: Sequence[float], start: Sequence[float], end: Sequence[float]) -> tuple[float, float]:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    squared = dx * dx + dy * dy
    if squared <= 1e-9:
        return 0.0, _distance(point, start)
    parameter = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squared
    projected = [start[0] + parameter * dx, start[1] + parameter * dy]
    return parameter, _distance(point, projected)


def _measure(start: Sequence[float], end: Sequence[float], role: str, source_refs: Sequence[str]) -> dict[str, Any]:
    length = _distance(start, end)
    return {
        "start_mm": [round(start[0], 6), round(start[1], 6)],
        "end_mm": [round(end[0], 6), round(end[1], 6)],
        "length_mm": round(length, 3),
        "length_m": round(length / 1000, 6),
        "display": f"{length / 1000:.3f}".replace(".", ",") + " m",
        "role": role,
        "source_refs": list(source_refs),
    }


def _normalize_request(payload: Mapping[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if str(payload.get("contract_version") or REQUEST_CONTRACT) != REQUEST_CONTRACT:
        errors.append(f"$.contract_version must be {REQUEST_CONTRACT}")

    footprint = payload.get("footprint") if isinstance(payload.get("footprint"), Mapping) else {}
    raw_ring = footprint.get("outer_ring_mm") or footprint.get("outline_mm") or []
    ring = [point for index, value in enumerate(raw_ring) if (point := _point(value, f"$.footprint.outer_ring_mm[{index}]", errors))]
    if len(ring) > 1 and _distance(ring[0], ring[-1]) < 1e-6:
        ring.pop()
    if len(ring) < 3:
        errors.append("$.footprint.outer_ring_mm must contain at least three different points")
    elif abs(_ring_area(ring)) < 1:
        errors.append("$.footprint.outer_ring_mm must enclose an area")

    walls: list[dict[str, Any]] = []
    for index, raw in enumerate(payload.get("walls") or []):
        if not isinstance(raw, Mapping):
            errors.append(f"$.walls[{index}] must be an object")
            continue
        start = _point(raw.get("start_mm"), f"$.walls[{index}].start_mm", errors)
        end = _point(raw.get("end_mm"), f"$.walls[{index}].end_mm", errors)
        if not start or not end or _distance(start, end) < 1:
            errors.append(f"$.walls[{index}] must have a measurable length")
            continue
        walls.append({
            "wall_ref": str(raw.get("wall_ref") or f"wall_{index + 1}"),
            "kind": "interior" if str(raw.get("kind") or "").lower() in {"interior", "inside", "innen", "internal"} else "exterior",
            "start_mm": start,
            "end_mm": end,
            "thickness_mm": _positive(raw.get("thickness_mm"), 115, 1),
            "dimension_side": "right" if str(raw.get("dimension_side") or "left").lower() == "right" else "left",
        })

    wall_by_ref = {wall["wall_ref"]: wall for wall in walls}
    openings: list[dict[str, Any]] = []
    for index, raw in enumerate(payload.get("openings") or []):
        if not isinstance(raw, Mapping):
            errors.append(f"$.openings[{index}] must be an object")
            continue
        wall_ref = str(raw.get("wall_ref") or "")
        wall = wall_by_ref.get(wall_ref)
        if not wall:
            errors.append(f"$.openings[{index}].wall_ref must reference an existing wall")
            continue
        start = _point(raw.get("start_mm"), f"$.openings[{index}].start_mm", []) if raw.get("start_mm") is not None else None
        end = _point(raw.get("end_mm"), f"$.openings[{index}].end_mm", []) if raw.get("end_mm") is not None else None
        if not start or not end:
            wall_length = _distance(wall["start_mm"], wall["end_mm"])
            width = _positive(raw.get("width_mm"), 1000, 1)
            offset_from_start = _positive(raw.get("offset_from_start_mm"), max(0, (wall_length - width) / 2), 0)
            tangent = [
                (wall["end_mm"][0] - wall["start_mm"][0]) / wall_length,
                (wall["end_mm"][1] - wall["start_mm"][1]) / wall_length,
            ]
            start = [wall["start_mm"][0] + tangent[0] * offset_from_start, wall["start_mm"][1] + tangent[1] * offset_from_start]
            end = [start[0] + tangent[0] * width, start[1] + tangent[1] * width]
        openings.append({
            "opening_ref": str(raw.get("opening_ref") or f"opening_{index + 1}"),
            "wall_ref": wall_ref,
            "kind": str(raw.get("kind") or "door").lower(),
            "start_mm": start,
            "end_mm": end,
        })

    raw_options = payload.get("options") if isinstance(payload.get("options"), Mapping) else {}
    options = {
        "include_external": raw_options.get("include_external") is not False,
        "include_internal": raw_options.get("include_internal") is not False,
        "external_offset_mm": _positive(raw_options.get("external_offset_mm"), 1000, 1),
        "internal_offset_mm": _positive(raw_options.get("internal_offset_mm"), 350, 1),
        "chain_spacing_mm": _positive(raw_options.get("chain_spacing_mm"), 450, 1),
        "opening_tolerance_mm": _positive(raw_options.get("opening_tolerance_mm"), 75, 0),
        "minimum_segment_mm": _positive(raw_options.get("minimum_segment_mm"), 10, 0),
    }
    if errors:
        raise DimensionCalculationError(errors)
    return {"contract_version": REQUEST_CONTRACT, "footprint": {"outer_ring_mm": ring}, "walls": walls, "openings": openings, "options": options}


def _external_chains(request: Mapping[str, Any]) -> list[dict[str, Any]]:
    ring = request["footprint"]["outer_ring_mm"]
    openings = request["openings"]
    options = request["options"]
    outward_sign = 1.0 if _ring_area(ring) > 0 else -1.0
    chains: list[dict[str, Any]] = []
    for index, start in enumerate(ring):
        end = ring[(index + 1) % len(ring)]
        normal = _normal(start, end, outward_sign=outward_sign)
        edge_length = _distance(start, end)
        breakpoints = [(0.0, start, "edge_start", []), (1.0, end, "edge_end", [])]
        for opening in openings:
            for point, role in ((opening["start_mm"], "opening_start"), (opening["end_mm"], "opening_end")):
                parameter, distance = _projection_parameter(point, start, end)
                if -1e-6 <= parameter <= 1 + 1e-6 and distance <= options["opening_tolerance_mm"]:
                    projected = [start[0] + parameter * (end[0] - start[0]), start[1] + parameter * (end[1] - start[1])]
                    breakpoints.append((max(0.0, min(1.0, parameter)), projected, role, [opening["opening_ref"]]))
        ordered = sorted(breakpoints, key=lambda entry: entry[0])
        unique: list[tuple[float, Sequence[float], str, Sequence[str]]] = []
        for entry in ordered:
            if unique and abs(entry[0] - unique[-1][0]) * edge_length < options["minimum_segment_mm"]:
                continue
            unique.append(entry)
        dimension_offset = options["external_offset_mm"]
        dimension_points = [_offset(entry[1], normal, dimension_offset) for entry in unique]
        segments = [
            _measure(dimension_points[position], dimension_points[position + 1], "opening_chain", [*unique[position][3], *unique[position + 1][3]])
            for position in range(len(dimension_points) - 1)
            if _distance(dimension_points[position], dimension_points[position + 1]) >= options["minimum_segment_mm"]
        ]
        overall_offset = dimension_offset + options["chain_spacing_mm"]
        overall_start = _offset(start, normal, overall_offset)
        overall_end = _offset(end, normal, overall_offset)
        chains.append({
            "chain_ref": f"external_edge_{index + 1}",
            "category": "external",
            "edge_index": index,
            "normal": [round(normal[0], 8), round(normal[1], 8)],
            "dimension_line_mm": [dimension_points[0], dimension_points[-1]],
            "witness_lines_mm": [[start, overall_start], [end, overall_end]],
            "segments": segments,
            "overall": _measure(overall_start, overall_end, "overall", [f"footprint_edge_{index + 1}"]),
        })
    return chains


def _internal_chains(request: Mapping[str, Any]) -> list[dict[str, Any]]:
    options = request["options"]
    openings_by_wall: dict[str, list[dict[str, Any]]] = {}
    for opening in request["openings"]:
        openings_by_wall.setdefault(opening["wall_ref"], []).append(opening)
    chains: list[dict[str, Any]] = []
    for wall in request["walls"]:
        if wall["kind"] != "interior" and not openings_by_wall.get(wall["wall_ref"]):
            continue
        start = wall["start_mm"]
        end = wall["end_mm"]
        wall_length = _distance(start, end)
        normal_sign = -1.0 if wall["dimension_side"] == "right" else 1.0
        normal = _normal(start, end, outward_sign=normal_sign)
        tangent = [(end[0] - start[0]) / wall_length, (end[1] - start[1]) / wall_length]
        breakpoints: list[tuple[float, str, list[str]]] = [(0.0, "wall_start", [wall["wall_ref"]]), (wall_length, "wall_end", [wall["wall_ref"]])]
        for opening in openings_by_wall.get(wall["wall_ref"], []):
            parameters = sorted(_projection_parameter(point, start, end)[0] * wall_length for point in (opening["start_mm"], opening["end_mm"]))
            breakpoints.extend([
                (max(0.0, min(wall_length, parameters[0])), "opening_start", [opening["opening_ref"]]),
                (max(0.0, min(wall_length, parameters[1])), "opening_end", [opening["opening_ref"]]),
            ])
        ordered = sorted(breakpoints, key=lambda entry: entry[0])
        dimension_points = [
            _offset([start[0] + tangent[0] * entry[0], start[1] + tangent[1] * entry[0]], normal, options["internal_offset_mm"])
            for entry in ordered
        ]
        segments: list[dict[str, Any]] = []
        for index in range(len(dimension_points) - 1):
            length = ordered[index + 1][0] - ordered[index][0]
            if length < options["minimum_segment_mm"]:
                continue
            inside_opening = ordered[index][1] == "opening_start" and ordered[index + 1][1] == "opening_end"
            role = "opening_width" if inside_opening else "wall_section"
            segments.append(_measure(dimension_points[index], dimension_points[index + 1], role, [*ordered[index][2], *ordered[index + 1][2]]))
        chains.append({
            "chain_ref": f"internal_{wall['wall_ref']}",
            "category": "internal",
            "wall_ref": wall["wall_ref"],
            "normal": [round(normal[0], 8), round(normal[1], 8)],
            "dimension_line_mm": [dimension_points[0], dimension_points[-1]],
            "witness_lines_mm": [[start, dimension_points[0]], [end, dimension_points[-1]]],
            "segments": segments,
            "overall": _measure(dimension_points[0], dimension_points[-1], "wall_overall", [wall["wall_ref"]]),
        })
    return chains


def calculate_dimensions(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Calculate deterministic external and internal CAD dimension chains."""
    if not isinstance(payload, Mapping):
        raise DimensionCalculationError(["$ must be a JSON object"])
    request = _normalize_request(payload)
    chains: list[dict[str, Any]] = []
    if request["options"]["include_external"]:
        chains.extend(_external_chains(request))
    if request["options"]["include_internal"]:
        chains.extend(_internal_chains(request))
    fingerprint_source = json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()[:20]
    all_segments = [segment for chain in chains for segment in chain["segments"]]
    return {
        "ok": True,
        "contract_version": RESULT_CONTRACT,
        "calculation_id": f"dimensions_{fingerprint}",
        "input_fingerprint": fingerprint,
        "coordinate_system": {"unit": "mm", "axes": "cad-plan-x-y"},
        "normalized_request": request,
        "chains": chains,
        "summary": {
            "external_chain_count": sum(chain["category"] == "external" for chain in chains),
            "internal_chain_count": sum(chain["category"] == "internal" for chain in chains),
            "segment_count": len(all_segments),
            "opening_dimension_count": sum(segment["role"] == "opening_width" for segment in all_segments),
            "total_measured_length_mm": round(sum(segment["length_mm"] for segment in all_segments), 3),
        },
        "export": {"media_type": "application/json", "suggested_filename": f"vectoplan-dimensions-{fingerprint}.json"},
    }

