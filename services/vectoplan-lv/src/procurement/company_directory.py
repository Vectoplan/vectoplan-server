"""Stable boundary for the future georeferenced company directory."""

from __future__ import annotations

from typing import Any, Protocol, Sequence


class CompanyDirectory(Protocol):
    """Return ranked companies for a set of LV position snapshots."""

    provider_name: str

    def suggest(
        self,
        *,
        project_public_id: str,
        positions: Sequence[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Return serializable company suggestions ordered by relevance."""


class NullCompanyDirectory:
    """Explicit no-op provider used until the company service is connected."""

    provider_name = "not_connected"

    def suggest(
        self,
        *,
        project_public_id: str,
        positions: Sequence[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        del project_public_id, positions
        return []


__all__ = ["CompanyDirectory", "NullCompanyDirectory"]
