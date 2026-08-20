"""Elementary, auditable action calculations used before structural analysis."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from src.domain import CalculationStep


def self_weight_from_volume(volume_m3: float, unit_weight_kn_m3: float) -> dict[str, Any]:
    if volume_m3 < 0 or unit_weight_kn_m3 <= 0:
        raise ValueError("Volume must be non-negative and unit weight positive")
    value = volume_m3 * unit_weight_kn_m3
    return {
        "value_kn": value,
        "calculation_steps": [CalculationStep(
            "self_weight", "Eigengewicht", "G = V · γ",
            f"V={volume_m3:g} m³; γ={unit_weight_kn_m3:g} kN/m³", value, "kN",
            ("Kleine Baustatik, Kapitel 1",), ("Konstante Wichte innerhalb des Volumens",),
        ).to_dict()],
    }


def permanent_area_load(layers: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    normalized = []
    for index, layer in enumerate(layers, 1):
        thickness_m = float(layer["thickness_m"])
        unit_weight_kn_m3 = float(layer["unit_weight_kn_m3"])
        if thickness_m < 0 or unit_weight_kn_m3 <= 0:
            raise ValueError("Layer thickness must be non-negative and unit weight positive")
        normalized.append({
            "label": str(layer.get("label") or f"Schicht {index}"),
            "thickness_m": thickness_m,
            "unit_weight_kn_m3": unit_weight_kn_m3,
            "area_load_kn_m2": thickness_m * unit_weight_kn_m3,
        })
    value = sum(item["area_load_kn_m2"] for item in normalized)
    substitutions = " + ".join(
        f"{item['thickness_m']:g}·{item['unit_weight_kn_m3']:g}" for item in normalized
    ) or "0"
    return {
        "value_kn_m2": value,
        "layers": normalized,
        "calculation_steps": [CalculationStep(
            "layer_load", "Ständige Flächenlast aus Schichten", "gₖ = Σ(dᵢ · γᵢ)",
            substitutions, value, "kN/m²", ("Kleine Baustatik, Kapitel 1",),
            ("Konstante Schichtdicke und Wichte",),
        ).to_dict()],
    }


def area_to_line_load(area_load_kn_m2: float, tributary_width_m: float) -> dict[str, Any]:
    if area_load_kn_m2 < 0 or tributary_width_m <= 0:
        raise ValueError("Area load must be non-negative and tributary width positive")
    value = area_load_kn_m2 * tributary_width_m
    return {
        "value_kn_m": value,
        "calculation_steps": [CalculationStep(
            "area_to_line", "Flächenlast in Linienlast", "qₖ,lin = qₖ,fl · bₑ",
            f"qₖ,fl={area_load_kn_m2:g} kN/m²; bₑ={tributary_width_m:g} m", value, "kN/m",
            ("Kleine Baustatik, Kapitel 1",), ("Eindeutige Lasteinzugsbreite",),
        ).to_dict()],
    }


__all__ = ["area_to_line_load", "permanent_area_load", "self_weight_from_volume"]
