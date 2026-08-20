"""Deterministic load-combination engine.

The engine keeps factors in the selected standards profile and exposes every
factor in the result. This makes combinations inspectable and replaceable when
licensed national parameters are connected later.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from itertools import count
from typing import Any, Iterable

from src.domain import CalculationStep, DecisionRecord
from src.standards import StandardProfile


@dataclass(frozen=True, slots=True)
class LoadCase:
    load_case_id: str
    label: str
    category: str
    value: float
    unit: str
    action_type: str = "imposed"
    psi0: float | None = None
    psi1: float | None = None
    psi2: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CombinationEngine:
    def __init__(self, profile: StandardProfile) -> None:
        self.profile = profile

    def _psi(self, case: LoadCase, suffix: str) -> float:
        explicit = getattr(case, suffix)
        if explicit is not None:
            return float(explicit)
        return float(self.profile.parameters.get(f"{suffix}_{case.action_type}", self.profile.parameters.get(f"{suffix}_imposed", 1.0)))

    def generate(self, load_cases: Iterable[LoadCase]) -> dict[str, Any]:
        cases = list(load_cases)
        permanent = [case for case in cases if case.category == "permanent"]
        variable = [case for case in cases if case.category == "variable"]
        accidental = [case for case in cases if case.category == "accidental"]
        if not cases:
            raise ValueError("At least one load case is required")

        combinations: list[dict[str, Any]] = []
        sequence = count(1)
        gamma_g = float(self.profile.parameters["gamma_g"])
        gamma_q = float(self.profile.parameters["gamma_q"])

        leading_cases = variable or [None]
        for leading in leading_cases:
            factors: dict[str, float] = {case.load_case_id: gamma_g for case in permanent}
            for case in variable:
                factors[case.load_case_id] = gamma_q if case is leading else gamma_q * self._psi(case, "psi0")
            total = sum(case.value * factors.get(case.load_case_id, 0.0) for case in cases)
            combinations.append(
                {
                    "combination_id": f"ULS-{next(sequence):03d}",
                    "label": f"GZT STR/GEO{f' - führend {leading.label}' if leading else ''}",
                    "limit_state": "ULS",
                    "situation": "persistent_transient",
                    "leading_action": leading.load_case_id if leading else None,
                    "factors": factors,
                    "value": round(total, 6),
                    "unit": cases[0].unit,
                    "standard_refs": ["EN1990"],
                }
            )

        sls_variants = (("SLS-RARE", "rare", "psi0"), ("SLS-FREQUENT", "frequent", "psi1"), ("SLS-QUASI", "quasi_permanent", "psi2"))
        for prefix, situation, psi_name in sls_variants:
            leading = variable[0] if variable else None
            factors = {case.load_case_id: 1.0 for case in permanent}
            for case in variable:
                if situation == "rare" and case is leading:
                    factors[case.load_case_id] = 1.0
                elif situation == "frequent" and case is leading:
                    factors[case.load_case_id] = self._psi(case, "psi1")
                else:
                    factors[case.load_case_id] = self._psi(case, psi_name)
            total = sum(case.value * factors.get(case.load_case_id, 0.0) for case in cases)
            combinations.append(
                {
                    "combination_id": f"{prefix}-001",
                    "label": f"GZG {situation.replace('_', ' ')}",
                    "limit_state": "SLS",
                    "situation": situation,
                    "leading_action": leading.load_case_id if leading else None,
                    "factors": factors,
                    "value": round(total, 6),
                    "unit": cases[0].unit,
                    "standard_refs": ["EN1990"],
                }
            )

        if accidental:
            factors = {case.load_case_id: 1.0 for case in permanent + accidental}
            factors.update({case.load_case_id: self._psi(case, "psi2") for case in variable})
            combinations.append(
                {
                    "combination_id": "ULS-ACC-001",
                    "label": "Außergewöhnliche Bemessungssituation",
                    "limit_state": "ULS",
                    "situation": "accidental",
                    "leading_action": accidental[0].load_case_id,
                    "factors": factors,
                    "value": round(sum(case.value * factors.get(case.load_case_id, 0.0) for case in cases), 6),
                    "unit": cases[0].unit,
                    "standard_refs": ["EN1990"],
                }
            )

        decisions = [
            DecisionRecord(
                decision_id="load_combination_family",
                subject="Einwirkungskombinationen",
                selected="ULS persistent/transient and SLS rare/frequent/quasi-permanent",
                reason="Die Fälle enthalten ständige und/oder veränderliche Einwirkungen; alle Faktoren stammen aus dem expliziten Projektprofil.",
                standard_refs=("EN1990",),
            ).to_dict()
        ]
        steps = [
            CalculationStep(
                step_id="combination_parameters",
                label="Teilsicherheits- und Kombinationsbeiwerte",
                formula="E_d = Σ γ_G G_k + γ_Q Q_k,lead + Σ γ_Q ψ_0 Q_k,acc",
                substitutions=f"γ_G={gamma_g:g}; γ_Q={gamma_q:g}; Profil={self.profile.profile_id}",
                value=len(combinations),
                unit="Kombinationen",
                standard_refs=("EN1990",),
                assumptions=("Faktoren müssen gegen lizenzierten Nationalen Anhang geprüft werden.",),
            ).to_dict()
        ]
        return {"load_cases": [case.to_dict() for case in cases], "combinations": combinations, "decisions": decisions, "calculation_steps": steps}
