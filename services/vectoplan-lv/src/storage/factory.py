"""Storage provider creation kept outside domain services."""

from __future__ import annotations

from flask import Flask

from src.storage.base import StorageProvider
from src.storage.local import LocalStorageProvider
from src.storage.null import NullStorageProvider


def get_storage_provider(app: Flask) -> StorageProvider:
    registry = app.extensions.setdefault("vectoplan_lv", {})
    provider = registry.get("storage_provider")
    if isinstance(provider, StorageProvider):
        return provider

    provider_name = str(app.config.get("STORAGE_PROVIDER", "local")).lower()
    if provider_name == "local":
        provider = LocalStorageProvider(app.config["STORAGE_ROOT"])
    elif provider_name == "null":
        provider = NullStorageProvider()
    else:
        raise RuntimeError(f"unsupported storage provider: {provider_name}")

    registry["storage_provider"] = provider
    registry["storage"] = {"provider": provider.name}
    return provider


__all__ = ["get_storage_provider"]
