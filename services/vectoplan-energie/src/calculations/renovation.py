"""Build reproducible renovation variants and a staged roadmap."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable, Mapping


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _set_component_limit(project: dict[str, Any], kind: str, maximum_u: float) -> list[str]:
    changed: list[str] = []
    for component in project.get("envelope", {}).get("components", []):
        if component.get("kind") == kind and _number(component.get("u_value"), 99.0) > maximum_u:
            component["u_value"] = maximum_u
            component["layers"] = []
            component["status"] = "variant"
            changed.append(str(component.get("id")))
    return changed


def build_renovation_variants(
    project: Mapping[str, Any], evaluate: Callable[[Mapping[str, Any], bool], Mapping[str, Any]]
) -> list[dict[str, Any]]:
    baseline = evaluate(project, False)
    variants: list[dict[str, Any]] = []
    definitions = [
        ("envelope", "Gebäudehülle", {"exterior_wall": 0.18, "roof": 0.14, "floor": 0.22, "window": 0.90}),
        ("systems", "Wärmepumpe & Lüftung", {}),
        ("complete", "Gesamtsanierung", {"exterior_wall": 0.16, "roof": 0.12, "floor": 0.18, "window": 0.80}),
    ]
    base_primary = _number(baseline.get("summary", {}).get("primary_energy_kwh_m2a"))
    for variant_id, label, limits in definitions:
        candidate = deepcopy(dict(project))
        changes: list[dict[str, Any]] = []
        for kind, limit in limits.items():
            ids = _set_component_limit(candidate, kind, limit)
            if ids:
                changes.append({"measure": f"u-value-{kind}", "component_ids": ids, "target_u_value": limit})
        if variant_id in {"systems", "complete"}:
            heating = candidate.setdefault("systems", {}).setdefault("heating", {})
            heating.update({"type": "heat_pump", "energy_carrier": "electricity", "seasonal_performance_factor": 4.0, "renewable_heat_share": 1.0})
            ventilation = candidate["systems"].setdefault("ventilation", {})
            ventilation.update({"type": "balanced_with_heat_recovery", "heat_recovery_rate": 0.82, "air_changes_per_hour": 0.5})
            changes.append({"measure": "heat-pump-and-ventilation"})
        if variant_id == "complete":
            candidate["systems"].setdefault("renewables", {})["pv_peak_kwp"] = max(
                10.0,
                _number(candidate["systems"]["renewables"].get("roof_potential_kwp"), 18.0),
            )
            changes.append({"measure": "pv-roof-potential"})
        result = evaluate(candidate, False)
        current_primary = _number(result.get("summary", {}).get("primary_energy_kwh_m2a"))
        savings = max(0.0, base_primary - current_primary)
        variants.append(
            {
                "id": variant_id,
                "label": label,
                "changes": changes,
                "summary": result.get("summary", {}),
                "primary_energy_saving_percent": round(savings / base_primary * 100.0, 1) if base_primary else 0.0,
            }
        )
    return variants


def build_roadmap(variants: list[Mapping[str, Any]]) -> dict[str, Any]:
    order = ["envelope", "systems", "complete"]
    lookup = {str(item.get("id")): item for item in variants}
    steps = []
    for index, variant_id in enumerate(order, start=1):
        item = lookup.get(variant_id)
        if not item:
            continue
        steps.append(
            {
                "step": index,
                "variant_id": variant_id,
                "title": item.get("label"),
                "measures": item.get("changes", []),
                "result": item.get("summary", {}),
                "dependencies": [order[index - 2]] if index > 1 else [],
            }
        )
    return {
        "type": "renovation-roadmap-draft",
        "status": "working-draft",
        "normative": False,
        "steps": steps,
        "note": "Fachlich prüfbarer Arbeitsentwurf; kein über die BAFA-Druckapplikation erzeugter iSFP.",
    }


__all__ = ["build_renovation_variants", "build_roadmap"]
