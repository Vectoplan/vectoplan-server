# services/vectoplan-editor/routes/inventory.py
"""
Inventar-API-Route für den Service `vectoplan-editor`.

Ziel dieser Datei:
- JSON-Route für das Editor-Inventar bereitstellen
- den Inventarinhalt serverseitig liefern
- das eigentliche Payload-Building an `src.inventory` delegieren
- Route und Business-/Payload-Logik sauber trennen
- robust bleiben, auch wenn Payload-Submodule während der Entwicklung fehlen
- keine HTML-Erzeugung
- keine Runtime-Logik
- keine BlockWorld-Logik
- keine direkte Chunk-Logik
- keine direkte Library-Fachlogik in der Route

Externe Route nach Blueprint-Registrierung:

    GET  /editor/api/inventory
    HEAD /editor/api/inventory

Technischer Aufbau:
- dieses Modul definiert `inventory_bp`
- `routes.__init__` registriert diesen Blueprint mit `url_prefix="/editor/api"`
- die lokale Route in diesem Blueprint ist deshalb nur `/inventory`

Architekturregel:
- Der Browser soll nicht direkt `vectoplan-library` aufrufen.
- Der Browser ruft `/editor/api/inventory` auf.
- Diese Route delegiert an `src.inventory`.
- `src.inventory` lädt und normalisiert Library-/VPLIB-Daten.
- Nur Library-/VPLIB-Items dürfen später placeable sein.
- Debug-Blöcke wie `debug_grass` / `debug_dirt` dürfen hier nicht erfunden werden.

Robustheitsprinzipien:
- Lazy-Import von `src.inventory`
- gecachte Modul- und API-Auflösung
- klare JSON-Fehlerantworten bei fehlender Payload-Schicht
- defensives Fallback über `src.inventory.build_fallback_editor_inventory_payload`
- terminaler Fehlerpayload ohne placebare Items
- defensive Response-Header
- keine harte Import-Abhängigkeit beim Blueprint-Import
- HEAD-fähig
- Diagnosemetadaten für Tests und Health
"""

from __future__ import annotations

import dataclasses
import importlib
import inspect
import json
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from functools import lru_cache
from http import HTTPStatus
from types import ModuleType
from typing import Any, Final

from flask import Blueprint, Response, current_app, make_response, request, url_for


# -----------------------------------------------------------------------------
# Blueprint-Konstanten
# -----------------------------------------------------------------------------

INVENTORY_BLUEPRINT_NAME: Final[str] = "inventory"
INVENTORY_BLUEPRINT_MODULE_NAME: Final[str] = "routes.inventory"
INVENTORY_ROUTE_MODULE_VERSION: Final[str] = "0.4.0"

# Wichtig:
# Dieser Pfad ist relativ zum Blueprint.
# Der externe Prefix `/editor/api` wird in routes/__init__.py gesetzt.
INVENTORY_ROUTE_PATH: Final[str] = "/inventory"

# Nur Diagnose-/Dokumentationswerte.
INVENTORY_API_URL_PREFIX: Final[str] = "/editor/api"
INVENTORY_FULL_ROUTE_PATH: Final[str] = f"{INVENTORY_API_URL_PREFIX}{INVENTORY_ROUTE_PATH}"

inventory_bp = Blueprint(INVENTORY_BLUEPRINT_NAME, __name__)


# -----------------------------------------------------------------------------
# Payload-Paket-Konstanten
# -----------------------------------------------------------------------------

_EDITOR_INVENTORY_MODULE_NAME: Final[str] = "src.inventory"

_BUILD_INVENTORY_PAYLOAD_ATTRIBUTE_NAME: Final[str] = "build_editor_inventory_payload"
_BUILD_FALLBACK_INVENTORY_PAYLOAD_ATTRIBUTE_NAME: Final[str] = "build_fallback_editor_inventory_payload"
_GET_INVENTORY_PACKAGE_METADATA_ATTRIBUTE_NAME: Final[str] = "get_editor_inventory_package_metadata"
_GET_INVENTORY_PACKAGE_HEALTH_ATTRIBUTE_NAME: Final[str] = "get_editor_inventory_package_health"
_CLEAR_INVENTORY_PACKAGE_CACHES_ATTRIBUTE_NAME: Final[str] = "clear_editor_inventory_package_caches"


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def _normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert einen beliebigen Wert zu einem nicht-leeren String oder `default`.
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
    Wandelt typische boolesche Werte robust in `bool` um.
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


def _safe_get_logger() -> Any | None:
    """
    Liefert den aktuellen Flask-Logger robust zurück.
    """
    try:
        return current_app.logger
    except Exception:
        return None


def _safe_log_debug(message: str, *args: Any) -> None:
    """
    Loggt defensiv auf Debug-Level.
    """
    logger = _safe_get_logger()
    if logger is None:
        return

    try:
        logger.debug(message, *args)
    except Exception:
        pass


def _safe_log_warning(message: str, *args: Any) -> None:
    """
    Loggt defensiv auf Warning-Level.
    """
    logger = _safe_get_logger()
    if logger is None:
        return

    try:
        logger.warning(message, *args)
    except Exception:
        pass


def _safe_log_exception(message: str, *args: Any) -> None:
    """
    Loggt defensiv mit Exception-Trace.
    """
    logger = _safe_get_logger()
    if logger is None:
        return

    try:
        logger.exception(message, *args)
    except Exception:
        pass


def _safe_static_url(filename: str) -> str:
    """
    Baut robust eine Static-URL.

    Diese Funktion wird an Payload-Builder weitergereicht, damit diese bei
    Bedarf serverseitige Static-URLs erzeugen können, ohne Route-Details zu
    kennen.
    """
    clean_filename = _coerce_text(filename, "").lstrip("/")
    if not clean_filename:
        return "/static/"

    try:
        return url_for("static", filename=clean_filename)
    except Exception:
        return f"/static/{clean_filename}"


def _build_static_url(filename: str) -> str:
    """
    Stabile Builder-Funktion für die Inventar-Payload-Schicht.
    """
    return _safe_static_url(filename)


def _safe_request_args() -> dict[str, Any]:
    """
    Liefert Request-Query-Parameter als einfaches Dictionary.

    Multi-Werte werden als Listen erhalten.
    Einfache Werte bleiben Strings.
    """
    try:
        result: dict[str, Any] = {}

        for key in request.args.keys():
            values = request.args.getlist(key)
            result[key] = values[0] if len(values) == 1 else values

        return result
    except Exception:
        return {}


def _safe_request_method() -> str:
    """
    Liefert die aktuelle HTTP-Methode robust.
    """
    try:
        return _coerce_text(request.method, "GET").upper()
    except Exception:
        return "GET"


def _safe_request_path(default: str = INVENTORY_FULL_ROUTE_PATH) -> str:
    """
    Liefert den aktuellen Request-Pfad robust.
    """
    try:
        return _coerce_text(request.path, default)
    except Exception:
        return default


def _safe_request_id() -> str | None:
    """
    Liest eine optionale Request-ID aus verbreiteten Headern.
    """
    header_names = (
        "X-Request-ID",
        "X-Correlation-ID",
        "X-VECTOPLAN-Request-ID",
    )

    for header_name in header_names:
        try:
            value = _normalize_text(request.headers.get(header_name))
            if value:
                return value
        except Exception:
            continue

    return None


def _safe_config_bool(key: str, default: bool = False) -> bool:
    """
    Liest robust einen booleschen Wert aus current_app.config.
    """
    try:
        return _coerce_bool(current_app.config.get(key), default)
    except Exception:
        return default


def _should_clear_caches_from_request() -> bool:
    """
    Entscheidet, ob Caches für diesen Request geleert werden sollen.

    Gedacht für Entwicklung/Tests:
        /editor/api/inventory?clearCache=true

    In normalen Requests bleibt dies false.
    """
    args = _safe_request_args()
    return _coerce_bool(
        args.get("clearCache", args.get("clear_cache")),
        False,
    )


def _should_include_health_from_request() -> bool:
    """
    Entscheidet, ob die Metadata-Route Remote-Health inkludieren soll.
    """
    args = _safe_request_args()
    return _coerce_bool(
        args.get("includeHealth", args.get("include_health")),
        False,
    )


# -----------------------------------------------------------------------------
# Lazy Import / Payload-API-Auflösung
# -----------------------------------------------------------------------------

@lru_cache(maxsize=32)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    """
    Liefert alle zulässigen `ModuleNotFoundError.name`-Werte für einen Modulpfad.

    Beispiel:
    `src.inventory` -> (`src`, `src.inventory`)
    """
    normalized_module_name = _normalize_text(module_name, "")
    if not normalized_module_name:
        return ()

    parts = normalized_module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    """
    Prüft, ob ein `ModuleNotFoundError` wirklich das Zielmodul selbst betrifft
    und nicht eine innere Abhängigkeit.
    """
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=1)
def _load_editor_inventory_module() -> ModuleType | None:
    """
    Lädt `src.inventory` lazy und gecacht.

    Verhalten:
    - fehlt das Paket selbst -> None
    - fehlt eine innere Abhängigkeit -> RuntimeError
    - sonst -> Modul
    """
    try:
        return importlib.import_module(_EDITOR_INVENTORY_MODULE_NAME)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, _EDITOR_INVENTORY_MODULE_NAME):
            return None

        raise RuntimeError(
            f"Das Paket `{_EDITOR_INVENTORY_MODULE_NAME}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Das Paket `{_EDITOR_INVENTORY_MODULE_NAME}` konnte nicht geladen werden."
        ) from exc


def _safe_get_callable(module: ModuleType | None, attribute_name: str) -> Callable[..., Any] | None:
    """
    Löst ein Attribut aus einem Modul und gibt es nur zurück, wenn es callable ist.
    """
    if module is None:
        return None

    try:
        candidate = getattr(module, attribute_name, None)
    except Exception:
        return None

    return candidate if callable(candidate) else None


@lru_cache(maxsize=1)
def _resolve_editor_inventory_api() -> dict[str, Any]:
    """
    Löst die öffentliche API des Pakets `src.inventory` auf.

    Diese Funktion ist bewusst gecacht:
    - normale Requests müssen nicht jedes Mal Modulattribute auflösen
    - Entwicklungs-Reloads können über `clear_inventory_route_caches()` leeren
    """
    module = _load_editor_inventory_module()

    if module is None:
        return {
            "module_available": False,
            "module": None,
            "build_payload": None,
            "build_fallback_payload": None,
            "metadata_getter": None,
            "health_getter": None,
            "cache_clearer": None,
        }

    return {
        "module_available": True,
        "module": module,
        "build_payload": _safe_get_callable(
            module,
            _BUILD_INVENTORY_PAYLOAD_ATTRIBUTE_NAME,
        ),
        "build_fallback_payload": _safe_get_callable(
            module,
            _BUILD_FALLBACK_INVENTORY_PAYLOAD_ATTRIBUTE_NAME,
        ),
        "metadata_getter": _safe_get_callable(
            module,
            _GET_INVENTORY_PACKAGE_METADATA_ATTRIBUTE_NAME,
        ),
        "health_getter": _safe_get_callable(
            module,
            _GET_INVENTORY_PACKAGE_HEALTH_ATTRIBUTE_NAME,
        ),
        "cache_clearer": _safe_get_callable(
            module,
            _CLEAR_INVENTORY_PACKAGE_CACHES_ATTRIBUTE_NAME,
        ),
    }


def _build_editor_inventory_api_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten über die aufgelöste Inventar-Payload-API.
    """
    try:
        api = _resolve_editor_inventory_api()
    except Exception as exc:
        return {
            "moduleName": _EDITOR_INVENTORY_MODULE_NAME,
            "moduleAvailable": False,
            "error": _normalize_text(
                exc,
                "Inventar-API konnte nicht aufgelöst werden.",
            ),
        }

    metadata_getter = api.get("metadata_getter")
    package_metadata = None

    if callable(metadata_getter):
        try:
            package_metadata = _call_with_supported_kwargs(
                metadata_getter,
                {
                    "config_source": current_app.config,
                    "include_remote_health": _should_include_health_from_request(),
                },
            )
        except Exception as exc:
            package_metadata = {
                "error": _normalize_text(
                    exc,
                    "Inventar-Paket-Metadaten konnten nicht gelesen werden.",
                ),
            }

    health_getter = api.get("health_getter")
    package_health = None

    if callable(health_getter):
        try:
            package_health = _call_with_supported_kwargs(
                health_getter,
                {
                    "config_source": current_app.config,
                    "include_remote_health": _should_include_health_from_request(),
                },
            )
        except Exception as exc:
            package_health = {
                "error": _normalize_text(
                    exc,
                    "Inventar-Paket-Health konnte nicht gelesen werden.",
                ),
            }

    return {
        "moduleName": _EDITOR_INVENTORY_MODULE_NAME,
        "moduleAvailable": _coerce_bool(api.get("module_available"), False),
        "buildPayloadAvailable": callable(api.get("build_payload")),
        "buildFallbackPayloadAvailable": callable(api.get("build_fallback_payload")),
        "metadataGetterAvailable": callable(api.get("metadata_getter")),
        "healthGetterAvailable": callable(api.get("health_getter")),
        "cacheClearerAvailable": callable(api.get("cache_clearer")),
        "packageMetadata": package_metadata,
        "packageHealth": package_health,
    }


# -----------------------------------------------------------------------------
# Call-Helfer für flexible Payload-Builder
# -----------------------------------------------------------------------------

def _call_with_supported_kwargs(
    callback: Callable[..., Any],
    kwargs: Mapping[str, Any],
) -> Any:
    """
    Ruft eine Funktion mit den von ihr unterstützten Keyword-Argumenten auf.

    Warum:
    - Payload-Builder können während der Entwicklung leicht abweichende
      Signaturen haben.
    - Diese Route soll dadurch nicht unnötig fragil werden.
    - Wenn der Builder `**kwargs` akzeptiert, werden alle Argumente übergeben.
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

    for name, parameter in parameters.items():
        if parameter.kind in {
            inspect.Parameter.KEYWORD_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        } and name in kwargs_dict:
            supported_kwargs[name] = kwargs_dict[name]

    try:
        return callback(**supported_kwargs)
    except TypeError:
        return callback()


def _build_common_payload_builder_kwargs() -> dict[str, Any]:
    """
    Baut die gemeinsamen Argumente für Inventar-Payload-Builder.
    """
    return {
        "config_source": current_app.config,
        "request_args": _safe_request_args(),
        "request_method": _safe_request_method(),
        "request_path": _safe_request_path(),
        "request_id": _safe_request_id(),
        "static_url_builder": _build_static_url,
        "include_empty_slots": True,
        "route_path": INVENTORY_FULL_ROUTE_PATH,
        "generated_at_utc": _safe_utc_timestamp(),
    }


# -----------------------------------------------------------------------------
# Serialisierung / Response-Bau
# -----------------------------------------------------------------------------

def _to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """
    Wandelt typische Python-Objekte robust in JSON-kompatible Strukturen um.
    """
    if depth > 32:
        return _normalize_text(value, "<max-depth>")

    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if dataclasses.is_dataclass(value):
        try:
            return _to_json_compatible(dataclasses.asdict(value), depth=depth + 1)
        except Exception:
            return _normalize_text(value, None)

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

    return _normalize_text(value, None)


def _coerce_payload_dict(payload: Any) -> dict[str, Any]:
    """
    Erzwingt ein Dictionary als Payload.
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

    raise TypeError("Der Inventar-Payload-Builder muss ein Dictionary oder mapping-artiges Objekt liefern.")


def _json_dumps(payload: Any) -> str:
    """
    Serialisiert robust zu JSON.
    """
    json_payload = _to_json_compatible(payload)

    try:
        json_provider = getattr(current_app, "json", None)
        if json_provider is not None and hasattr(json_provider, "dumps"):
            return json_provider.dumps(json_payload)
    except Exception:
        pass

    try:
        return json.dumps(
            json_payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
    except Exception:
        return json.dumps(
            {
                "ok": False,
                "error": {
                    "reason": "json-serialization-error",
                    "message": "Inventar-Response konnte nicht serialisiert werden.",
                },
                "generatedAtUtc": _safe_utc_timestamp(),
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )


def _apply_common_json_headers(
    response: Response,
    *,
    status_code: int,
    fallback_reason: str | None = None,
    error_reason: str | None = None,
) -> Response:
    """
    Ergänzt Standardheader für JSON-Antworten.
    """
    response.status_code = int(status_code)
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["X-VECTOPLAN-Editor-Route"] = INVENTORY_FULL_ROUTE_PATH
    response.headers["X-VECTOPLAN-Editor-Inventory-Route"] = INVENTORY_ROUTE_PATH
    response.headers["X-VECTOPLAN-Editor-Inventory-Module"] = INVENTORY_BLUEPRINT_MODULE_NAME
    response.headers["X-VECTOPLAN-Editor-Inventory-Version"] = INVENTORY_ROUTE_MODULE_VERSION
    response.headers["X-VECTOPLAN-Editor-Inventory-Package"] = _EDITOR_INVENTORY_MODULE_NAME
    response.headers["X-VECTOPLAN-Editor-Inventory-Source"] = "library"
    response.headers["X-VECTOPLAN-Editor-Inventory-Debug-Blocks"] = "disabled"

    if fallback_reason:
        response.headers["X-VECTOPLAN-Editor-Inventory-Fallback"] = fallback_reason

    if error_reason:
        response.headers["X-VECTOPLAN-Editor-Inventory-Error"] = error_reason

    request_id = _safe_request_id()
    if request_id:
        response.headers["X-VECTOPLAN-Request-ID"] = request_id

    return response


def _build_json_response(
    payload: Any,
    *,
    status_code: int = HTTPStatus.OK,
    fallback_reason: str | None = None,
    error_reason: str | None = None,
) -> Response:
    """
    Baut eine robuste JSON-Response.
    """
    body = _json_dumps(payload)

    try:
        response = make_response(body, int(status_code))
    except Exception:
        response = Response(body, status=int(status_code))

    return _apply_common_json_headers(
        response,
        status_code=int(status_code),
        fallback_reason=fallback_reason,
        error_reason=error_reason,
    )


def _build_error_payload(
    *,
    reason: str,
    message: str,
    status_code: int,
    error: Exception | str | None = None,
    stage: str | None = None,
) -> dict[str, Any]:
    """
    Baut eine standardisierte JSON-Fehlerpayload ohne placebare Items.
    """
    normalized_reason = _coerce_text(reason, "inventory-error")
    normalized_message = _coerce_text(message, "Inventar konnte nicht geladen werden.")

    error_message = None
    if error is not None:
        error_message = _normalize_text(error)

    return {
        "ok": False,
        "kind": "editor-inventory-error",
        "schemaVersion": "editor-inventory.v1",
        "route": INVENTORY_FULL_ROUTE_PATH,
        "source": "error",
        "sourceDetail": "route-error",
        "statusCode": int(status_code),
        "generatedAtUtc": _safe_utc_timestamp(),
        "error": {
            "reason": normalized_reason,
            "message": normalized_message,
            "stage": _normalize_text(stage),
            "detail": error_message,
        },
        "inventory": {
            "enabled": True,
            "source": "error",
            "sourceDetail": "route-error",
            "hotbarSize": 9,
            "defaultSelectedSlot": 0,
            "selectedSlot": 0,
            "allowPlaceAction": False,
            "allowBreakAction": True,
            "items": [],
            "slots": [],
            "emptySlotCount": 0,
            "filledSlotCount": 0,
            "placeableSlotCount": 0,
        },
        "fallback": {
            "active": True,
            "reason": normalized_reason,
        },
        "capabilities": {
            "serverDriven": True,
            "supportsVplib": False,
            "allowsDebugGrassDirt": False,
            "supportsChunkDebugFallback": False,
        },
        "diagnostics": {
            "requestMethod": _safe_request_method(),
            "requestPath": _safe_request_path(),
            "requestArgs": _safe_request_args(),
            "requestId": _safe_request_id(),
            "inventoryApi": _build_editor_inventory_api_metadata(),
        },
    }


# -----------------------------------------------------------------------------
# Payload-Bau
# -----------------------------------------------------------------------------

def _build_inventory_payload() -> dict[str, Any]:
    """
    Baut den primären Inventar-Payload über `src.inventory`.

    Diese Funktion enthält bewusst keine Inventar-Item-Definitionen.
    """
    api = _resolve_editor_inventory_api()
    builder = api.get("build_payload")

    if not callable(builder):
        metadata = _build_editor_inventory_api_metadata()
        raise RuntimeError(
            "Die Funktion "
            f"`{_BUILD_INVENTORY_PAYLOAD_ATTRIBUTE_NAME}(...)` aus "
            f"`{_EDITOR_INVENTORY_MODULE_NAME}` ist nicht verfügbar. "
            f"Diagnose: {metadata!r}"
        )

    if _should_clear_caches_from_request():
        clear_inventory_route_caches()

    kwargs = _build_common_payload_builder_kwargs()

    try:
        payload = _call_with_supported_kwargs(builder, kwargs)
    except Exception as exc:
        raise RuntimeError("Der Inventar-Payload konnte nicht gebaut werden.") from exc

    return _coerce_payload_dict(payload)


def _try_build_fallback_inventory_payload(
    *,
    reason: str,
    source_error: Exception | str | None,
) -> dict[str, Any] | None:
    """
    Versucht einen Fallback-Payload über `src.inventory` zu bauen.

    Wichtig:
    - Wenn die Fallback-Funktion fehlt, wird None zurückgegeben.
    - Diese Route erfindet keine produktiven Inventaritems.
    - Der Fallback darf nicht placeable sein.
    """
    try:
        api = _resolve_editor_inventory_api()
    except Exception:
        return None

    builder = api.get("build_fallback_payload")
    if not callable(builder):
        return None

    kwargs = _build_common_payload_builder_kwargs()
    kwargs.update(
        {
            "reason": reason,
            "source_error": source_error,
            "source_error_message": _normalize_text(source_error),
        }
    )

    try:
        payload = _call_with_supported_kwargs(builder, kwargs)
        return _coerce_payload_dict(payload)
    except Exception as exc:
        _safe_log_warning(
            "Fallback-Inventar-Payload konnte nicht gebaut werden: %r",
            exc,
        )
        return None


def _payload_has_placeable_items(payload: Mapping[str, Any]) -> bool:
    """
    Prüft defensiv, ob der Payload placebare Slots enthält.
    """
    inventory = payload.get("inventory")
    if not isinstance(inventory, Mapping):
        return False

    try:
        if _coerce_bool(inventory.get("allowPlaceAction"), False):
            slots = inventory.get("slots")
            if isinstance(slots, Sequence) and not isinstance(slots, (str, bytes, bytearray)):
                return any(
                    isinstance(slot, Mapping) and _coerce_bool(slot.get("placeable"), False)
                    for slot in slots
                )
    except Exception:
        return False

    return False


def _payload_contains_forbidden_debug_items(payload: Mapping[str, Any]) -> bool:
    """
    Prüft, ob versehentlich alte Debug-Block-IDs im Inventory auftauchen.
    """
    try:
        text = str(_to_json_compatible(payload))
    except Exception:
        text = str(payload)

    return "debug_grass" in text or "debug_dirt" in text


def _build_inventory_response() -> Response:
    """
    Baut die vollständige Inventar-Response.

    Ablauf:
    1. Primären Payload-Builder aufrufen.
    2. Sicherheitsprüfung gegen debug_grass/debug_dirt.
    3. Bei Fehler optionalen Fallback-Payload versuchen.
    4. Falls auch das nicht geht, standardisierte Fehlerpayload liefern.
    """
    try:
        payload = _build_inventory_payload()

        if _payload_contains_forbidden_debug_items(payload):
            raise RuntimeError(
                "Inventory-Payload enthält verbotene Debug-Block-IDs "
                "`debug_grass` oder `debug_dirt`."
            )

        _safe_log_debug(
            "Inventar-Payload erfolgreich gebaut: route=%r package=%r hasPlaceable=%r",
            INVENTORY_FULL_ROUTE_PATH,
            _EDITOR_INVENTORY_MODULE_NAME,
            _payload_has_placeable_items(payload),
        )

        return _build_json_response(
            payload,
            status_code=HTTPStatus.OK,
        )

    except Exception as exc:
        _safe_log_exception(
            "Inventar-Payload für Route %r konnte nicht gebaut werden: %r",
            INVENTORY_FULL_ROUTE_PATH,
            exc,
        )

        fallback_payload = _try_build_fallback_inventory_payload(
            reason="primary-payload-error",
            source_error=exc,
        )

        if fallback_payload is not None:
            return _build_json_response(
                fallback_payload,
                status_code=HTTPStatus.OK,
                fallback_reason="primary-payload-error",
            )

        api_metadata = _build_editor_inventory_api_metadata()
        module_available = _coerce_bool(api_metadata.get("moduleAvailable"), False)
        builder_available = _coerce_bool(api_metadata.get("buildPayloadAvailable"), False)

        if not module_available:
            status_code = HTTPStatus.SERVICE_UNAVAILABLE
            reason = "inventory-package-missing"
            message = f"Das Paket `{_EDITOR_INVENTORY_MODULE_NAME}` ist noch nicht verfügbar."
        elif not builder_available:
            status_code = HTTPStatus.SERVICE_UNAVAILABLE
            reason = "inventory-payload-builder-missing"
            message = (
                "Die Funktion "
                f"`{_BUILD_INVENTORY_PAYLOAD_ATTRIBUTE_NAME}` ist noch nicht verfügbar."
            )
        else:
            status_code = HTTPStatus.INTERNAL_SERVER_ERROR
            reason = "inventory-payload-build-error"
            message = "Der Inventar-Payload konnte nicht gebaut werden."

        error_payload = _build_error_payload(
            reason=reason,
            message=message,
            status_code=int(status_code),
            error=exc,
            stage="build-inventory-response",
        )

        return _build_json_response(
            error_payload,
            status_code=int(status_code),
            error_reason=reason,
        )


# -----------------------------------------------------------------------------
# Öffentliche Routen
# -----------------------------------------------------------------------------

@inventory_bp.route(INVENTORY_ROUTE_PATH, methods=["GET", "HEAD"])
def editor_inventory_index() -> Response:
    """
    Liefert das Editor-Inventar als JSON.

    Externer Pfad nach Registrierung in `routes.__init__`:

        GET /editor/api/inventory

    Ziel:
    - Backend entscheidet Inventarinhalt.
    - Frontend rendert Hotbar/Inventory anhand dieser JSON-Daten.
    - Primärquelle ist `vectoplan-library`.
    - Nur VPLIB-/Library-Items dürfen placeable sein.
    - Wenn Library nicht verfügbar ist, liefert die Route einen leeren
      Fallback ohne placebare Items.
    """
    _safe_log_debug(
        "Inventar-Route aufgerufen: method=%r path=%r args=%r",
        _safe_request_method(),
        _safe_request_path(),
        _safe_request_args(),
    )

    return _build_inventory_response()


@inventory_bp.route(f"{INVENTORY_ROUTE_PATH}/select-slot", methods=["POST", "PATCH"])
def editor_inventory_select_slot() -> Response:
    """Persist a zero-based editor selection in vectoplan-library."""
    try:
        from src.inventory.user_inventory import persist_editor_user_inventory_selection

        body = request.get_json(silent=True)
        payload = dict(body) if isinstance(body, Mapping) else {}
        payload.update(_safe_request_args())
        slot_index = payload.get(
            "slotIndex",
            payload.get("slot_index", payload.get("selectedSlot", 0)),
        )
        result = persist_editor_user_inventory_selection(
            slot_index,
            config_source=current_app.config,
            request_payload=payload,
        )
        return _build_json_response(result, status_code=HTTPStatus.OK)
    except Exception as exc:
        return _build_json_response(
            _build_error_payload(
                reason="user-inventory-selection-failed",
                message="Die User-Inventar-Auswahl konnte nicht gespeichert werden.",
                status_code=int(HTTPStatus.BAD_GATEWAY),
                error=exc,
                stage="persist-user-inventory-selection",
            ),
            status_code=HTTPStatus.BAD_GATEWAY,
            error_reason="user-inventory-selection-failed",
        )


@inventory_bp.route(f"{INVENTORY_ROUTE_PATH}/_metadata", methods=["GET", "HEAD"])
def editor_inventory_metadata() -> Response:
    """
    Liefert Diagnosemetadaten der Inventory-Route und Payload-Schicht.

    Externer Pfad:

        GET /editor/api/inventory/_metadata
    """
    payload = get_inventory_route_module_metadata()
    return _build_json_response(payload, status_code=HTTPStatus.OK)


@inventory_bp.route(f"{INVENTORY_ROUTE_PATH}/_health", methods=["GET", "HEAD"])
def editor_inventory_health() -> Response:
    """
    Liefert eine kompakte Health-Diagnose der Inventory-Route.

    Externer Pfad:

        GET /editor/api/inventory/_health
    """
    api = _resolve_editor_inventory_api()
    health_getter = api.get("health_getter")

    health_payload = None
    if callable(health_getter):
        try:
            health_payload = _call_with_supported_kwargs(
                health_getter,
                {
                    "config_source": current_app.config,
                    "include_remote_health": _should_include_health_from_request(),
                },
            )
        except Exception as exc:
            health_payload = {
                "ok": False,
                "status": "health-error",
                "error": _to_json_compatible(exc),
            }

    payload = {
        "ok": bool(api.get("module_available")) and callable(api.get("build_payload")),
        "status": "ok" if bool(api.get("module_available")) and callable(api.get("build_payload")) else "degraded",
        "generatedAtUtc": _safe_utc_timestamp(),
        "route": INVENTORY_FULL_ROUTE_PATH,
        "module": INVENTORY_BLUEPRINT_MODULE_NAME,
        "version": INVENTORY_ROUTE_MODULE_VERSION,
        "inventoryApi": _build_editor_inventory_api_metadata(),
        "packageHealth": health_payload,
    }

    return _build_json_response(payload, status_code=HTTPStatus.OK)


# -----------------------------------------------------------------------------
# Diagnose / Cache-Clear
# -----------------------------------------------------------------------------

def get_inventory_route_module_metadata() -> dict[str, Any]:
    """
    Liefert Diagnosemetadaten dieses Route-Moduls.
    """
    return {
        "moduleName": INVENTORY_BLUEPRINT_MODULE_NAME,
        "moduleVersion": INVENTORY_ROUTE_MODULE_VERSION,
        "blueprintName": INVENTORY_BLUEPRINT_NAME,
        "routePath": INVENTORY_ROUTE_PATH,
        "apiUrlPrefix": INVENTORY_API_URL_PREFIX,
        "fullRoutePath": INVENTORY_FULL_ROUTE_PATH,
        "metadataRoutePath": f"{INVENTORY_FULL_ROUTE_PATH}/_metadata",
        "healthRoutePath": f"{INVENTORY_FULL_ROUTE_PATH}/_health",
        "payloadPackageName": _EDITOR_INVENTORY_MODULE_NAME,
        "payloadBuilderAttributeName": _BUILD_INVENTORY_PAYLOAD_ATTRIBUTE_NAME,
        "fallbackPayloadBuilderAttributeName": _BUILD_FALLBACK_INVENTORY_PAYLOAD_ATTRIBUTE_NAME,
        "rules": {
            "browserUsesThisRoute": True,
            "browserShouldNotCallVectoplanLibraryDirectly": True,
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtAllowed": False,
            "fallbackAllowsPlace": False,
        },
        "inventoryApi": _build_editor_inventory_api_metadata(),
    }


def clear_inventory_route_caches() -> None:
    """
    Löscht interne Modul-Caches.

    Nützlich für:
    - Tests
    - Entwicklungs-Reloads
    - schrittweises Ergänzen von `src.inventory`
    """
    try:
        api = _resolve_editor_inventory_api()
        cache_clearer = api.get("cache_clearer")
        if callable(cache_clearer):
            cache_clearer()
    except Exception:
        pass

    cache_clearers = (
        _candidate_missing_names,
        _load_editor_inventory_module,
        _resolve_editor_inventory_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue


__all__ = [
    "INVENTORY_BLUEPRINT_NAME",
    "INVENTORY_BLUEPRINT_MODULE_NAME",
    "INVENTORY_ROUTE_MODULE_VERSION",
    "INVENTORY_ROUTE_PATH",
    "INVENTORY_API_URL_PREFIX",
    "INVENTORY_FULL_ROUTE_PATH",
    "inventory_bp",
    "editor_inventory_index",
    "editor_inventory_metadata",
    "editor_inventory_health",
    "get_inventory_route_module_metadata",
    "clear_inventory_route_caches",
]