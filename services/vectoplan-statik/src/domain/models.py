"""Small immutable value objects used across all calculation modules.

The calculation kernel deliberately returns plain JSON-compatible dictionaries
at its boundary. Internally these dataclasses keep status handling and the
calculation trace consistent across beams, surfaces and material checks.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any


class MaterialKind(StrEnum):
    REINFORCED_CONCRETE = "reinforced_concrete"
    PRESTRESSED_CONCRETE = "prestressed_concrete"
    STEEL = "steel"
    COMPOSITE = "composite"
    TIMBER = "timber"
    MASONRY = "masonry"
    ALUMINIUM = "aluminium"
    SOIL = "soil"


class StructureType(StrEnum):
    RESIDENTIAL = "residential_building"
    SINGLE_FAMILY_HOUSE = "single_family_house"
    MULTI_FAMILY_BUILDING = "multi_family_building"
    HIGH_RISE_BUILDING = "high_rise_building"
    OFFICE = "office_building"
    SCHOOL_BUILDING = "school_building"
    HOSPITAL_BUILDING = "hospital_building"
    CHURCH_BUILDING = "church_building"
    ASSEMBLY_BUILDING = "assembly_building"
    HOTEL_BUILDING = "hotel_building"
    RETAIL_BUILDING = "retail_building"
    PARKING_STRUCTURE = "parking_structure"
    SPORTS_BUILDING = "sports_building"
    WAREHOUSE = "warehouse"
    BUILDING_SPECIAL = "building_special"
    INDUSTRIAL_HALL = "industrial_hall"
    BRIDGE = "bridge"
    SCAFFOLD_STANDING = "scaffold_standing"
    SCAFFOLD_SUSPENDED = "scaffold_suspended"
    FALSEWORK = "falsework"
    SCAFFOLD_SPECIAL = "scaffold_special"
    TOWER = "tower"
    RETAINING_STRUCTURE = "retaining_structure"
    GENERIC = "generic"


class AnalysisStatus(StrEnum):
    PASSED = "passed"
    ATTENTION = "attention"
    NOT_ADEQUATE = "not_adequate"
    NOT_ASSESSED = "not_assessed"


def status_from_utilization(utilization: float | None) -> AnalysisStatus:
    if utilization is None:
        return AnalysisStatus.NOT_ASSESSED
    if utilization <= 0.85:
        return AnalysisStatus.PASSED
    if utilization <= 1.0:
        return AnalysisStatus.ATTENTION
    return AnalysisStatus.NOT_ADEQUATE


@dataclass(frozen=True, slots=True)
class DecisionRecord:
    decision_id: str
    subject: str
    selected: str
    reason: str
    alternatives: tuple[str, ...] = ()
    standard_refs: tuple[str, ...] = ()
    source: str = "calculation_pipeline"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class CalculationStep:
    step_id: str
    label: str
    formula: str
    substitutions: str
    value: float | str
    unit: str
    standard_refs: tuple[str, ...] = ()
    assumptions: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class CheckResult:
    check_id: str
    label: str
    limit_state: str
    design_value: float | None
    resistance_value: float | None
    unit: str
    utilization: float | None
    explanation: str
    standard_refs: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    status: AnalysisStatus = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "status", status_from_utilization(self.utilization))

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["status"] = self.status.value
        return payload
