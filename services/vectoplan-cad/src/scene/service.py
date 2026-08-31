from __future__ import annotations

from math import hypot, isfinite
from typing import Any


DEFAULT_LAYER_STYLES = {
    "walls": {"label": "Wände", "style_ref": "cut-heavy", "order": 20},
    "openings": {"label": "Öffnungen", "style_ref": "opening", "order": 30},
    "rooms": {"label": "Räume & Zonen", "style_ref": "room", "order": 10},
    "structure": {"label": "Tragwerk", "style_ref": "structure", "order": 40},
    "annotations": {"label": "Beschriftungen", "style_ref": "annotation", "order": 60},
    "dimensions": {"label": "Bemaßung", "style_ref": "dimension", "order": 70},
    "construction_slab": {"label": "Decken & Bodenplatten", "style_ref": "slab", "order": 5},
    "construction_roof": {"label": "Dächer", "style_ref": "roof", "order": 8},
    "construction_room": {"label": "Räume & Zonen", "style_ref": "room", "order": 10},
    "construction_wall": {"label": "Wände", "style_ref": "cut-heavy", "order": 20},
    "construction_beam": {"label": "Träger", "style_ref": "beam", "order": 24},
    "construction_column": {"label": "Stützen", "style_ref": "column", "order": 25},
    "construction_opening": {"label": "Öffnungen", "style_ref": "opening", "order": 30},
    "construction_window": {"label": "Fenster", "style_ref": "window", "order": 31},
    "construction_door": {"label": "Türen", "style_ref": "door", "order": 32},
    "construction_stair": {"label": "Treppen", "style_ref": "stair", "order": 35},
    "construction_component": {"label": "Bauteile", "style_ref": "component", "order": 40},
    "construction_unknown": {"label": "Ungeklärte Bauteile", "style_ref": "unresolved", "order": 90},
}


def build_scene(projection: dict[str, Any]) -> dict[str, Any]:
    """Resolve a projection contract into renderer-neutral primitives."""
    document = projection.get("document", {})
    return {
        "contract_version": "cad-scene/0.1",
        "source_contract_version": projection.get("contract_version"),
        "document_ref": document.get("document_ref"),
        "source_revision_ref": document.get("source_revision_ref"),
        "sheets": [_build_sheet_scene(sheet) for sheet in projection.get("sheets", [])],
    }


def _build_sheet_scene(sheet: dict[str, Any]) -> dict[str, Any]:
    elements = sheet.get("elements", [])
    return {
        "sheet_ref": sheet.get("sheet_ref"),
        "sheet_number": sheet.get("sheet_number"),
        "title": sheet.get("title"),
        "format": sheet.get("format"),
        "orientation": sheet.get("orientation"),
        "width_mm": sheet.get("width_mm"),
        "height_mm": sheet.get("height_mm"),
        "title_block": sheet.get("title_block"),
        "layers": _build_layers(elements),
        "viewports": [
            {
                **viewport,
                "primitives": _build_viewport_primitives(elements, viewport.get("viewport_ref")),
            }
            for viewport in sheet.get("viewports", [])
        ],
    }


def _build_viewport_primitives(elements: list[dict[str, Any]], viewport_ref: str | None) -> list[dict[str, Any]]:
    primitives = [
        _element_to_primitive(element)
        for element in elements
        if viewport_ref in element.get("view_refs", [])
    ]
    return _automate_wall_corner_joins(primitives)


def _line_intersection(
    first_start: list[float],
    first_end: list[float],
    second_start: list[float],
    second_end: list[float],
) -> list[float] | None:
    first_dx = first_end[0] - first_start[0]
    first_dy = first_end[1] - first_start[1]
    second_dx = second_end[0] - second_start[0]
    second_dy = second_end[1] - second_start[1]
    determinant = first_dx * second_dy - first_dy * second_dx
    if abs(determinant) < 1e-9:
        return None
    offset_x = second_start[0] - first_start[0]
    offset_y = second_start[1] - first_start[1]
    ratio = (offset_x * second_dy - offset_y * second_dx) / determinant
    return [first_start[0] + ratio * first_dx, first_start[1] + ratio * first_dy]


def _automate_wall_corner_joins(primitives: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Miter connected outer-edge walls and suppress their internal end caps."""
    chain_nodes: dict[tuple[str, float, float], list[tuple[dict[str, Any], bool]]] = {}
    legacy_nodes: dict[tuple[float, float], list[tuple[dict[str, Any], bool]]] = {}
    for primitive in primitives:
        geometry = primitive.get("geometry") or {}
        chain_ref = str(geometry.get("wall_chain_ref") or "").strip()
        reference_start = geometry.get("reference_start_mm")
        reference_end = geometry.get("reference_end_mm")
        points = geometry.get("points_mm")
        if (
            primitive.get("style_ref") == "wall-cut"
            and not reference_start
            and not reference_end
            and isinstance(points, list)
            and len(points) >= 4
        ):
            for is_start, point in ((True, geometry.get("start_mm")), (False, geometry.get("end_mm"))):
                if isinstance(point, list) and len(point) >= 2:
                    node_key = (round(float(point[0]), 3), round(float(point[1]), 3))
                    legacy_nodes.setdefault(node_key, []).append((primitive, is_start))
        if (
            primitive.get("style_ref") != "wall-cut"
            or not chain_ref
            or not isinstance(reference_start, list)
            or not isinstance(reference_end, list)
            or not isinstance(points, list)
            or len(points) < 4
        ):
            continue
        for is_start, point in ((True, reference_start), (False, reference_end)):
            if len(point) < 2:
                continue
            node_key = (chain_ref, round(float(point[0]), 3), round(float(point[1]), 3))
            chain_nodes.setdefault(node_key, []).append((primitive, is_start))

    for (_, node_x, node_y), endpoints in chain_nodes.items():
        if len(endpoints) != 2 or endpoints[0][0] is endpoints[1][0]:
            continue
        first, second = endpoints
        first_geometry = first[0]["geometry"]
        second_geometry = second[0]["geometry"]
        first_points = first_geometry["points_mm"]
        second_points = second_geometry["points_mm"]
        intersection = _line_intersection(first_points[3], first_points[2], second_points[3], second_points[2])
        first_inner_index = 3 if first[1] else 2
        second_inner_index = 3 if second[1] else 2
        if intersection is None:
            first_inner = first_points[first_inner_index]
            second_inner = second_points[second_inner_index]
            if hypot(first_inner[0] - second_inner[0], first_inner[1] - second_inner[1]) > 1:
                continue
            intersection = [(first_inner[0] + second_inner[0]) / 2, (first_inner[1] + second_inner[1]) / 2]
        thickness = max(
            float(first_geometry.get("thickness_mm") or 1),
            float(second_geometry.get("thickness_mm") or 1),
        )
        if not all(isfinite(value) for value in intersection) or hypot(intersection[0] - node_x, intersection[1] - node_y) > thickness * 8:
            continue
        first_points[first_inner_index] = list(intersection)
        second_points[second_inner_index] = list(intersection)
        first_geometry["wall_join_start" if first[1] else "wall_join_end"] = True
        second_geometry["wall_join_start" if second[1] else "wall_join_end"] = True
        first_geometry["wall_join_mode"] = "automatic_miter"
        second_geometry["wall_join_mode"] = "automatic_miter"

    def endpoint_sides(
        primitive: dict[str, Any], is_start: bool
    ) -> tuple[tuple[int, list[list[float]]], tuple[int, list[list[float]]]]:
        points = primitive["geometry"]["points_mm"]
        first_side = [points[0], points[1]]
        second_side = [points[3], points[2]]
        # Relative to the ray pointing away from the shared node, the side
        # order reverses at a segment end. Pairing left with right therefore
        # produces the two correct inner/outer miter intersections.
        if is_start:
            return (0, first_side), (3, second_side)
        return (2, second_side), (1, first_side)

    for (node_x, node_y), endpoints in legacy_nodes.items():
        if len(endpoints) != 2 or endpoints[0][0] is endpoints[1][0]:
            continue
        first, second = endpoints
        first_left, first_right = endpoint_sides(*first)
        second_left, second_right = endpoint_sides(*second)
        outer_intersection = _line_intersection(
            first_left[1][0], first_left[1][1], second_right[1][0], second_right[1][1]
        )
        inner_intersection = _line_intersection(
            first_right[1][0], first_right[1][1], second_left[1][0], second_left[1][1]
        )
        if outer_intersection is None or inner_intersection is None:
            continue
        thickness = max(
            float(first[0]["geometry"].get("thickness_mm") or 1),
            float(second[0]["geometry"].get("thickness_mm") or 1),
        )
        intersections = (outer_intersection, inner_intersection)
        if any(
            not all(isfinite(value) for value in intersection)
            or hypot(intersection[0] - node_x, intersection[1] - node_y) > thickness * 8
            for intersection in intersections
        ):
            continue
        first[0]["geometry"]["points_mm"][first_left[0]] = list(outer_intersection)
        second[0]["geometry"]["points_mm"][second_right[0]] = list(outer_intersection)
        first[0]["geometry"]["points_mm"][first_right[0]] = list(inner_intersection)
        second[0]["geometry"]["points_mm"][second_left[0]] = list(inner_intersection)
        for primitive, is_start in (first, second):
            geometry = primitive["geometry"]
            geometry["wall_join_start" if is_start else "wall_join_end"] = True
            geometry["wall_join_mode"] = "automatic_miter"
    return primitives


def _build_layers(elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    names = {str(element.get("layer", "annotations")) for element in elements}
    return [
        {
            "layer_ref": name,
            "label": DEFAULT_LAYER_STYLES.get(name, {}).get("label", name.replace("_", " ").title()),
            "style_ref": DEFAULT_LAYER_STYLES.get(name, {}).get("style_ref", "default"),
            "order": DEFAULT_LAYER_STYLES.get(name, {}).get("order", 50),
            "visible": True,
        }
        for name in sorted(
            names,
            key=lambda item: (DEFAULT_LAYER_STYLES.get(item, {}).get("order", 50), item),
        )
    ]


def _element_to_primitive(element: dict[str, Any]) -> dict[str, Any]:
    kind = element["kind"]
    geometry = element["geometry"]
    # Core's semantic projection contract permits the form on the element.
    # Older snapshots put it only into geometry.  Supporting both locations is
    # important because a semantic region/network is not a legacy start/end
    # wall and must never be passed to _wall_polygon.
    form = geometry.get("form") or element.get("form")
    primitive_type = kind
    primitive_geometry = geometry

    if kind == "wall":
        primitive_type, primitive_geometry = _wall_primitive(geometry, form)
    elif form == "line_segment":
        primitive_type = "polygon"
        primitive_geometry = {**geometry, "points_mm": _wall_polygon(geometry)}
    elif form in {"polyline", "closed_polyline", "rectangle"}:
        primitive_type = "thick_path"
    elif form == "network":
        primitive_type = "thick_segments"
    elif form in {"arc", "circle"}:
        primitive_type = "thick_arc"
    elif form == "region":
        primitive_type = "polygon"
        primitive_geometry = {**geometry, "points_mm": _region_points(geometry)}
    elif kind in {"opening", "structure"}:
        primitive_type = "rect"
    elif kind in {"room_label", "text"}:
        primitive_type = "text"
    elif kind == "room":
        primitive_type = "room"
    elif kind == "roof":
        primitive_type = "polygon"
        primitive_geometry = {
            **geometry,
            # Keep the editable polygon tied to the user-defined footprint.  The
            # calculated roof coverage (including overhang) remains available as
            # coverage_points_mm for dedicated roof rendering/export.
            "points_mm": geometry.get("points_mm") or geometry.get("coverage_points_mm", []),
        }

    return {
        "primitive_ref": element["element_ref"],
        "primitive_type": primitive_type,
        "source_kind": kind,
        "layer_ref": element.get("layer", "annotations"),
        "style_ref": _style_for(element),
        "geometry": primitive_geometry,
        "text": element.get("text"),
        "selectable": True,
        "metadata": {
            "element_ref": element["element_ref"],
            "label": element.get("label", element["element_ref"]),
            "kind": kind,
            "layer": element.get("layer"),
            "source": element.get("source"),
            "family_ref": element.get("family_ref"),
            "variant_ref": element.get("variant_ref"),
            "local_draft": bool(element.get("local_draft", False)),
            "semantic_role": element.get("semantic_role"),
            "form": element.get("form") or form,
            "thickness_mm": geometry.get("thickness_mm"),
            "source_cell_count": element.get("source_cell_count"),
            "dimensions_source": element.get("dimensions_source"),
            "warnings": element.get("warnings") or [],
            "room_type": element.get("room_type"),
            "area_m2": geometry.get("area_m2"),
            "library_context": element.get("library_context") or {},
            "storey_id": element.get("storey_id") or element.get("storeyId"),
            "host_wall_ref": element.get("host_wall_ref"),
            "host_wall_thickness_mm": element.get("host_wall_thickness_mm"),
            "door_hinge_side": element.get("door_hinge_side"),
            "door_swing_side": element.get("door_swing_side"),
            "width_mm": element.get("width_mm"),
            "height_mm": element.get("height_mm"),
            "sill_height_mm": element.get("sill_height_mm"),
            "floor_mode": element.get("floor_mode"),
            "window_operation": element.get("window_operation"),
            "stair_parameters": element.get("stair_parameters") or {},
            "roof_type": element.get("roof_type"),
            "roof_request": element.get("roof_request") or {},
            "roof_calculation": element.get("roof_calculation") or geometry.get("roof_calculation") or {},
        },
    }


def _style_for(element: dict[str, Any]) -> str:
    kind = element["kind"]
    semantic_role = str(element.get("semantic_role") or "").strip().lower()
    if kind == "wall":
        return "wall-cut"
    if kind == "opening":
        if semantic_role in {"door", "window"}:
            return semantic_role
        # Older/imported CAD projections can identify an opening only through
        # their library family.  Keep those objects fully selectable and use
        # the same door/window controls as newly authored elements.
        descriptor = " ".join(
            str(element.get(field) or "")
            for field in ("family_ref", "variant_ref", "label")
        ).lower()
        if any(token in descriptor for token in ("tür", "tuer", "door")):
            return "door"
        if any(token in descriptor for token in ("fenster", "window")):
            return "window"
        return "opening"
    if kind == "structure":
        return semantic_role if semantic_role in {
            "beam",
            "column",
            "component",
            "roof",
            "slab",
            "stair",
        } else "unresolved" if semantic_role == "unknown" else "structure"
    if kind == "dimension":
        return "dimension"
    if kind == "room_label":
        return "room-label"
    if kind == "room":
        return "room"
    if kind == "roof":
        return "roof"
    if kind == "text":
        return "annotation"
    return "line"


def _wall_polygon(geometry: dict[str, Any]) -> list[list[float]]:
    points = geometry.get("points_mm")
    if _valid_points(points, minimum=3):
        return [list(point[:2]) for point in points]
    outer_ring = geometry.get("outer_ring_mm")
    if _valid_points(outer_ring, minimum=3):
        return [list(point[:2]) for point in outer_ring]

    start = geometry.get("start_mm")
    end = geometry.get("end_mm")
    thickness = geometry.get("thickness_mm")
    if (
        not _valid_point(start)
        or not _valid_point(end)
        or not _finite_positive_number(thickness)
    ):
        # One malformed or differently-versioned semantic object must not make
        # every other primitive disappear from the CAD sheet.
        return []

    x1, y1 = start[:2]
    x2, y2 = end[:2]
    dx = x2 - x1
    dy = y2 - y1
    length = hypot(dx, dy) or 1
    reference_start = geometry.get("reference_start_mm")
    reference_end = geometry.get("reference_end_mm")
    if (
        isinstance(reference_start, list)
        and len(reference_start) >= 2
        and isinstance(reference_end, list)
        and len(reference_end) >= 2
    ):
        return [
            [reference_start[0], reference_start[1]],
            [reference_end[0], reference_end[1]],
            [2 * x2 - reference_end[0], 2 * y2 - reference_end[1]],
            [2 * x1 - reference_start[0], 2 * y1 - reference_start[1]],
        ]
    nx = (-dy / length) * thickness / 2
    ny = (dx / length) * thickness / 2
    return [
        [x1 + nx, y1 + ny],
        [x2 + nx, y2 + ny],
        [x2 - nx, y2 - ny],
        [x1 - nx, y1 - ny],
    ]


def _wall_primitive(
    geometry: dict[str, Any], form: Any
) -> tuple[str, dict[str, Any]]:
    """Resolve both legacy and semantic wall geometries without raising."""
    if form in {"polyline", "closed_polyline", "rectangle"}:
        return "thick_path", geometry
    if form == "network":
        return "thick_segments", geometry
    if form in {"arc", "circle"}:
        return "thick_arc", geometry
    if form == "region":
        return "polygon", {
            **geometry,
            "points_mm": _region_points(geometry),
        }

    # Recover older/imported snapshots whose semantic form metadata was lost
    # while their actual geometry remained intact.
    if _valid_points(geometry.get("points_mm"), minimum=3):
        return "polygon", geometry
    if _valid_points(geometry.get("outer_ring_mm"), minimum=3):
        return "polygon", {
            **geometry,
            "points_mm": geometry["outer_ring_mm"],
        }
    if _valid_segments(geometry.get("segments_mm")):
        return "thick_segments", geometry
    if _valid_points(geometry.get("path_mm"), minimum=2):
        return "thick_path", geometry

    return "polygon", {**geometry, "points_mm": _wall_polygon(geometry)}


def _finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def _finite_positive_number(value: Any) -> bool:
    return _finite_number(value) and value > 0


def _valid_point(value: Any) -> bool:
    return (
        isinstance(value, (list, tuple))
        and len(value) >= 2
        and _finite_number(value[0])
        and _finite_number(value[1])
    )


def _valid_points(value: Any, *, minimum: int) -> bool:
    return isinstance(value, list) and len(value) >= minimum and all(_valid_point(point) for point in value)


def _valid_segments(value: Any) -> bool:
    return (
        isinstance(value, list)
        and bool(value)
        and all(_valid_points(segment, minimum=2) for segment in value)
    )


def _region_points(geometry: dict[str, Any]) -> list[Any]:
    outer_ring = geometry.get("outer_ring_mm")
    return outer_ring if _valid_points(outer_ring, minimum=3) else []
