"""Provider-neutral storage contract."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class StorageProvider(ABC):
    name: str

    @abstractmethod
    def readiness(self) -> dict[str, Any]:
        """Return a JSON-safe readiness result."""

    @abstractmethod
    def resolve(self, object_key: str) -> Path:
        """Resolve a provider key without allowing directory traversal."""


__all__ = ["StorageProvider"]
