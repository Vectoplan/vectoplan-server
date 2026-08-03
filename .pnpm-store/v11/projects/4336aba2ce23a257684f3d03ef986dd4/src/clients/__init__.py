# services/vectoplan-editor/src/clients/__init__.py
from __future__ import annotations

import importlib
import logging
import threading
from types import ModuleType
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .chunk_client import (
        ChunkClient,
        ChunkClientConfig,
        ChunkClientErrorInfo,
        ChunkClientResponse,
    )


LOGGER = logging.getLogger(__name__)

CLIENTS_PACKAGE_VERSION = "0.1.0"

_CHUNK_CLIENT_MODULE_NAME = f"{__name__}.chunk_client"
_CHUNK_CLIENT_EXPORTS = {
    "ChunkClient",
    "ChunkClientConfig",
    "ChunkClientErrorInfo",
    "ChunkClientResponse",
    "get_chunk_client",
}

_CACHE_LOCK = threading.RLock()
_CACHED_CHUNK_CLIENT_MODULE: ModuleType | None = None
_CACHED_IMPORT_ERROR: BaseException | None = None


class ClientPackageImportError(RuntimeError):
    """Raised when the editor client package cannot load one of its client modules."""


def _load_chunk_client_module(*, force_reload: bool = False) -> ModuleType:
    """
    Lazily import and cache src.clients.chunk_client.

    The package __init__ stays lightweight and resilient:
    - importing src.clients does not immediately fail if a downstream import breaks
    - routes can ask for diagnostics through get_client_package_metadata()
    - tests and development tools can clear the cache explicitly
    """

    global _CACHED_CHUNK_CLIENT_MODULE
    global _CACHED_IMPORT_ERROR

    with _CACHE_LOCK:
        if _CACHED_CHUNK_CLIENT_MODULE is not None and not force_reload:
            return _CACHED_CHUNK_CLIENT_MODULE

        try:
            module = importlib.import_module(_CHUNK_CLIENT_MODULE_NAME)

            if force_reload:
                module = importlib.reload(module)

            _CACHED_CHUNK_CLIENT_MODULE = module
            _CACHED_IMPORT_ERROR = None
            return module

        except BaseException as exc:
            _CACHED_CHUNK_CLIENT_MODULE = None
            _CACHED_IMPORT_ERROR = exc

            LOGGER.exception(
                "Could not import Chunk client module %s.",
                _CHUNK_CLIENT_MODULE_NAME,
            )

            raise ClientPackageImportError(
                f"Could not import Chunk client module '{_CHUNK_CLIENT_MODULE_NAME}': {exc}"
            ) from exc


def clear_client_package_cache() -> dict[str, Any]:
    """
    Clear cached client imports.

    Useful after code reloads, development diagnostics or test setup.
    """

    global _CACHED_CHUNK_CLIENT_MODULE
    global _CACHED_IMPORT_ERROR

    with _CACHE_LOCK:
        had_module = _CACHED_CHUNK_CLIENT_MODULE is not None
        had_error = _CACHED_IMPORT_ERROR is not None

        _CACHED_CHUNK_CLIENT_MODULE = None
        _CACHED_IMPORT_ERROR = None

    return {
        "ok": True,
        "package": __name__,
        "version": CLIENTS_PACKAGE_VERSION,
        "cleared": {
            "chunkClientModule": had_module,
            "chunkClientImportError": had_error,
        },
    }


def get_client_package_metadata(*, check_imports: bool = False) -> dict[str, Any]:
    """
    Return lightweight diagnostics for the clients package.

    If check_imports=True, this function attempts to import chunk_client and reports
    the result without exposing raw tracebacks as normal API output.
    """

    metadata: dict[str, Any] = {
        "ok": True,
        "package": __name__,
        "version": CLIENTS_PACKAGE_VERSION,
        "modules": {
            "chunkClient": {
                "moduleName": _CHUNK_CLIENT_MODULE_NAME,
                "cached": _CACHED_CHUNK_CLIENT_MODULE is not None,
                "lastImportError": _format_exception(_CACHED_IMPORT_ERROR),
            }
        },
        "exports": sorted(__all__),
    }

    if not check_imports:
        return metadata

    try:
        module = _load_chunk_client_module()
        metadata["modules"]["chunkClient"].update(
            {
                "importable": True,
                "file": getattr(module, "__file__", None),
                "availableExports": sorted(
                    name for name in _CHUNK_CLIENT_EXPORTS if hasattr(module, name)
                ),
                "missingExports": sorted(
                    name for name in _CHUNK_CLIENT_EXPORTS if not hasattr(module, name)
                ),
            }
        )
    except Exception as exc:
        metadata["ok"] = False
        metadata["modules"]["chunkClient"].update(
            {
                "importable": False,
                "error": _format_exception(exc),
            }
        )

    return metadata


def get_chunk_client(*args: Any, **kwargs: Any) -> "ChunkClient":
    """
    Create a ChunkClient through the lazily loaded chunk_client module.

    This is the preferred package-level factory for routes.
    """

    module = _load_chunk_client_module()
    factory = getattr(module, "get_chunk_client", None)

    if not callable(factory):
        raise ClientPackageImportError(
            f"Chunk client module '{_CHUNK_CLIENT_MODULE_NAME}' does not expose get_chunk_client()."
        )

    return factory(*args, **kwargs)


def create_chunk_client(*args: Any, **kwargs: Any) -> "ChunkClient":
    """
    Alias for get_chunk_client().

    Kept for readability in route code where "create" may be more explicit.
    """

    return get_chunk_client(*args, **kwargs)


def get_chunk_client_class() -> type["ChunkClient"]:
    module = _load_chunk_client_module()
    client_class = getattr(module, "ChunkClient", None)

    if client_class is None:
        raise ClientPackageImportError(
            f"Chunk client module '{_CHUNK_CLIENT_MODULE_NAME}' does not expose ChunkClient."
        )

    return client_class


def get_chunk_client_config_class() -> type["ChunkClientConfig"]:
    module = _load_chunk_client_module()
    config_class = getattr(module, "ChunkClientConfig", None)

    if config_class is None:
        raise ClientPackageImportError(
            f"Chunk client module '{_CHUNK_CLIENT_MODULE_NAME}' does not expose ChunkClientConfig."
        )

    return config_class


def __getattr__(name: str) -> Any:
    """
    Lazy package-level exports.

    Allows:
        from src.clients import ChunkClient

    without eagerly importing all client modules during package import.
    """

    if name in _CHUNK_CLIENT_EXPORTS:
        module = _load_chunk_client_module()
        return getattr(module, name)

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(set(globals()) | _CHUNK_CLIENT_EXPORTS)


def _format_exception(exc: BaseException | None) -> dict[str, str] | None:
    if exc is None:
        return None

    return {
        "type": type(exc).__name__,
        "message": str(exc),
    }


__all__ = [
    "CLIENTS_PACKAGE_VERSION",
    "ClientPackageImportError",
    "ChunkClient",
    "ChunkClientConfig",
    "ChunkClientErrorInfo",
    "ChunkClientResponse",
    "clear_client_package_cache",
    "create_chunk_client",
    "get_chunk_client",
    "get_chunk_client_class",
    "get_chunk_client_config_class",
    "get_client_package_metadata",
]