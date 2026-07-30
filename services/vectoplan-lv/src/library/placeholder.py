"""Non-networking placeholder for later library snapshots."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LibraryClientPlaceholder:
    enabled: bool = False
    reason: str = (
        "vectoplan-library remains an independent service; integration is planned"
    )


__all__ = ["LibraryClientPlaceholder"]
