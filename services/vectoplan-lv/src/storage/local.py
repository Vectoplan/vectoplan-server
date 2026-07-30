"""Local development storage provider."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from src.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    name = "local"

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def resolve(self, object_key: str) -> Path:
        normalized = str(object_key or "").replace("\\", "/").lstrip("/")
        candidate = (self.root / normalized).resolve()
        if candidate != self.root and self.root not in candidate.parents:
            raise ValueError("storage object key leaves the configured root")
        return candidate

    def readiness(self) -> dict[str, Any]:
        if not self.root.exists():
            return {
                "status": "error",
                "provider": self.name,
                "message": "storage root does not exist",
            }
        if not self.root.is_dir():
            return {
                "status": "error",
                "provider": self.name,
                "message": "storage root is not a directory",
            }
        if not os.access(self.root, os.W_OK):
            return {
                "status": "error",
                "provider": self.name,
                "message": "storage root is not writable",
            }
        return {"status": "ok", "provider": self.name}


__all__ = ["LocalStorageProvider"]
