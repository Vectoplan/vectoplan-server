"""Dependency-inversion contracts; deliberately no HTTP clients live here."""

from __future__ import annotations

from typing import Any, Mapping, Protocol


class BuildingModelSource(Protocol):
    """Future read port for immutable CAD/editor building snapshots."""

    def get_snapshot(self, project_id: str, revision: str | None = None) -> Mapping[str, Any]: ...


class EnergyCatalogSource(Protocol):
    """Future read port for versioned library material and system data."""

    def get_catalog(self, catalog_revision: str | None = None) -> Mapping[str, Any]: ...


class ChangeSetSink(Protocol):
    """Future write port; changes are never written directly into peer services."""

    def submit(self, change_set: Mapping[str, Any]) -> Mapping[str, Any]: ...


__all__ = ["BuildingModelSource", "ChangeSetSink", "EnergyCatalogSource"]
