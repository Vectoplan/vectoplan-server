"""Create structured, deliberately non-official document drafts."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

from src.pipeline.orchestrator import run_energy_pipeline


SUPPORTED_DOCUMENTS = {"energy-certificate-draft", "renovation-roadmap-draft", "thermal-report-draft"}


def build_document_draft(document_type: str, project: Mapping[str, Any]) -> dict[str, Any]:
    if document_type not in SUPPORTED_DOCUMENTS:
        raise ValueError("unsupported document type")
    result = run_energy_pipeline(project, include_variants=True)
    content: dict[str, Any]
    if document_type == "renovation-roadmap-draft":
        content = result["renovation_roadmap"]
    elif document_type == "thermal-report-draft":
        content = {
            "summary": result["summary"],
            "envelope": next(stage["output"] for stage in result["stages"] if stage["id"] == "envelope"),
            "heating_load": next(stage["output"] for stage in result["stages"] if stage["id"] == "heating-load"),
            "moisture": next(stage["output"] for stage in result["stages"] if stage["id"] == "moisture"),
            "summer_comfort": next(stage["output"] for stage in result["stages"] if stage["id"] == "summer-comfort"),
        }
    else:
        content = {
            "certificate_kind": "demand",
            "building": result["normalized_project"]["building"],
            "project": result["normalized_project"]["project"],
            "summary": result["summary"],
            "modernization_recommendations": result.get("variants", []),
        }
    return {
        "ok": True,
        "document_type": document_type,
        "status": "draft",
        "normative": False,
        "official_export_allowed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "project_id": result["project_id"],
        "model_fingerprint": result["model_fingerprint"],
        "content": content,
        "blocking_gates": result["readiness"]["missing_gates"],
    }


__all__ = ["SUPPORTED_DOCUMENTS", "build_document_draft"]
