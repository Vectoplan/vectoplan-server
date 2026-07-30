"""Non-persisting provider for tests and disabled attachment storage."""

from pathlib import Path
from typing import Any

from src.storage.base import StorageProvider


class NullStorageProvider(StorageProvider):
    name = "null"

    def readiness(self) -> dict[str, Any]:
        return {"status": "ok", "provider": self.name}

    def resolve(self, object_key: str) -> Path:
        raise RuntimeError("the null storage provider does not resolve objects")


__all__ = ["NullStorageProvider"]
