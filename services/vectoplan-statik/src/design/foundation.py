"""Foundation contact and sliding checks with explicit geotechnical input."""

from __future__ import annotations

from typing import Any

from src.domain import CalculationStep, CheckResult, DecisionRecord


class FoundationBearingDesign:
    design_id = "rectangular_foundation_bearing/0.3"

    def check(self, payload: dict[str, Any]) -> dict[str, Any]:
        width_m = float(payload["width_m"])
        length_m = float(payload["length_m"])
        axial_kn = abs(float(payload.get("design_axial_kn", 0.0)))
        mx_knm = abs(float(payload.get("design_moment_x_knm", 0.0)))
        my_knm = abs(float(payload.get("design_moment_y_knm", 0.0)))
        resistance_kn_m2 = float(payload["design_soil_resistance_kn_m2"])
        if min(width_m, length_m, resistance_kn_m2) <= 0:
            raise ValueError("Invalid foundation geometry or soil resistance")

        ex = my_knm / axial_kn if axial_kn else 0.0
        ey = mx_knm / axial_kn if axial_kn else 0.0
        effective_width = max(0.0, width_m - 2.0 * ex)
        effective_length = max(0.0, length_m - 2.0 * ey)
        pressure = axial_kn / (effective_width * effective_length) if effective_width and effective_length else float("inf")
        checks = [
            CheckResult(
                "foundation_bearing", "Sohlwiderstand", "ULS", pressure, resistance_kn_m2, "kN/m²",
                pressure / resistance_kn_m2, "Sohldruck auf der aus Exzentrizitäten reduzierten wirksamen Fläche.",
                ("EN1997-1",), ("Baugrundwiderstand muss aus einem geotechnischen Nachweis stammen.",),
            ),
            CheckResult(
                "foundation_contact_x", "Resultierende im Kern · x", "SLS", ex, width_m / 6.0, "m",
                ex / (width_m / 6.0), "Kontrolle der Exzentrizität bezogen auf die Fundamentbreite.", ("EN1997-1",),
            ),
            CheckResult(
                "foundation_contact_y", "Resultierende im Kern · y", "SLS", ey, length_m / 6.0, "m",
                ey / (length_m / 6.0), "Kontrolle der Exzentrizität bezogen auf die Fundamentlänge.", ("EN1997-1",),
            ),
        ]

        horizontal_kn = abs(float(payload.get("design_horizontal_kn", 0.0)))
        friction_coefficient = payload.get("base_friction_coefficient")
        if friction_coefficient is not None:
            sliding_resistance = float(friction_coefficient) * axial_kn
            checks.append(CheckResult(
                "foundation_sliding", "Gleiten", "ULS", horizontal_kn, sliding_resistance, "kN",
                horizontal_kn / sliding_resistance if sliding_resistance > 0 else None,
                "Horizontalwirkung im Vergleich zum ausdrücklich angegebenen Reibungswiderstand an der Sohle.",
                ("EN1997-1",), ("Passiver Erddruck und weitere Widerstände werden nicht automatisch angesetzt.",),
            ))

        return {
            "design_module": self.design_id,
            "effective_area": {"width_m": round(effective_width, 4), "length_m": round(effective_length, 4)},
            "eccentricity": {"ex_m": round(ex, 5), "ey_m": round(ey, 5)},
            "checks": [check.to_dict() for check in checks],
            "decisions": [DecisionRecord(
                "soil_resistance_source", "Baugrundwiderstand", "explicit_project_input",
                "Der Statikdienst ermittelt ohne Baugrundmodell keinen zulässigen Widerstand.",
                standard_refs=("EN1997-1",),
            ).to_dict()],
            "calculation_steps": [
                CalculationStep(
                    "foundation_eccentricity", "Exzentrizitäten", "ex = My/NEd; ey = Mx/NEd",
                    f"NEd={axial_kn:.3f} kN; Mx={mx_knm:.3f} kNm; My={my_knm:.3f} kNm",
                    f"{ex:.3f} / {ey:.3f}", "m", ("EN1997-1",),
                ).to_dict(),
                CalculationStep(
                    "foundation_pressure", "Sohldruck", "σEd = NEd / ((B-2ex)(L-2ey))",
                    f"ex={ex:.3f} m; ey={ey:.3f} m", round(pressure, 3), "kN/m²", ("EN1997-1",),
                ).to_dict(),
            ],
            "verification_level": "bearing_pressure_and_contact_check_not_geotechnical_design",
        }
