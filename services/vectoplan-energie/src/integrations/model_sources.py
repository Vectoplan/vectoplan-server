"""Browser-facing Editor/CAD embed URLs and selection normalization.

No service call is performed here.  The browser receives allow-listed routes
and a stable message contract; authenticated project routes can replace the
defaults later without changing the energy UI.
"""

from __future__ import annotations

from typing import Any, Mapping
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


SELECTION_CONTRACT = "vectoplan.energy-selection.v1"
SELECTION_READY = "vectoplan.energy-selection.ready"
SELECTION_REQUEST = "vectoplan.energy-selection.request"
SELECTION_CHANGED = "vectoplan.energy-selection.changed"


def _url(base: str, route: str, query: Mapping[str, Any]) -> str:
    raw = str(base or "").rstrip("/") + "/" + str(route or "").lstrip("/")
    parts = urlsplit(raw)
    values = dict(parse_qsl(parts.query, keep_blank_values=True))
    values.update({key: str(value) for key, value in query.items() if value is not None and str(value) != ""})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(values), parts.fragment))


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, "", "", "")).rstrip("/")


def build_model_sources(config: Mapping[str, Any], parent_origin: str, project_id: str = "") -> dict[str, Any]:
    query = {
        "embed": "1",
        "parentOrigin": parent_origin,
        "projectId": project_id,
        "selectionContract": SELECTION_CONTRACT,
        "purpose": "vectoplan-energie",
    }
    editor_url = _url(str(config.get("EDITOR_PUBLIC_URL") or "http://127.0.0.1:5100"), str(config.get("EDITOR_ENERGY_ROUTE") or "/editor/test-generator"), query)
    cad_query = {**query, "sample": "1"} if bool(config.get("MOCK_MODE", False)) else query
    cad_url = _url(str(config.get("CAD_PUBLIC_URL") or "http://127.0.0.1:5104"), str(config.get("CAD_ENERGY_ROUTE") or "/cad"), cad_query)
    return {
        "contract": SELECTION_CONTRACT,
        "messages": {
            "ready": SELECTION_READY,
            "request": SELECTION_REQUEST,
            "changed": SELECTION_CHANGED,
        },
        "editor": {
            "source": "vectoplan-editor",
            "mode": "3d-envelope-selection",
            "url": editor_url,
            "origin": _origin(editor_url),
            "route": urlsplit(editor_url).path,
            "library_route_compatible": True,
        },
        "cad": {
            "source": "vectoplan-cad",
            "mode": "2d-zone-system-selection",
            "url": cad_url,
            "origin": _origin(cad_url),
            "route": urlsplit(cad_url).path,
        },
        "security": {
            "exact_origin_required": True,
            "exact_frame_window_required": True,
            "wildcard_target_origin_allowed": False,
        },
    }


def normalize_selection(payload: Any) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(payload, Mapping):
        return None, ["selection message must be an object"]
    if payload.get("contract") != SELECTION_CONTRACT:
        return None, [f"contract must be {SELECTION_CONTRACT}"]
    source = str(payload.get("source") or "")
    if source not in {"vectoplan-editor", "vectoplan-cad"}:
        return None, ["source must be vectoplan-editor or vectoplan-cad"]
    selection = payload.get("selection")
    if not isinstance(selection, Mapping):
        return None, ["selection must be an object"]
    raw_objects = selection.get("objects")
    if not isinstance(raw_objects, list):
        return None, ["selection.objects must be an array"]
    objects: list[dict[str, Any]] = []
    for index, raw in enumerate(raw_objects[:200]):
        if not isinstance(raw, Mapping):
            continue
        object_id = str(raw.get("id") or "").strip()
        if not object_id:
            return None, [f"selection.objects[{index}].id is required"]
        properties = dict(raw.get("properties")) if isinstance(raw.get("properties"), Mapping) else {}
        allowed_properties = {
            str(key)[:120]: value
            for key, value in list(properties.items())[:128]
            if isinstance(value, (str, int, float, bool)) or value is None
        }
        objects.append(
            {
                "id": object_id[:240],
                "kind": str(raw.get("kind") or "unknown")[:120],
                "name": str(raw.get("name") or object_id)[:240],
                "properties": allowed_properties,
                "geometry_ref": str(raw.get("geometryRef") or raw.get("geometry_ref") or "")[:400],
                "library_ref": str(raw.get("libraryRef") or raw.get("library_ref") or "")[:400],
            }
        )
    return {
        "contract": SELECTION_CONTRACT,
        "type": SELECTION_CHANGED,
        "source": source,
        "project_id": str(payload.get("projectId") or payload.get("project_id") or "")[:240],
        "revision": str(payload.get("revision") or "unversioned")[:240],
        "selection": {"objects": objects, "count": len(objects)},
    }, []


__all__ = [
    "SELECTION_CHANGED",
    "SELECTION_CONTRACT",
    "SELECTION_READY",
    "SELECTION_REQUEST",
    "build_model_sources",
    "normalize_selection",
]
