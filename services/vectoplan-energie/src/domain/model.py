"""Normalize editor, CAD and legacy energy payloads into one project model.

The normalized dictionary deliberately stays JSON serializable.  It is the
boundary shared by UI adapters, calculation stages and future persistence.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping


KIND_ALIASES = {
    "wall": "exterior_wall",
    "outer_wall": "exterior_wall",
    "exterior-wall": "exterior_wall",
    "ceiling": "roof",
    "top_ceiling": "roof",
    "slab": "floor",
    "ground_slab": "floor",
    "glazing": "window",
    "door": "door",
}


def _mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _list(value: Any) -> list[Any]:
    return list(value) if isinstance(value, list) else []


def _number(value: Any, default: float = 0.0, minimum: float | None = None) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = default
    if minimum is not None:
        result = max(minimum, result)
    return result


def _component_from_legacy(kind: str, area: float, u_value: Any) -> dict[str, Any]:
    labels = {
        "exterior_wall": "Außenwand",
        "roof": "Dach",
        "floor": "Bodenplatte",
        "window": "Fenster",
    }
    return {
        "id": f"legacy-{kind}",
        "name": labels[kind],
        "kind": kind,
        "area_m2": round(max(0.0, area), 4),
        "u_value": _number(u_value, 0.0, 0.0),
        "boundary_temperature_factor": 1.0,
        "source": "legacy-calculation-request",
        "status": "assumption",
        "layers": [],
    }


def _legacy_components(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    geometry = _mapping(payload.get("geometry"))
    envelope = _mapping(payload.get("envelope"))
    total = _number(geometry.get("envelope_area_m2"), 0.0, 0.0)
    window_share = min(0.55, max(0.03, _number(envelope.get("window_share"), 0.18)))
    roof_share = 0.21
    floor_share = 0.21
    wall_share = max(0.03, 1.0 - window_share - roof_share - floor_share)
    shares = {
        "exterior_wall": wall_share,
        "roof": roof_share,
        "floor": floor_share,
        "window": window_share,
    }
    values = {
        "exterior_wall": envelope.get("exterior_wall_u_value", 0.24),
        "roof": envelope.get("roof_u_value", 0.18),
        "floor": envelope.get("floor_u_value", 0.28),
        "window": envelope.get("window_u_value", 1.1),
    }
    return [
        _component_from_legacy(kind, total * share, values[kind])
        for kind, share in shares.items()
    ]


def _normalize_component(raw: Mapping[str, Any], index: int) -> dict[str, Any]:
    item = deepcopy(dict(raw))
    kind_raw = str(item.get("kind") or item.get("type") or "other").strip().lower()
    kind = KIND_ALIASES.get(kind_raw, kind_raw)
    item.update(
        {
            "id": str(item.get("id") or f"component-{index + 1}"),
            "name": str(item.get("name") or kind.replace("_", " ").title()),
            "kind": kind,
            "area_m2": _number(item.get("area_m2", item.get("area")), 0.0, 0.0),
            "boundary_temperature_factor": _number(
                item.get("boundary_temperature_factor", item.get("b_factor")), 1.0, 0.0
            ),
            "layers": _list(item.get("layers")),
            "source": str(item.get("source") or "project-model"),
            "status": str(item.get("status") or "unverified"),
        }
    )
    if item.get("u_value") is not None:
        item["u_value"] = _number(item.get("u_value"), 0.0, 0.0)
    return item


def _default_zone(project: Mapping[str, Any]) -> dict[str, Any]:
    geometry = _mapping(project.get("geometry"))
    usage = _mapping(project.get("usage"))
    return {
        "id": "zone-building",
        "name": "Gesamtgebäude",
        "usage_profile": str(usage.get("usage_profile") or "residential_multi_family"),
        "conditioned": True,
        "floor_area_m2": _number(
            geometry.get("heated_floor_area_m2", geometry.get("net_room_area_m2")), 0.0, 0.0
        ),
        "volume_m3": _number(
            geometry.get("conditioned_volume_m3", geometry.get("volume_m3")), 0.0, 0.0
        ),
        "indoor_temperature_c": _number(usage.get("indoor_temperature_c"), 20.0),
        "occupants": _number(usage.get("occupants"), 0.0, 0.0),
    }


def _normalize_zone(raw: Mapping[str, Any], index: int, defaults: Mapping[str, Any]) -> dict[str, Any]:
    zone = deepcopy(dict(raw))
    zone.update(
        {
            "id": str(zone.get("id") or f"zone-{index + 1}"),
            "name": str(zone.get("name") or f"Zone {index + 1}"),
            "usage_profile": str(zone.get("usage_profile") or defaults.get("usage_profile") or "unknown"),
            "conditioned": bool(zone.get("conditioned", True)),
            "floor_area_m2": _number(zone.get("floor_area_m2"), 0.0, 0.0),
            "volume_m3": _number(zone.get("volume_m3"), 0.0, 0.0),
            "indoor_temperature_c": _number(
                zone.get("indoor_temperature_c"), _number(defaults.get("indoor_temperature_c"), 20.0)
            ),
            "occupants": _number(zone.get("occupants"), 0.0, 0.0),
        }
    )
    return zone


def normalize_energy_project(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Return a stable ``energy-project/0.2`` model.

    Both the richer workspace project and the old flat calculation request are
    accepted so existing clients continue to work while adapters migrate.
    """
    source = deepcopy(dict(payload))
    rich_project = isinstance(source.get("project"), Mapping)
    project_meta = _mapping(source.get("project")) if rich_project else {
        "id": source.get("project_id"),
        "name": source.get("project_name") or "Energieprojekt",
    }
    building = _mapping(source.get("building"))
    if not building:
        building = {"type": source.get("building_type", "residential")}
    geometry = _mapping(source.get("geometry"))
    envelope = _mapping(source.get("envelope"))
    systems = _mapping(source.get("systems"))
    usage = _mapping(source.get("usage"))

    raw_components = _list(envelope.get("components"))
    components = [
        _normalize_component(item, index)
        for index, item in enumerate(raw_components)
        if isinstance(item, Mapping)
    ]
    if not components:
        components = _legacy_components(source)

    raw_zones = _list(source.get("zones") or geometry.get("zones"))
    default_zone = _default_zone(source)
    zones = [
        _normalize_zone(item, index, default_zone)
        for index, item in enumerate(raw_zones)
        if isinstance(item, Mapping)
    ] or [default_zone]

    heating = _mapping(systems.get("heating"))
    ventilation = _mapping(systems.get("ventilation"))
    renewables = _mapping(systems.get("renewables"))
    if not heating:
        heating = {
            "type": systems.get("heating_type", "heat_pump"),
            "seasonal_performance_factor": systems.get("seasonal_performance_factor", 3.6),
            "verified": systems.get("verified", False),
        }
    if not ventilation:
        ventilation = {
            "type": "balanced_with_heat_recovery",
            "heat_recovery_rate": systems.get("heat_recovery_rate", 0.0),
        }
    if not renewables:
        renewables = {"pv_peak_kwp": systems.get("pv_peak_kwp", 0.0)}

    project_id = str(project_meta.get("id") or source.get("project_id") or "")
    provenance = _mapping(source.get("provenance"))
    return {
        "schema_version": "energy-project/0.2",
        "source_schema_version": str(source.get("schema_version") or "legacy"),
        "revision": str(source.get("revision") or provenance.get("geometry_revision") or "unversioned"),
        "project": {
            **project_meta,
            "id": project_id,
            "name": str(project_meta.get("name") or "Energieprojekt"),
        },
        "building": {
            **building,
            "type": str(building.get("type") or "residential"),
            "condition": str(building.get("condition") or "existing"),
        },
        "geometry": geometry,
        "zones": zones,
        "envelope": {
            **envelope,
            "components": components,
            "thermal_bridges": _list(envelope.get("thermal_bridges")),
        },
        "systems": {
            **systems,
            "heating": heating,
            "ventilation": ventilation,
            "renewables": renewables,
        },
        "usage": usage,
        "climate": _mapping(source.get("climate")),
        "targets": _mapping(source.get("targets")),
        "economics": _mapping(source.get("economics")),
        "provenance": {
            **provenance,
            "normalized_from": str(source.get("schema_version") or "legacy-calculation-request"),
        },
    }


def validate_normalized_project(project: Mapping[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    def add(code: str, path: str, message: str, severity: str = "error") -> None:
        issues.append({"code": code, "path": path, "message": message, "severity": severity})

    if not str(_mapping(project.get("project")).get("id") or "").strip():
        add("project.id.missing", "/project/id", "Eine Projekt-ID ist erforderlich.")
    building_type = str(_mapping(project.get("building")).get("type") or "")
    if building_type not in {"residential", "non_residential", "mixed_use"}:
        add("building.type.invalid", "/building/type", "Gebäudetyp ist nicht unterstützt.")

    zones = _list(project.get("zones"))
    if not zones:
        add("zones.missing", "/zones", "Mindestens eine thermische Zone ist erforderlich.")
    if sum(_number(_mapping(zone).get("floor_area_m2"), 0.0) for zone in zones) <= 0:
        add("zones.area.missing", "/zones", "Die konditionierte Zonenfläche fehlt.")
    if sum(_number(_mapping(zone).get("volume_m3"), 0.0) for zone in zones) <= 0:
        add("zones.volume.missing", "/zones", "Das konditionierte Zonenvolumen fehlt.")

    components = _list(_mapping(project.get("envelope")).get("components"))
    if not components:
        add("envelope.components.missing", "/envelope/components", "Hüllbauteile fehlen.")
    for index, raw in enumerate(components):
        item = _mapping(raw)
        if _number(item.get("area_m2"), 0.0) <= 0:
            add("component.area.invalid", f"/envelope/components/{index}/area_m2", "Bauteilfläche muss größer null sein.")
        if item.get("u_value") is None and not _list(item.get("layers")):
            add(
                "component.thermal_data.missing",
                f"/envelope/components/{index}",
                "U-Wert oder Schichtenaufbau fehlt.",
            )

    climate = _mapping(project.get("climate"))
    usage = _mapping(project.get("usage"))
    if not climate and not usage.get("climate_location"):
        add("climate.missing", "/climate", "Standort- oder Klimadaten fehlen.", "warning")
    return issues


__all__ = ["normalize_energy_project", "validate_normalized_project"]
