from __future__ import annotations

from math import hypot
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
                "primitives": [
                    _element_to_primitive(element)
                    for element in elements
                    if viewport.get("viewport_ref") in element.get("view_refs", [])
                ],
            }
            for viewport in sheet.get("viewports", [])
        ],
    }


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
    form = geometry.get("form")
    primitive_type = kind
    primitive_geometry = geometry

    if form == "line_segment":
        primitive_type = "polygon"
        primitive_geometry = {"points_mm": _wall_polygon(geometry)}
    elif form in {"polyline", "closed_polyline", "rectangle"}:
        primitive_type = "thick_path"
    elif form == "network":
        primitive_type = "thick_segments"
    elif form in {"arc", "circle"}:
        primitive_type = "thick_arc"
    elif form == "region":
        primitive_type = "polygon"
        primitive_geometry = {"points_mm": geometry.get("outer_ring_mm", [])}
    elif kind == "wall":
        primitive_type = "polygon"
        primitive_geometry = {"points_mm": _wall_polygon(geometry)}
    elif kind in {"opening", "structure"}:
        primitive_type = "rect"
    elif kind in {"room_label", "text"}:
        primitive_type = "text"
    elif kind == "room":
        primitive_type = "room"

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
        },
    }


def _style_for(element: dict[str, Any]) -> str:
    kind = element["kind"]
    semantic_role = str(element.get("semantic_role") or "").strip().lower()
    if kind == "wall":
        return "wall-cut"
    if kind == "opening":
        return semantic_role if semantic_role in {"door", "window"} else "opening"
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
    if kind == "text":
        return "annotation"
    return "line"


def _wall_polygon(geometry: dict[str, Any]) -> list[list[float]]:
    x1, y1 = geometry["start_mm"]
    x2, y2 = geometry["end_mm"]
    thickness = geometry["thickness_mm"]
    dx = x2 - x1
    dy = y2 - y1
    length = hypot(dx, dy) or 1
    nx = (-dy / length) * thickness / 2
    ny = (dx / length) * thickness / 2
    return [
        [x1 + nx, y1 + ny],
        [x2 + nx, y2 + ny],
        [x2 - nx, y2 - ny],
        [x1 - nx, y1 - ny],
    ]
