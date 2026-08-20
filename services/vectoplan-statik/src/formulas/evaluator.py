"""Evaluators for elementary formulas from the traceability catalog."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from src.domain import CalculationStep


def centroid(parts: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    normalized = []
    for index, part in enumerate(parts, 1):
        area = float(part["area"])
        coordinate = float(part["coordinate"])
        if area <= 0:
            raise ValueError("Centroid areas must be positive")
        normalized.append({"label": str(part.get("label") or index), "area": area, "coordinate": coordinate})
    total_area = sum(item["area"] for item in normalized)
    if not normalized or total_area <= 0:
        raise ValueError("At least one positive part is required")
    first_moment = sum(item["area"] * item["coordinate"] for item in normalized)
    value = first_moment / total_area
    return {
        "coordinate": value,
        "total_area": total_area,
        "calculation_steps": [CalculationStep(
            "centroid", "Schwerpunkt zusammengesetzter Flächen", "x̄ = Σ(Aᵢ · xᵢ) / ΣAᵢ",
            " + ".join(f"{item['area']:g}·{item['coordinate']:g}" for item in normalized) + f" / {total_area:g}",
            value, "Koordinateneinheit", ("Kleine Baustatik, Kapitel 5",),
            ("Teilflächen überlappen sich nicht", "Einheitliches Koordinatensystem"),
        ).to_dict()],
    }


__all__ = ["centroid"]
