"""Local structural material catalog.

Values are explicit calculation inputs, not a substitute for the licensed
standard text or manufacturer declarations. A future vectoplan-library adapter
can replace this catalog without changing the solver API.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Iterable

from src.domain import MaterialKind


@dataclass(frozen=True, slots=True)
class Material:
    material_id: str
    label: str
    kind: MaterialKind
    density_kn_m3: float
    elastic_modulus_mpa: float
    poisson_ratio: float
    thermal_expansion_1_k: float
    strengths_mpa: dict[str, float]
    partial_factors: dict[str, float]
    metadata: dict[str, Any]

    def value(self, name: str) -> float:
        if name not in self.strengths_mpa:
            raise KeyError(f"Material {self.material_id!r} has no strength {name!r}")
        return float(self.strengths_mpa[name])

    def factor(self, name: str, default: float = 1.0) -> float:
        return float(self.partial_factors.get(name, default))

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["kind"] = self.kind.value
        return payload


class MaterialCatalog:
    def __init__(self, materials: Iterable[Material]) -> None:
        self._materials = {material.material_id: material for material in materials}

    def get(self, material_id: str) -> Material:
        try:
            return self._materials[material_id]
        except KeyError as exc:
            raise ValueError(f"Unsupported structural material: {material_id}") from exc

    def all(self) -> list[Material]:
        return list(self._materials.values())

    def to_dict(self) -> dict[str, Any]:
        return {
            "catalog_version": "structural-material-catalog/0.2",
            "source": "local_fallback_until_vectoplan_library_adapter",
            "materials": [material.to_dict() for material in self.all()],
        }


def default_material_catalog() -> MaterialCatalog:
    concrete = [
        Material(
            material_id=grade,
            label=f"Beton {grade}",
            kind=MaterialKind.REINFORCED_CONCRETE,
            density_kn_m3=25.0,
            elastic_modulus_mpa=elastic,
            poisson_ratio=0.20,
            thermal_expansion_1_k=10e-6,
            strengths_mpa={"fck": fck, "fctm": fctm},
            partial_factors={"gamma_c": 1.50},
            metadata={"exposure_classes": ["XC1", "XC2", "XC3", "XC4"], "standard_family": "EN 1992"},
        )
        for grade, fck, fctm, elastic in (
            ("C20/25", 20.0, 2.2, 30000.0),
            ("C25/30", 25.0, 2.6, 31000.0),
            ("C30/37", 30.0, 2.9, 33000.0),
            ("C35/45", 35.0, 3.2, 34000.0),
            ("C40/50", 40.0, 3.5, 35000.0),
            ("C50/60", 50.0, 4.1, 37000.0),
        )
    ]
    reinforcement = Material(
        material_id="B500B",
        label="Betonstahl B500B",
        kind=MaterialKind.STEEL,
        density_kn_m3=78.5,
        elastic_modulus_mpa=200000.0,
        poisson_ratio=0.30,
        thermal_expansion_1_k=12e-6,
        strengths_mpa={"fyk": 500.0, "ftk": 540.0},
        partial_factors={"gamma_s": 1.15},
        metadata={"ductility_class": "B", "standard_family": "EN 1992"},
    )
    steel = [
        Material(
            material_id=grade,
            label=f"Baustahl {grade}",
            kind=MaterialKind.STEEL,
            density_kn_m3=78.5,
            elastic_modulus_mpa=210000.0,
            poisson_ratio=0.30,
            thermal_expansion_1_k=12e-6,
            strengths_mpa={"fy": fy, "fu": fu},
            partial_factors={"gamma_m0": 1.0, "gamma_m1": 1.0},
            metadata={"standard_family": "EN 1993", "nominal_thickness_range_mm": "<=40"},
        )
        for grade, fy, fu in (("S235", 235.0, 360.0), ("S275", 275.0, 430.0), ("S355", 355.0, 510.0), ("S460", 460.0, 550.0))
    ]
    timber = [
        Material(
            material_id=grade,
            label=f"Bauholz {grade}",
            kind=MaterialKind.TIMBER,
            density_kn_m3=density,
            elastic_modulus_mpa=elastic,
            poisson_ratio=0.35,
            thermal_expansion_1_k=5e-6,
            strengths_mpa={"fm_k": fm, "fv_k": fv, "fc0_k": fc},
            partial_factors={"gamma_m": 1.30},
            metadata={"standard_family": "EN 1995", "service_class": 1, "kmod": 0.8},
        )
        for grade, density, elastic, fm, fv, fc in (
            ("C24", 4.2, 11000.0, 24.0, 4.0, 21.0),
            ("GL24h", 4.2, 11500.0, 24.0, 3.5, 24.0),
            ("GL28c", 4.5, 12600.0, 28.0, 3.5, 24.0),
        )
    ]
    masonry = [
        Material(
            material_id=grade,
            label=label,
            kind=MaterialKind.MASONRY,
            density_kn_m3=density,
            elastic_modulus_mpa=elastic,
            poisson_ratio=0.20,
            thermal_expansion_1_k=8e-6,
            strengths_mpa={"fk": fk, "fvk0": fvk0},
            partial_factors={"gamma_m": 1.50},
            metadata={"standard_family": "EN 1996", "mortar_group": "NM IIa"},
        )
        for grade, label, density, elastic, fk, fvk0 in (
            ("MZ12_NMIIA", "Mauerziegel 12 / NM IIa", 12.0, 5000.0, 3.5, 0.20),
            ("KS20_DM", "Kalksandstein 20 / Dünnbettmörtel", 18.0, 8000.0, 8.0, 0.20),
            ("AAC4_DM", "Porenbeton 4 / Dünnbettmörtel", 6.0, 2200.0, 2.5, 0.15),
        )
    ]
    prestress = Material(
        material_id="Y1860S7",
        label="Spannstahl Y1860S7",
        kind=MaterialKind.PRESTRESSED_CONCRETE,
        density_kn_m3=78.5,
        elastic_modulus_mpa=195000.0,
        poisson_ratio=0.30,
        thermal_expansion_1_k=12e-6,
        strengths_mpa={"fpk": 1860.0, "fp01k": 1640.0},
        partial_factors={"gamma_s": 1.15},
        metadata={"standard_family": "EN 1992", "strand_type": "7-wire"},
    )
    return MaterialCatalog([*concrete, reinforcement, *steel, *timber, *masonry, prestress])
