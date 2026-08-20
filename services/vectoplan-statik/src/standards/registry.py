"""Standards metadata and explainable selection decisions.

This module stores identifiers, editions and applicability only. It deliberately
does not reproduce copyrighted DIN content. Numerical parameters remain
versioned application data and must be reviewed against a licensed standard.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from src.domain import DecisionRecord, MaterialKind, StructureType


@dataclass(frozen=True, slots=True)
class StandardReference:
    ref_id: str
    designation: str
    title: str
    edition: str
    role: str
    status: str
    source_url: str
    national_annex: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class StandardProfile:
    profile_id: str
    country: str
    generation: str
    label: str
    references: tuple[str, ...]
    parameters: dict[str, float]
    review_required: bool
    transition_note: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class StandardsRegistry:
    def __init__(self, references: list[StandardReference], profiles: list[StandardProfile]) -> None:
        self._references = {item.ref_id: item for item in references}
        self._profiles = {item.profile_id: item for item in profiles}

    def reference(self, ref_id: str) -> StandardReference:
        try:
            return self._references[ref_id]
        except KeyError as exc:
            raise ValueError(f"Unknown standard reference: {ref_id}") from exc

    def profile(self, profile_id: str) -> StandardProfile:
        try:
            return self._profiles[profile_id]
        except KeyError as exc:
            raise ValueError(f"Unknown standards profile: {profile_id}") from exc

    def catalog(self) -> dict[str, Any]:
        return {
            "catalog_version": "structural-standards/0.2",
            "copyright_notice": "Normtexte sind nicht enthalten; Zugriff auf lizenzierte Originale erforderlich.",
            "references": [item.to_dict() for item in self._references.values()],
            "profiles": [item.to_dict() for item in self._profiles.values()],
        }

    def select(
        self,
        *,
        profile_id: str,
        structure_type: StructureType,
        material_kind: MaterialKind | None,
        actions: set[str] | None = None,
    ) -> tuple[list[StandardReference], list[DecisionRecord]]:
        profile = self.profile(profile_id)
        required = ["EN1990", "EN1991-1-1"]
        decisions = [
            DecisionRecord(
                decision_id="standard_profile",
                subject="Normprofil",
                selected=profile.profile_id,
                reason=(
                    f"Projektland {profile.country}; Profilgeneration {profile.generation}. "
                    "Die Ausgabe wird nicht automatisch auf eine neuere Normgeneration umgestellt."
                ),
                alternatives=tuple(item for item in self._profiles if item != profile.profile_id),
                standard_refs=profile.references,
                source="explicit_project_configuration",
            )
        ]
        if structure_type is StructureType.BRIDGE:
            required.append("EN1991-2")
            decisions.append(
                DecisionRecord(
                    decision_id="bridge_actions",
                    subject="Verkehrslasten",
                    selected="EN 1991-2",
                    reason="Das Tragwerk ist als Brücke klassifiziert; Verkehrslasten sind gesondert zu modellieren.",
                    standard_refs=("EN1991-2",),
                )
            )
        action_set = actions or set()
        if "snow" in action_set:
            required.append("EN1991-1-3")
        if "wind" in action_set:
            required.append("EN1991-1-4")
        if "temperature" in action_set:
            required.append("EN1991-1-5")
        if "fire" in action_set:
            required.append("EN1991-1-2")

        concrete_ref = "EN1992-1-1-2G" if profile.profile_id == "EU_2G_PREVIEW" else "EN1992-1-1"
        material_ref = {
            MaterialKind.REINFORCED_CONCRETE: concrete_ref,
            MaterialKind.PRESTRESSED_CONCRETE: concrete_ref,
            MaterialKind.STEEL: "EN1993-1-1",
            MaterialKind.TIMBER: "EN1995-1-1",
            MaterialKind.MASONRY: "EN1996-1-1",
            MaterialKind.ALUMINIUM: "EN1999-1-1",
            MaterialKind.SOIL: "EN1997-1",
        }.get(material_kind)
        if material_ref:
            required.append(material_ref)
            decisions.append(
                DecisionRecord(
                    decision_id="material_code",
                    subject="Werkstoffnachweis",
                    selected=self.reference(material_ref).designation,
                    reason=f"Das Bauteil verwendet den Werkstofftyp {material_kind.value}.",
                    standard_refs=(material_ref,),
                )
            )

        ordered_ids = list(dict.fromkeys([*profile.references, *required]))
        selected = [self.reference(ref_id) for ref_id in ordered_ids if ref_id in self._references]
        return selected, decisions


def default_standards_registry() -> StandardsRegistry:
    din_search = "https://www.din.de/de/meta/suche/62730!search"
    jrc = "https://eurocodes.jrc.ec.europa.eu/"
    references = [
        StandardReference("EN1990", "DIN EN 1990", "Grundlagen der Tragwerksplanung", "2021-10", "basis_and_combinations", "current_first_generation", "https://www.dinmedia.de/de/norm/din-en-1990/344491188", "DIN EN 1990/NA:2010-12 + A1:2024-05"),
        StandardReference("EN1991-1-1", "DIN EN 1991-1-1", "Wichten, Eigengewicht und Nutzlasten", "2010-12", "actions", "transition_review", "https://www.dinmedia.de/de/norm/din-en-1991-1-1/134234392", "DIN EN 1991-1-1/NA:2010-12 mit A1:2015; Projektstand prüfen"),
        StandardReference("EN1991-1-2", "DIN EN 1991-1-2", "Brandeinwirkungen", "2010-12", "fire_actions", "current_first_generation", f"{din_search}?query=DIN+EN+1991-1-2", "DIN EN 1991-1-2/NA"),
        StandardReference("EN1991-1-3", "DIN EN 1991-1-3", "Schneelasten", "2010-12 + A1:2015-12", "snow_actions", "current_first_generation", "https://www.dinmedia.de/de/norm/din-en-1991-1-3-na/301647243", "DIN EN 1991-1-3/NA:2019-04"),
        StandardReference("EN1991-1-4", "DIN EN 1991-1-4", "Windlasten", "2010-12", "wind_actions", "transition_review", "https://www.dinmedia.de/de/norm/din-en-1991-1-4-na/379080426", "DIN EN 1991-1-4/NA:2024-08"),
        StandardReference("EN1991-1-5", "DIN EN 1991-1-5", "Temperatureinwirkungen", "2010-12", "thermal_actions", "project_profile_review", f"{din_search}?query=DIN+EN+1991-1-5", "DIN EN 1991-1-5/NA"),
        StandardReference("EN1991-2", "DIN EN 1991-2", "Verkehrslasten auf Brücken", "2010-12", "bridge_actions", "current_first_generation", f"{din_search}?query=DIN+EN+1991-2", "DIN EN 1991-2/NA"),
        StandardReference("EN1992-1-1", "DIN EN 1992-1-1", "Beton-, Stahlbeton- und Spannbetontragwerke", "2011-01 + A1:2015-03", "concrete_design", "first_generation_project_profile", f"{din_search}?query=DIN+EN+1992-1-1", "DIN EN 1992-1-1/NA:2013-04 + A1:2015-12"),
        StandardReference("EN1992-1-1-2G", "DIN EN 1992-1-1", "Beton-, Stahlbeton- und Spannbetontragwerke", "2025-09", "concrete_design", "second_generation_transition", f"{din_search}?query=DIN+EN+1992-1-1", "DIN EN 1992-1-1/NA1:2025-08"),
        StandardReference("EN1993-1-1", "DIN EN 1993-1-1", "Stahlbauten - allgemeine Bemessungsregeln", "2010-12", "steel_design", "transition_review", f"{din_search}?query=DIN+EN+1993-1-1", "DIN EN 1993-1-1/NA"),
        StandardReference("EN1993-1-2", "DIN EN 1993-1-2", "Stahlbauten - Tragwerksbemessung für den Brandfall", "2010-12", "steel_fire_design", "project_profile_review", f"{din_search}?query=DIN+EN+1993-1-2", "DIN EN 1993-1-2/NA"),
        StandardReference("EN1993-1-9", "DIN EN 1993-1-9", "Stahlbauten - Ermüdung", "2010-12", "steel_fatigue_design", "project_profile_review", f"{din_search}?query=DIN+EN+1993-1-9", "DIN EN 1993-1-9/NA"),
        StandardReference("EN1995-1-1", "DIN EN 1995-1-1", "Holzbauten - allgemeine Regeln", "2010-12", "timber_design", "current_first_generation", f"{din_search}?query=DIN+EN+1995-1-1", "DIN EN 1995-1-1/NA"),
        StandardReference("EN1996-1-1", "DIN EN 1996-1-1", "Mauerwerksbauten - allgemeine Regeln", "2013-02", "masonry_design", "transition_review", f"{din_search}?query=DIN+EN+1996-1-1", "DIN EN 1996-1-1/NA"),
        StandardReference("EN1997-1", "DIN EN 1997-1", "Entwurf, Berechnung und Bemessung in der Geotechnik", "2014-03", "geotechnical_design", "transition_review", f"{din_search}?query=DIN+EN+1997-1", "DIN EN 1997-1/NA"),
        StandardReference("EN1999-1-1", "DIN EN 1999-1-1", "Aluminiumtragwerke - allgemeine Regeln", "2024-11", "aluminium_design", "second_generation_transition", f"{din_search}?query=DIN+EN+1999-1-1", "DIN EN 1999-1-1/NA:2025-10"),
    ]
    profiles = [
        StandardProfile(
            profile_id="DE_EC_2021",
            country="DE",
            generation="first_generation_with_current_amendments",
            label="Deutschland - eingeführte Eurocodes / projektspezifisch prüfen",
            references=("EN1990", "EN1991-1-1"),
            parameters={"gamma_g": 1.35, "gamma_q": 1.50, "psi0_imposed": 0.70, "psi1_imposed": 0.50, "psi2_imposed": 0.30},
            review_required=True,
            transition_note="Die zweite Eurocode-Generation wird national eingeführt; Projektstand und Landesrecht sind vor Freigabe zu prüfen.",
        ),
        StandardProfile(
            profile_id="EU_2G_PREVIEW",
            country="EU",
            generation="second_generation_preview",
            label="Eurocodes 2G - nur Forschungs-/Migrationsprofil",
            references=("EN1990", "EN1991-1-1"),
            parameters={"gamma_g": 1.35, "gamma_q": 1.50, "psi0_imposed": 0.70, "psi1_imposed": 0.50, "psi2_imposed": 0.30},
            review_required=True,
            transition_note=f"Nicht automatisch für deutsche Bauvorhaben freigeben. Übergangsstatus siehe {jrc}second-generation-eurocodes.",
        ),
    ]
    return StandardsRegistry(references, profiles)
