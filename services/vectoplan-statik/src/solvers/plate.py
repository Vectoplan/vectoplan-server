"""Navier-series solver for simply supported rectangular isotropic plates.

This is a real field solution for the explicitly supported boundary condition,
not a general finite-element claim. Arbitrary geometry, openings, line supports,
orthotropy and nonlinear wall interaction are routed to future surface-solver
plugins by the pipeline.
"""

from __future__ import annotations

import math
from typing import Any

from src.domain import CalculationStep, DecisionRecord


class NavierPlateSolver:
    solver_id = "navier_rectangular_plate/0.2"

    def solve(
        self,
        *,
        length_x_m: float,
        length_y_m: float,
        thickness_m: float,
        elastic_modulus_mpa: float,
        poisson_ratio: float,
        uniform_load_kn_m2: float,
        terms: int = 15,
        grid_size: int = 21,
    ) -> dict[str, Any]:
        if min(length_x_m, length_y_m, thickness_m, elastic_modulus_mpa) <= 0:
            raise ValueError("Plate dimensions, thickness and elastic modulus must be positive")
        if not 0 <= poisson_ratio < 0.5:
            raise ValueError("Poisson ratio must be between 0 and 0.5")
        series_terms = max(3, min(41, int(terms)))
        if series_terms % 2 == 0:
            series_terms += 1
        grid = max(5, min(81, int(grid_size)))
        elastic_kn_m2 = elastic_modulus_mpa * 1000.0
        rigidity = elastic_kn_m2 * thickness_m**3 / (12.0 * (1.0 - poisson_ratio**2))

        rows: list[list[dict[str, float]]] = []
        max_deflection_mm = 0.0
        max_mx = 0.0
        max_my = 0.0
        for iy in range(grid):
            y = length_y_m * iy / (grid - 1)
            row: list[dict[str, float]] = []
            for ix in range(grid):
                x = length_x_m * ix / (grid - 1)
                deflection = 0.0
                mx = 0.0
                my = 0.0
                for m in range(1, series_terms + 1, 2):
                    for n in range(1, series_terms + 1, 2):
                        alpha2 = (m / length_x_m) ** 2
                        beta2 = (n / length_y_m) ** 2
                        amplitude = (
                            16.0
                            * uniform_load_kn_m2
                            / (math.pi**6 * rigidity * m * n * (alpha2 + beta2) ** 2)
                        )
                        shape = math.sin(m * math.pi * x / length_x_m) * math.sin(n * math.pi * y / length_y_m)
                        deflection += amplitude * shape
                        mx += rigidity * math.pi**2 * (alpha2 + poisson_ratio * beta2) * amplitude * shape
                        my += rigidity * math.pi**2 * (beta2 + poisson_ratio * alpha2) * amplitude * shape
                deflection_mm = deflection * 1000.0
                max_deflection_mm = max(max_deflection_mm, abs(deflection_mm))
                max_mx = max(max_mx, abs(mx))
                max_my = max(max_my, abs(my))
                row.append({
                    "x_m": round(x, 6),
                    "y_m": round(y, 6),
                    "w_mm": round(deflection_mm, 6),
                    "mx_knm_m": round(mx, 6),
                    "my_knm_m": round(my, 6),
                })
            rows.append(row)

        return {
            "solver": self.solver_id,
            "analysis_type": "linear_elastic_surface_field",
            "theory": "Kirchhoff-Love thin plate, Navier double-sine series",
            "boundary_condition": "simply_supported_on_four_edges",
            "grid": {"nx": grid, "ny": grid, "rows": rows},
            "envelope": {
                "max_abs_deflection_mm": round(max_deflection_mm, 6),
                "max_abs_mx_knm_m": round(max_mx, 6),
                "max_abs_my_knm_m": round(max_my, 6),
            },
            "applicability": {
                "supported": ["rectangular", "constant_thickness", "isotropic", "uniform_load", "four_edges_simply_supported"],
                "not_supported": ["openings", "line_supports", "point_supports", "orthotropic", "nonlinear", "contact", "cracking", "stability"],
            },
            "decisions": [
                DecisionRecord(
                    decision_id="surface_solver",
                    subject="Flächentheorie",
                    selected="Navier series / Kirchhoff-Love",
                    reason="Rechteckige isotrope Platte mit konstanter Dicke und gelenkiger Lagerung an allen vier Rändern.",
                    alternatives=("Mindlin plate FEM", "shell FEM", "nonlinear surface"),
                    standard_refs=("EN1990", "EN1992-1-1"),
                ).to_dict()
            ],
            "calculation_steps": [
                CalculationStep(
                    step_id="plate_rigidity",
                    label="Biegesteifigkeit der Platte",
                    formula="D = E h³ / (12 (1 - ν²))",
                    substitutions=f"E={elastic_modulus_mpa:g} MPa; h={thickness_m:g} m; ν={poisson_ratio:g}",
                    value=round(rigidity, 6),
                    unit="kNm",
                    assumptions=("Dünne Platte", "Linear elastisch", "Kleine Verformungen"),
                ).to_dict(),
                CalculationStep(
                    step_id="navier_series",
                    label="Doppelte Sinusreihe",
                    formula="w(x,y) = ΣΣ 16q sin(mπx/a) sin(nπy/b) / (π⁶ D mn((m/a)²+(n/b)²)²)",
                    substitutions=f"m,n ungerade bis {series_terms}; Raster {grid}×{grid}",
                    value=round(max_deflection_mm, 6),
                    unit="mm",
                    assumptions=("Gleichlast", "Vierseitig gelenkig gelagert"),
                ).to_dict(),
            ],
        }
