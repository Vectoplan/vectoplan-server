# services/vectoplan-editor/src/__init__.py
from __future__ import annotations

import importlib
import logging
import os
import threading
from pathlib import Path
from types import ModuleType
from typing import Any


LOGGER = logging.getLogger(__name__)

EDITOR_SRC_PACKAGE_VERSION = "0.1.0"

_PACKAGE_ROOT = Path(__file__).resolve().parent
_SERVICE_ROOT = _PACKAGE_ROOT.parent

_KNOWN_SUBPACKAGES = {
    "bootstrap": f"{__name__}.bootstrap",
    "clients": f"{__name__}.clients",
    "inventory": f"{__name__}.inventory",
}

_CACHE_LOCK = threading.RLock()
_CACHED_MODULES: dict[str, ModuleType] = {}
_CACHED_IMPORT_ERRORS: dict[str, BaseException] = {}


class EditorSrcImportError(RuntimeError):
    """Raised when a vectoplan-editor src subpackage cannot be loaded."""


def get_editor_src_paths() -> dict[str, str]:
    """
    Return resolved filesystem paths for diagnostics.

    This function is intentionally simple and side-effect free.
    """

    return {
        "packageRoot": str(_PACKAGE_ROOT),
        "serviceRoot": str(_SERVICE_ROOT),
        "cwd": os.getcwd(),
    }


def get_editor_src_metadata(
    *,
    check_imports: bool = False,
    force_reload: bool = False,
) -> dict[str, Any]:
    """
    Return package diagnostics for the vectoplan-editor backend src package.

    check_imports=False:
        cheap metadata only

    check_imports=True:
        attempts to import known subpackages and reports importability

    force_reload=True:
        reloads subpackages during import checks
    """

    metadata: dict[str, Any] = {
        "ok": True,
        "package": __name__,
        "version": EDITOR_SRC_PACKAGE_VERSION,
        "paths": get_editor_src_paths(),
        "knownSubpackages": {
            key: {
                "moduleName": module_name,
                "cached": key in _CACHED_MODULES,
                "lastImportError": _format_exception(_CACHED_IMPORT_ERRORS.get(key)),
            }
            for key, module_name in _KNOWN_SUBPACKAGES.items()
        },
    }

    if not check_imports:
        return metadata

    for key in sorted(_KNOWN_SUBPACKAGES):
        try:
            module = load_editor_src_subpackage(key, force_reload=force_reload)
            metadata["knownSubpackages"][key].update(
                {
                    "importable": True,
                    "file": getattr(module, "__file__", None),
                    "package": getattr(module, "__package__", None),
                }
            )
        except Exception as exc:
            metadata["ok"] = False
            metadata["knownSubpackages"][key].update(
                {
                    "importable": False,
                    "error": _format_exception(exc),
                }
            )

    return metadata


def load_editor_src_subpackage(name: str, *, force_reload: bool = False) -> ModuleType:
    """
    Lazily import a known src subpackage.

    Accepted names:
        bootstrap
        clients
        inventory

    The function is deliberately strict so routes and diagnostics cannot import
    arbitrary module paths from user input.
    """

    normalized = str(name or "").strip()

    if normalized not in _KNOWN_SUBPACKAGES:
        raise EditorSrcImportError(
            f"Unknown vectoplan-editor src subpackage {normalized!r}. "
            f"Known subpackages: {', '.join(sorted(_KNOWN_SUBPACKAGES))}."
        )

    with _CACHE_LOCK:
        if normalized in _CACHED_MODULES and not force_reload:
            return _CACHED_MODULES[normalized]

        module_name = _KNOWN_SUBPACKAGES[normalized]

        try:
            module = importlib.import_module(module_name)

            if force_reload:
                module = importlib.reload(module)

            _CACHED_MODULES[normalized] = module
            _CACHED_IMPORT_ERRORS.pop(normalized, None)
            return module

        except BaseException as exc:
            _CACHED_MODULES.pop(normalized, None)
            _CACHED_IMPORT_ERRORS[normalized] = exc

            LOGGER.exception(
                "Could not import vectoplan-editor src subpackage %s (%s).",
                normalized,
                module_name,
            )

            raise EditorSrcImportError(
                f"Could not import vectoplan-editor src subpackage "
                f"{normalized!r} ({module_name}): {exc}"
            ) from exc


def clear_editor_src_cache() -> dict[str, Any]:
    """
    Clear cached subpackage imports and import errors.

    Useful for development diagnostics after code reloads.
    """

    with _CACHE_LOCK:
        cleared_modules = sorted(_CACHED_MODULES)
        cleared_errors = sorted(_CACHED_IMPORT_ERRORS)

        _CACHED_MODULES.clear()
        _CACHED_IMPORT_ERRORS.clear()

    return {
        "ok": True,
        "package": __name__,
        "version": EDITOR_SRC_PACKAGE_VERSION,
        "cleared": {
            "modules": cleared_modules,
            "errors": cleared_errors,
        },
    }


def get_bootstrap_package() -> ModuleType:
    return load_editor_src_subpackage("bootstrap")


def get_clients_package() -> ModuleType:
    return load_editor_src_subpackage("clients")


def get_inventory_package() -> ModuleType:
    return load_editor_src_subpackage("inventory")


def __getattr__(name: str) -> Any:
    """
    Convenience lazy attributes.

    Allows:
        import src
        src.bootstrap
        src.clients
        src.inventory
    """

    if name in _KNOWN_SUBPACKAGES:
        return load_editor_src_subpackage(name)

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(_KNOWN_SUBPACKAGES))


def _format_exception(exc: BaseException | None) -> dict[str, str] | None:
    if exc is None:
        return None

    return {
        "type": type(exc).__name__,
        "message": str(exc),
    }


__all__ = [
    "EDITOR_SRC_PACKAGE_VERSION",
    "EditorSrcImportError",
    "clear_editor_src_cache",
    "get_bootstrap_package",
    "get_clients_package",
    "get_editor_src_metadata",
    "get_editor_src_paths",
    "get_inventory_package",
    "load_editor_src_subpackage",
]