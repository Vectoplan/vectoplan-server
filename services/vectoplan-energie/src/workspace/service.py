"""Build the initial energy workspace without external service calls."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


def load_json_file(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def validate_energy_project(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["project must be a JSON object"]

    errors: list[str] = []
    for field in ("schema_version", "project", "building", "geometry", "envelope", "systems"):
        if field not in payload:
            errors.append(f"missing required field: {field}")

    project = payload.get("project")
    if isinstance(project, dict):
        if not str(project.get("id", "")).strip():
            errors.append("project.id is required")
        if not str(project.get("name", "")).strip():
            errors.append("project.name is required")
    elif "project" in payload:
        errors.append("project must be an object")

    building = payload.get("building")
    if isinstance(building, dict):
        if building.get("type") not in {"residential", "non_residential"}:
            errors.append("building.type must be residential or non_residential")
    elif "building" in payload:
        errors.append("building must be an object")

    return errors


def build_bootstrap_payload(config: Mapping[str, Any]) -> dict[str, Any]:
    project = load_json_file(config["SAMPLE_PROJECT_PATH"])
    modules = load_json_file(config["MODULE_CATALOG_PATH"])
    return {
        "ok": True,
        "service": {
            "name": config["SERVICE_NAME"],
            "display_name": config["SERVICE_DISPLAY_NAME"],
            "version": config["SERVICE_VERSION"],
            "mode": "standalone_preparation",
        },
        "project": project,
        "module_catalog": modules,
        "workspace_modes": [
            {
                "id": "guided",
                "label": "Geführt",
                "description": "Erklärt Daten, Annahmen und nächste Schritte in Alltagssprache.",
            },
            {
                "id": "expert",
                "label": "Experte",
                "description": "Zeigt Eingangsgrößen, Rechenweg und fachliche Overrides.",
            },
        ],
        "integration_boundary": {
            "enabled": bool(config.get("INTEGRATIONS_ENABLED")),
            "reads": ["building_snapshot", "library_catalog_snapshot"],
            "writes": ["energy_change_set", "report_draft"],
            "targets": ["vectoplan-core", "vectoplan-cad", "vectoplan-editor", "vectoplan-library"],
            "note": "Browser-Einbettungen sind konfiguriert; serverseitige Schreibadapter bleiben deaktiviert.",
        },
        "disclaimer": (
            "Die Fachpipeline liefert reproduzierbare Arbeitsberechnungen. Amtliche GEG-, Förder-, "
            "iSFP- und Energieausweis-Ausgaben bleiben bis zur normativen Validierung gesperrt."
        ),
    }


__all__ = ["build_bootstrap_payload", "load_json_file", "validate_energy_project"]
