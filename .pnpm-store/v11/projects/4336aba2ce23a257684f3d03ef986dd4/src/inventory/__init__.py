# services/vectoplan-editor/src/inventory/__init__.py
"""
Öffentliche Inventar-Paket-Fassade für den Service `vectoplan-editor`.

Zweck:
- `routes/inventory.py` soll nur HTTP-Adapter bleiben.
- Dieses Paket stellt die stabile Python-API für das Editor-Inventar bereit.
- Die eigentliche Payload-Erzeugung liegt in `src.inventory.payload`.
- Optional können Fallback- und Metadatenlogik in eigene Module ausgelagert werden:
  - `src.inventory.fallback`
  - `src.inventory.metadata`
- Diese Datei bleibt importrobust, damit die Route auch während schrittweiser
  Entwicklung nicht durch fehlende Submodule bricht.

Geplante Import-Richtung:

    routes/inventory.py
      -> src.inventory
      -> src.inventory.payload
      -> src.library_inventory
      -> src.clients.library_client
      -> vectoplan-library

Wichtige öffentliche Funktionen für `routes/inventory.py`:

    build_editor_inventory_payload(...)
    build_fallback_editor_inventory_payload(...)
    get_editor_inventory_package_metadata()
    clear_editor_inventory_package_caches()

Diese Datei enthält bewusst:
- keine Flask-Route
- keine HTML-Erzeugung
- keine Frontend-/DOM-Logik
- keine direkte Chunk-/BlockWorld-Mutation
- keine produktive Inventar-Item-Definition
- keine direkte Datenbanklogik

Robustheitsprinzipien:
- Lazy Imports
- gecachte Modulauflösung
- klare Fehler bei fehlender primärer Payload-Schicht
- lokaler Minimal-Fallback ohne produktive Items
- flexible Signaturdelegation
- Cache-Clear für Entwicklungsreloads und Tests
- JSON-kompatible Diagnosemetadaten
"""

from __future__ import annotations

import dataclasses
import importlib
import inspect
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from functools import lru_cache
from types import ModuleType
from typing import Any, Final


# -----------------------------------------------------------------------------
# Paketkonstanten
# -----------------------------------------------------------------------------

INVENTORY_PACKAGE_NAME: Final[str] = "src.inventory"
INVENTORY_PACKAGE_VERSION: Final[str] = "0.2.0"

INVENTORY_PAYLOAD_MODULE_NAME: Final[str] = f"{INVENTORY_PACKAGE_NAME}.payload"
INVENTORY_FALLBACK_MODULE_NAME: Final[str] = f"{INVENTORY_PACKAGE_NAME}.fallback"
INVENTORY_METADATA_MODULE_NAME: Final[str] = f"{INVENTORY_PACKAGE_NAME}.metadata"

BUILD_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME: Final[str] = "build_editor_inventory_payload"
BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME: Final[str] = "build_fallback_editor_inventory_payload"

GET_EDITOR_INVENTORY_PAYLOAD_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_payload_metadata"
GET_EDITOR_INVENTORY_FALLBACK_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_fallback_metadata"
GET_EDITOR_INVENTORY_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_metadata"
GET_EDITOR_INVENTORY_PACKAGE_METADATA_FUNCTION_NAME: Final[str] = "get_editor_inventory_package_metadata"

CLEAR_EDITOR_INVENTORY_PAYLOAD_CACHES_FUNCTION_NAME: Final[str] = "clear_editor_inventory_payload_caches"
CLEAR_EDITOR_INVENTORY_FALLBACK_CACHES_FUNCTION_NAME: Final[str] = "clear_editor_inventory_fallback_caches"
CLEAR_EDITOR_INVENTORY_METADATA_CACHES_FUNCTION_NAME: Final[str] = "clear_editor_inventory_metadata_caches"

DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def _normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert beliebige Werte zu einem nicht-leeren String oder `default`.
    """
    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip()
        return normalized or default

    try:
        normalized = str(value).strip()
        return normalized or default
    except Exception:
        return default


def _coerce_text(value: Any, default: str) -> str:
    """
    Erzwingt einen String mit Fallback.
    """
    normalized = _normalize_text(value, default)
    return normalized if normalized is not None else default


def _coerce_bool(value: Any, default: bool = False) -> bool:
    """
    Wandelt typische Werte robust in bool um.
    """
    if isinstance(value, bool):
        return value

    if isinstance(value, int) and not isinstance(value, bool):
        return bool(value)

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"1", "true", "t", "yes", "y", "on", "enabled"}:
            return True

        if normalized in {"0", "false", "f", "no", "n", "off", "disabled"}:
            return False

    return default


def _safe_utc_timestamp() -> str:
    """
    Liefert robust einen UTC-ISO-Zeitstempel.
    """
    try:
        return datetime.now(UTC).isoformat()
    except Exception:
        try:
            return datetime.utcnow().isoformat() + "Z"
        except Exception:
            return "1970-01-01T00:00:00Z"


def _to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """
    Wandelt typische Python-Objekte defensiv in JSON-kompatible Strukturen um.
    """
    if depth > 24:
        return _normalize_text(value, "<max-depth>")

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if dataclasses.is_dataclass(value):
        try:
            return _to_json_compatible(dataclasses.asdict(value), depth=depth + 1)
        except Exception:
            return _normalize_text(value)

    if isinstance(value, Mapping):
        result: dict[str, Any] = {}

        for key, item in value.items():
            safe_key = _coerce_text(key, "unknown")
            result[safe_key] = _to_json_compatible(item, depth=depth + 1)

        return result

    if isinstance(value, set):
        try:
            return [_to_json_compatible(item, depth=depth + 1) for item in sorted(value)]
        except Exception:
            return [_to_json_compatible(item, depth=depth + 1) for item in value]

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_to_json_compatible(item, depth=depth + 1) for item in value]

    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8")
        except Exception:
            return "<bytes>"

    if isinstance(value, BaseException):
        return {
            "type": value.__class__.__name__,
            "message": _coerce_text(value, "Unbekannter Fehler."),
        }

    return _normalize_text(value)


def _exception_payload(exc: BaseException | str | None) -> dict[str, Any] | None:
    """
    Liefert eine JSON-kompatible Fehlerbeschreibung.
    """
    if exc is None:
        return None

    if isinstance(exc, str):
        return {
            "type": "Error",
            "message": exc,
        }

    return {
        "type": exc.__class__.__name__,
        "message": _coerce_text(exc, "Unbekannter Fehler."),
    }


def _coerce_payload_dict(payload: Any, *, function_name: str) -> dict[str, Any]:
    """
    Erzwingt ein Dictionary als Payload-Rückgabe.
    """
    if isinstance(payload, dict):
        return payload

    if dataclasses.is_dataclass(payload):
        converted = _to_json_compatible(payload)
        if isinstance(converted, dict):
            return converted

    if isinstance(payload, Mapping):
        return dict(payload)

    try:
        converted = dict(payload)
        if isinstance(converted, dict):
            return converted
    except Exception:
        pass

    raise TypeError(
        f"`{function_name}(...)` muss ein Dictionary oder mapping-artiges Objekt zurückgeben."
    )


# -----------------------------------------------------------------------------
# Lazy Import / Modulauflösung
# -----------------------------------------------------------------------------

@lru_cache(maxsize=64)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    """
    Liefert alle zulässigen `ModuleNotFoundError.name`-Werte für einen Modulpfad.

    Beispiel:
    `src.inventory.payload` -> (`src`, `src.inventory`, `src.inventory.payload`)
    """
    normalized_module_name = _normalize_text(module_name, "")
    if not normalized_module_name:
        return ()

    parts = normalized_module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    """
    Prüft, ob ein `ModuleNotFoundError` das Zielmodul selbst betrifft
    und nicht eine innere Abhängigkeit.
    """
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=16)
def _load_optional_module(module_name: str) -> ModuleType | None:
    """
    Lädt ein optionales Inventar-Submodul lazy und gecacht.

    Verhalten:
    - fehlt das Zielmodul selbst -> None
    - fehlt eine innere Abhängigkeit -> RuntimeError
    - sonst -> Modul
    """
    normalized_module_name = _coerce_text(module_name, "")
    if not normalized_module_name:
        return None

    try:
        return importlib.import_module(normalized_module_name)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, normalized_module_name):
            return None

        raise RuntimeError(
            f"Das Inventar-Modul `{normalized_module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Inventar-Modul `{normalized_module_name}` konnte nicht importiert werden."
        ) from exc


def _safe_get_callable(module: ModuleType | None, attribute_name: str) -> Callable[..., Any] | None:
    """
    Liest ein Attribut aus einem Modul und gibt es nur zurück, wenn es callable ist.
    """
    if module is None:
        return None

    try:
        candidate = getattr(module, attribute_name, None)
    except Exception:
        return None

    return candidate if callable(candidate) else None


@lru_cache(maxsize=1)
def _resolve_inventory_api() -> dict[str, Any]:
    """
    Löst die verfügbare öffentliche Inventar-API aus optionalen Submodulen auf.
    """
    payload_module = _load_optional_module(INVENTORY_PAYLOAD_MODULE_NAME)
    fallback_module = _load_optional_module(INVENTORY_FALLBACK_MODULE_NAME)
    metadata_module = _load_optional_module(INVENTORY_METADATA_MODULE_NAME)

    payload_build = _safe_get_callable(
        payload_module,
        BUILD_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
    )

    payload_fallback_build = _safe_get_callable(
        payload_module,
        BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
    )

    dedicated_fallback_build = _safe_get_callable(
        fallback_module,
        BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
    )

    payload_metadata_getter = _safe_get_callable(
        payload_module,
        GET_EDITOR_INVENTORY_PAYLOAD_METADATA_FUNCTION_NAME,
    )

    fallback_metadata_getter = _safe_get_callable(
        fallback_module,
        GET_EDITOR_INVENTORY_FALLBACK_METADATA_FUNCTION_NAME,
    )

    metadata_getter = (
        _safe_get_callable(metadata_module, GET_EDITOR_INVENTORY_PACKAGE_METADATA_FUNCTION_NAME)
        or _safe_get_callable(metadata_module, GET_EDITOR_INVENTORY_METADATA_FUNCTION_NAME)
    )

    payload_cache_clearer = _safe_get_callable(
        payload_module,
        CLEAR_EDITOR_INVENTORY_PAYLOAD_CACHES_FUNCTION_NAME,
    )

    fallback_cache_clearer = _safe_get_callable(
        fallback_module,
        CLEAR_EDITOR_INVENTORY_FALLBACK_CACHES_FUNCTION_NAME,
    )

    metadata_cache_clearer = _safe_get_callable(
        metadata_module,
        CLEAR_EDITOR_INVENTORY_METADATA_CACHES_FUNCTION_NAME,
    )

    return {
        "payload_module_available": payload_module is not None,
        "fallback_module_available": fallback_module is not None,
        "metadata_module_available": metadata_module is not None,
        "payload_module": payload_module,
        "fallback_module": fallback_module,
        "metadata_module": metadata_module,
        "build_payload": payload_build,
        "build_fallback_payload": dedicated_fallback_build or payload_fallback_build,
        "payload_build_fallback": payload_fallback_build,
        "dedicated_fallback_build": dedicated_fallback_build,
        "payload_metadata_getter": payload_metadata_getter,
        "fallback_metadata_getter": fallback_metadata_getter,
        "metadata_getter": metadata_getter,
        "payload_cache_clearer": payload_cache_clearer,
        "fallback_cache_clearer": fallback_cache_clearer,
        "metadata_cache_clearer": metadata_cache_clearer,
    }


# -----------------------------------------------------------------------------
# Flexible Delegation
# -----------------------------------------------------------------------------

def _call_with_supported_kwargs(
    callback: Callable[..., Any],
    kwargs: Mapping[str, Any],
) -> Any:
    """
    Ruft eine Funktion mit den Keyword-Argumenten auf, die sie unterstützt.

    Wenn die Zielsignatur `**kwargs` akzeptiert, werden alle Argumente
    durchgereicht. Sonst werden nur passende Keyword-Argumente übergeben.
    """
    kwargs_dict = dict(kwargs)

    try:
        signature = inspect.signature(callback)
    except Exception:
        try:
            return callback(**kwargs_dict)
        except TypeError:
            return callback()

    parameters = signature.parameters
    accepts_var_kwargs = any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )

    if accepts_var_kwargs:
        return callback(**kwargs_dict)

    supported_kwargs: dict[str, Any] = {}
    required_without_value: list[str] = []

    for name, parameter in parameters.items():
        if parameter.kind not in {
            inspect.Parameter.KEYWORD_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        }:
            continue

        if name in kwargs_dict:
            supported_kwargs[name] = kwargs_dict[name]
        elif parameter.default is inspect.Parameter.empty:
            required_without_value.append(name)

    if required_without_value:
        raise TypeError(
            "Inventar-Callback kann nicht aufgerufen werden. "
            f"Fehlende Pflichtargumente: {', '.join(required_without_value)}."
        )

    return callback(**supported_kwargs)


# -----------------------------------------------------------------------------
# Fehler- und Fallback-Payloads
# -----------------------------------------------------------------------------

def _build_missing_payload_module_error() -> RuntimeError:
    """
    Baut eine klare Fehlermeldung für fehlendes `payload.py`.
    """
    return RuntimeError(
        f"Das Inventar-Payload-Modul `{INVENTORY_PAYLOAD_MODULE_NAME}` ist noch nicht verfügbar. "
        "Erstelle als nächsten Schritt `services/vectoplan-editor/src/inventory/payload.py`."
    )


def _build_missing_payload_builder_error() -> RuntimeError:
    """
    Baut eine klare Fehlermeldung für fehlende Payload-Builder-Funktion.
    """
    return RuntimeError(
        f"Im Modul `{INVENTORY_PAYLOAD_MODULE_NAME}` fehlt die Funktion "
        f"`{BUILD_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME}(...)`."
    )


def _build_minimal_fallback_inventory_payload(
    *,
    reason: str,
    source_error: Exception | str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Liefert einen minimalen Fallback-Payload.

    Wichtig:
    - Dieser Fallback enthält bewusst keine produktiven Inventaritems.
    - Echte Library-Items werden später in `payload.py` über den Library-Client gebaut.
    - Der Fallback verhindert nur eine unstrukturierte API-Antwort.
    """
    request_id = (
        kwargs.get("request_id")
        or kwargs.get("correlation_id")
        or kwargs.get("requestId")
    )

    return {
        "ok": False,
        "kind": "editor-inventory",
        "version": "editor-inventory.v1",
        "source": "src.inventory.fallback.minimal",
        "generatedAtUtc": _safe_utc_timestamp(),
        "requestId": _normalize_text(request_id),
        "fallback": {
            "active": True,
            "reason": _coerce_text(reason, "payload-unavailable"),
            "sourceError": _exception_payload(source_error)
            if isinstance(source_error, BaseException)
            else _normalize_text(source_error),
        },
        "inventory": {
            "enabled": True,
            "source": "fallback",
            "hotbarSize": DEFAULT_HOTBAR_SIZE,
            "defaultSelectedSlot": DEFAULT_SELECTED_SLOT,
            "selectedSlot": DEFAULT_SELECTED_SLOT,
            "slots": [],
            "items": [],
        },
        "diagnostics": {
            "package": get_editor_inventory_package_metadata(include_submodule_metadata=False),
        },
    }


# -----------------------------------------------------------------------------
# Öffentliche Payload-API
# -----------------------------------------------------------------------------

def build_editor_inventory_payload(**kwargs: Any) -> dict[str, Any]:
    """
    Baut den Editor-Inventar-Payload.

    Diese Funktion ist die stabile öffentliche API für `routes/inventory.py`.

    Primärdelegation:
        `src.inventory.payload.build_editor_inventory_payload(...)`

    Verhalten:
    - Wenn `payload.py` fehlt, wird ein klarer Fehler geworfen.
    - Wenn der Builder fehlt, wird ein klarer Fehler geworfen.
    - Fallback-Erzeugung liegt in `build_fallback_editor_inventory_payload(...)`.
    """
    api = _resolve_inventory_api()

    if not _coerce_bool(api.get("payload_module_available"), False):
        raise _build_missing_payload_module_error()

    builder = api.get("build_payload")
    if not callable(builder):
        raise _build_missing_payload_builder_error()

    payload = _call_with_supported_kwargs(builder, kwargs)

    return _coerce_payload_dict(
        payload,
        function_name=BUILD_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
    )


def build_fallback_editor_inventory_payload(**kwargs: Any) -> dict[str, Any]:
    """
    Baut einen Fallback-Inventar-Payload.

    Reihenfolge:
    1. `src.inventory.fallback.build_fallback_editor_inventory_payload(...)`
    2. `src.inventory.payload.build_fallback_editor_inventory_payload(...)`
    3. lokaler Minimal-Fallback ohne produktive Items
    """
    reason = _coerce_text(kwargs.get("reason"), "fallback-requested")
    source_error = kwargs.get("source_error", kwargs.get("source_error_message"))

    try:
        api = _resolve_inventory_api()
    except Exception as exc:
        return _build_minimal_fallback_inventory_payload(
            reason="inventory-api-resolution-error",
            source_error=exc,
            **kwargs,
        )

    fallback_builder = api.get("build_fallback_payload")
    if callable(fallback_builder):
        try:
            payload = _call_with_supported_kwargs(fallback_builder, kwargs)

            return _coerce_payload_dict(
                payload,
                function_name=BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
            )
        except Exception as exc:
            return _build_minimal_fallback_inventory_payload(
                reason="fallback-payload-builder-error",
                source_error=exc,
                **kwargs,
            )

    if not _coerce_bool(api.get("payload_module_available"), False):
        return _build_minimal_fallback_inventory_payload(
            reason="payload-module-missing",
            source_error=source_error,
            **kwargs,
        )

    return _build_minimal_fallback_inventory_payload(
        reason=reason,
        source_error=source_error,
        **kwargs,
    )


# -----------------------------------------------------------------------------
# Metadaten / Diagnose / Health
# -----------------------------------------------------------------------------

def _safe_call_metadata_getter(callback: Callable[..., Any] | None) -> dict[str, Any] | None:
    """
    Ruft einen Metadaten-Getter defensiv auf.
    """
    if not callable(callback):
        return None

    try:
        value = callback()
        if isinstance(value, dict):
            return value
        if isinstance(value, Mapping):
            return dict(value)
        converted = _to_json_compatible(value)
        if isinstance(converted, dict):
            return converted
        return {"value": converted}
    except Exception as exc:
        return {
            "error": _exception_payload(exc),
        }


def get_editor_inventory_package_metadata(
    *,
    include_submodule_metadata: bool = True,
) -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten für das Inventar-Paket.
    """
    try:
        api = _resolve_inventory_api()
        api_error = None
    except Exception as exc:
        api = {}
        api_error = exc

    metadata_payload: dict[str, Any] | None = None
    metadata_module_payload: dict[str, Any] | None = None
    fallback_metadata_payload: dict[str, Any] | None = None

    if include_submodule_metadata and not api_error:
        metadata_payload = _safe_call_metadata_getter(api.get("payload_metadata_getter"))
        metadata_module_payload = _safe_call_metadata_getter(api.get("metadata_getter"))
        fallback_metadata_payload = _safe_call_metadata_getter(api.get("fallback_metadata_getter"))

    return {
        "packageName": INVENTORY_PACKAGE_NAME,
        "packageVersion": INVENTORY_PACKAGE_VERSION,
        "generatedAtUtc": _safe_utc_timestamp(),
        "modules": {
            "payload": {
                "moduleName": INVENTORY_PAYLOAD_MODULE_NAME,
                "available": _coerce_bool(api.get("payload_module_available"), False),
                "buildPayloadAvailable": callable(api.get("build_payload")),
                "buildFallbackPayloadAvailable": callable(api.get("payload_build_fallback")),
                "metadataGetterAvailable": callable(api.get("payload_metadata_getter")),
                "cacheClearerAvailable": callable(api.get("payload_cache_clearer")),
                "metadata": metadata_payload,
            },
            "fallback": {
                "moduleName": INVENTORY_FALLBACK_MODULE_NAME,
                "available": _coerce_bool(api.get("fallback_module_available"), False),
                "buildFallbackPayloadAvailable": callable(api.get("dedicated_fallback_build")),
                "metadataGetterAvailable": callable(api.get("fallback_metadata_getter")),
                "cacheClearerAvailable": callable(api.get("fallback_cache_clearer")),
                "metadata": fallback_metadata_payload,
            },
            "metadata": {
                "moduleName": INVENTORY_METADATA_MODULE_NAME,
                "available": _coerce_bool(api.get("metadata_module_available"), False),
                "metadataGetterAvailable": callable(api.get("metadata_getter")),
                "cacheClearerAvailable": callable(api.get("metadata_cache_clearer")),
                "metadata": metadata_module_payload,
            },
        },
        "api": {
            "buildEditorInventoryPayload": BUILD_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
            "buildFallbackEditorInventoryPayload": BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME,
            "getEditorInventoryPackageMetadata": GET_EDITOR_INVENTORY_PACKAGE_METADATA_FUNCTION_NAME,
            "clearEditorInventoryPackageCaches": "clear_editor_inventory_package_caches",
        },
        "error": _exception_payload(api_error),
    }


def get_editor_inventory_package_health() -> dict[str, Any]:
    """
    Liefert eine kompakte Health-Diagnose des Inventar-Pakets.
    """
    metadata = get_editor_inventory_package_metadata(include_submodule_metadata=False)
    payload_module = metadata.get("modules", {}).get("payload", {})
    build_available = _coerce_bool(payload_module.get("buildPayloadAvailable"), False)

    return {
        "ok": build_available,
        "status": "ok" if build_available else "payload-unavailable",
        "generatedAtUtc": _safe_utc_timestamp(),
        "packageName": INVENTORY_PACKAGE_NAME,
        "packageVersion": INVENTORY_PACKAGE_VERSION,
        "metadata": metadata,
    }


# -----------------------------------------------------------------------------
# Cache-Clear
# -----------------------------------------------------------------------------

def clear_editor_inventory_package_caches() -> None:
    """
    Löscht interne Caches dieses Pakets und, falls verfügbar, Submodul-Caches.

    Nützlich für:
    - Tests
    - Entwicklungsreloads
    - schrittweises Ergänzen von `payload.py`, `fallback.py`, `metadata.py`
    """
    try:
        api = _resolve_inventory_api()
    except Exception:
        api = {}

    for key in (
        "payload_cache_clearer",
        "fallback_cache_clearer",
        "metadata_cache_clearer",
    ):
        cache_clearer = api.get(key)
        if callable(cache_clearer):
            try:
                cache_clearer()
            except Exception:
                pass

    cache_clearers = (
        _candidate_missing_names,
        _load_optional_module,
        _resolve_inventory_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


# -----------------------------------------------------------------------------
# Rückwärtskompatible Alias-Funktionen
# -----------------------------------------------------------------------------

def get_editor_inventory_metadata() -> dict[str, Any]:
    """
    Alias für ältere oder alternative Aufrufer.
    """
    return get_editor_inventory_package_metadata()


def get_editor_inventory_payload_metadata() -> dict[str, Any]:
    """
    Alias für Payload-nahe Diagnose.
    """
    return get_editor_inventory_package_metadata()


def clear_editor_inventory_caches() -> None:
    """
    Alias für Cache-Clear.
    """
    clear_editor_inventory_package_caches()


# -----------------------------------------------------------------------------
# Öffentliche Exporte
# -----------------------------------------------------------------------------

__all__ = [
    "INVENTORY_PACKAGE_NAME",
    "INVENTORY_PACKAGE_VERSION",
    "INVENTORY_PAYLOAD_MODULE_NAME",
    "INVENTORY_FALLBACK_MODULE_NAME",
    "INVENTORY_METADATA_MODULE_NAME",
    "BUILD_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME",
    "BUILD_FALLBACK_EDITOR_INVENTORY_PAYLOAD_FUNCTION_NAME",
    "GET_EDITOR_INVENTORY_PAYLOAD_METADATA_FUNCTION_NAME",
    "GET_EDITOR_INVENTORY_PACKAGE_METADATA_FUNCTION_NAME",
    "CLEAR_EDITOR_INVENTORY_PAYLOAD_CACHES_FUNCTION_NAME",
    "DEFAULT_HOTBAR_SIZE",
    "DEFAULT_SELECTED_SLOT",
    "build_editor_inventory_payload",
    "build_fallback_editor_inventory_payload",
    "get_editor_inventory_package_metadata",
    "get_editor_inventory_package_health",
    "get_editor_inventory_metadata",
    "get_editor_inventory_payload_metadata",
    "clear_editor_inventory_package_caches",
    "clear_editor_inventory_caches",
]