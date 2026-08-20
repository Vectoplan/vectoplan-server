"""Transparent building-envelope calculations."""

from __future__ import annotations

from typing import Any, Mapping


SURFACE_RESISTANCES = {
    "exterior_wall": (0.13, 0.04),
    "window": (0.13, 0.04),
    "door": (0.13, 0.04),
    "roof": (0.10, 0.04),
    "floor": (0.17, 0.04),
}


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def calculate_u_value(component: Mapping[str, Any]) -> dict[str, Any]:
    """Calculate U from layers or return a supplied project/library U-value."""
    supplied = component.get("u_value")
    layers = component.get("layers") if isinstance(component.get("layers"), list) else []
    kind = str(component.get("kind") or "exterior_wall")
    if not layers:
        u_value = max(0.0, _number(supplied, 0.0))
        return {
            "u_value_w_m2k": round(u_value, 5),
            "r_total_m2k_w": round(1.0 / u_value, 5) if u_value > 0 else None,
            "source": "supplied",
            "layers": [],
        }

    r_si, r_se = SURFACE_RESISTANCES.get(kind, (0.13, 0.04))
    layer_results: list[dict[str, Any]] = []
    r_layers = 0.0
    for index, raw in enumerate(layers):
        layer = dict(raw) if isinstance(raw, Mapping) else {}
        thickness_m = _number(layer.get("thickness_m"), _number(layer.get("thickness_cm")) / 100.0)
        conductivity = _number(layer.get("conductivity_w_mk", layer.get("lambda_w_mk")), 0.0)
        resistance = thickness_m / conductivity if thickness_m > 0 and conductivity > 0 else 0.0
        r_layers += resistance
        layer_results.append(
            {
                "index": index,
                "name": str(layer.get("name") or f"Schicht {index + 1}"),
                "thickness_m": round(thickness_m, 6),
                "conductivity_w_mk": round(conductivity, 5),
                "resistance_m2k_w": round(resistance, 5),
                "mu": _number(layer.get("mu"), 0.0),
            }
        )
    r_total = r_si + r_layers + r_se
    u_value = 1.0 / r_total if r_total > 0 else 0.0
    return {
        "u_value_w_m2k": round(u_value, 5),
        "r_total_m2k_w": round(r_total, 5),
        "surface_resistance_inside_m2k_w": r_si,
        "surface_resistance_outside_m2k_w": r_se,
        "source": "calculated-from-layers",
        "layers": layer_results,
    }


def calculate_envelope(project: Mapping[str, Any]) -> dict[str, Any]:
    envelope = project.get("envelope") if isinstance(project.get("envelope"), Mapping) else {}
    components = envelope.get("components") if isinstance(envelope.get("components"), list) else []
    rows: list[dict[str, Any]] = []
    transmission_w_k = 0.0
    total_area = 0.0
    weighted_u_area = 0.0
    for raw in components:
        component = dict(raw) if isinstance(raw, Mapping) else {}
        thermal = calculate_u_value(component)
        area = max(0.0, _number(component.get("area_m2")))
        b_factor = min(1.5, max(0.0, _number(component.get("boundary_temperature_factor"), 1.0)))
        u_value = thermal["u_value_w_m2k"]
        h_value = area * u_value * b_factor
        total_area += area
        weighted_u_area += area * u_value
        transmission_w_k += h_value
        rows.append(
            {
                "id": str(component.get("id") or ""),
                "name": str(component.get("name") or "Bauteil"),
                "kind": str(component.get("kind") or "other"),
                "area_m2": round(area, 3),
                "boundary_temperature_factor": round(b_factor, 3),
                "heat_transfer_w_k": round(h_value, 3),
                "thermal": thermal,
                "source": component.get("source"),
                "status": component.get("status"),
            }
        )

    bridges = envelope.get("thermal_bridges") if isinstance(envelope.get("thermal_bridges"), list) else []
    bridge_rows: list[dict[str, Any]] = []
    bridge_w_k = 0.0
    for index, raw in enumerate(bridges):
        bridge = dict(raw) if isinstance(raw, Mapping) else {}
        psi = max(0.0, _number(bridge.get("psi_w_mk", bridge.get("psi"))))
        length = max(0.0, _number(bridge.get("length_m", bridge.get("length"))))
        value = psi * length
        bridge_w_k += value
        bridge_rows.append(
            {
                "id": str(bridge.get("id") or f"bridge-{index + 1}"),
                "name": str(bridge.get("name") or f"Wärmebrücke {index + 1}"),
                "psi_w_mk": round(psi, 5),
                "length_m": round(length, 3),
                "heat_transfer_w_k": round(value, 3),
            }
        )

    blanket_delta_u = 0.0
    if not bridge_rows:
        blanket_delta_u = max(0.0, _number(envelope.get("thermal_bridge_delta_u_w_m2k"), 0.05))
        bridge_w_k = blanket_delta_u * total_area

    return {
        "components": rows,
        "thermal_bridges": bridge_rows,
        "blanket_thermal_bridge_delta_u_w_m2k": round(blanket_delta_u, 5),
        "component_heat_transfer_w_k": round(transmission_w_k, 3),
        "thermal_bridge_heat_transfer_w_k": round(bridge_w_k, 3),
        "total_heat_transfer_w_k": round(transmission_w_k + bridge_w_k, 3),
        "envelope_area_m2": round(total_area, 3),
        "mean_u_value_w_m2k": round(weighted_u_area / total_area, 5) if total_area else 0.0,
    }


__all__ = ["calculate_envelope", "calculate_u_value"]
