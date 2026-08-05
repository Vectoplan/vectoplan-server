# services/vectoplan-editor/src/bootstrap/assets.py
from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

try:
    from flask import current_app, has_app_context
except Exception:  # pragma: no cover - erlaubt Import ohne Flask-Kontext
    current_app = None

    def has_app_context() -> bool:
        return False


LOGGER = logging.getLogger(__name__)


DEFAULT_STATIC_EDITOR_URL_PREFIX = "/static/editor"
DEFAULT_STATIC_EDITOR_MANIFEST_NAME = "manifest.json"
DEFAULT_VITE_ENTRYPOINT = "main.ts"


# =============================================================================
# Datenmodelle
# =============================================================================

@dataclass(frozen=True)
class EditorAssetFile:
    """
    Einzelnes vom Editor-Template ladbares Asset.
    """

    url: str
    kind: str
    source: str = "manifest"
    file: str | None = None
    is_entry: bool = False
    is_import: bool = False
    integrity: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "kind": self.kind,
            "source": self.source,
            "file": self.file,
            "isEntry": self.is_entry,
            "isImport": self.is_import,
            "integrity": self.integrity,
        }


@dataclass(frozen=True)
class EditorAssets:
    """
    Ergebnis des Asset-Resolvers für die Editor-Shell.

    `js` und `css` sind die wichtigsten Felder für Jinja.
    """

    ok: bool
    source: str
    manifest_path: str
    manifest_url: str
    entrypoint: str
    js: tuple[str, ...] = ()
    css: tuple[str, ...] = ()
    files: tuple[EditorAssetFile, ...] = ()
    preload: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()
    manifest_found: bool = False
    manifest_loaded: bool = False
    fallback_used: bool = False

    @property
    def has_js(self) -> bool:
        return bool(self.js)

    @property
    def has_css(self) -> bool:
        return bool(self.css)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "source": self.source,
            "manifestPath": self.manifest_path,
            "manifestUrl": self.manifest_url,
            "entrypoint": self.entrypoint,
            "js": list(self.js),
            "css": list(self.css),
            "preload": list(self.preload),
            "files": [asset.to_dict() for asset in self.files],
            "warnings": list(self.warnings),
            "errors": list(self.errors),
            "manifestFound": self.manifest_found,
            "manifestLoaded": self.manifest_loaded,
            "fallbackUsed": self.fallback_used,
        }

    def to_template_context(self) -> dict[str, Any]:
        """
        Kontextform für Jinja-Templates.

        Dadurch können Templates sowohl einfache Listen als auch Metadaten nutzen.
        """
        return {
            "ok": self.ok,
            "source": self.source,
            "js": list(self.js),
            "css": list(self.css),
            "preload": list(self.preload),
            "files": [asset.to_dict() for asset in self.files],
            "warnings": list(self.warnings),
            "errors": list(self.errors),
            "manifest_found": self.manifest_found,
            "manifest_loaded": self.manifest_loaded,
            "fallback_used": self.fallback_used,
            "manifest_path": self.manifest_path,
            "manifest_url": self.manifest_url,
            "entrypoint": self.entrypoint,
        }


@dataclass(frozen=True)
class EditorAssetSettings:
    """
    Konfiguration für den Asset-Resolver.

    Diese Settings werden primär aus current_app.config gelesen, können aber
    auch ohne Flask-Kontext explizit oder per ENV genutzt werden.
    """

    static_editor_root: Path
    static_editor_url_prefix: str = DEFAULT_STATIC_EDITOR_URL_PREFIX
    manifest_name: str = DEFAULT_STATIC_EDITOR_MANIFEST_NAME
    entrypoint: str = DEFAULT_VITE_ENTRYPOINT
    use_manifest: bool = True
    strict: bool = False
    fallback_js: tuple[str, ...] = ()
    fallback_css: tuple[str, ...] = ()

    @property
    def manifest_path(self) -> Path:
        return self.static_editor_root / self.manifest_name

    @property
    def manifest_url(self) -> str:
        return _join_url_path(self.static_editor_url_prefix, self.manifest_name)


# =============================================================================
# Öffentliche API
# =============================================================================

def get_editor_assets(
    app_config: Mapping[str, Any] | None = None,
    *,
    force_refresh: bool = False,
) -> EditorAssets:
    """
    Liefert die gebauten Editor-Assets für die HTML-Shell.

    Typischer Aufruf in `routes/editor.py`:

        editor_assets = get_editor_assets()
        return render_template(..., editor_assets=editor_assets.to_template_context())

    Verhalten:
    - liest `static/editor/manifest.json`
    - findet den Entry `main.ts`
    - sammelt JS/CSS aus Entry und Imports
    - gibt URLs relativ zu `/static/editor` zurück
    - fällt bei fehlendem Manifest kontrolliert auf Fallbacks zurück
    """

    if force_refresh:
        clear_asset_caches()

    settings = get_editor_asset_settings(app_config=app_config)
    return resolve_editor_assets(settings)


def get_editor_asset_settings(
    app_config: Mapping[str, Any] | None = None,
) -> EditorAssetSettings:
    """
    Baut Asset-Settings robust aus:
    1. explizitem app_config
    2. Flask current_app.config
    3. Environment
    4. Defaults
    """

    merged_config: dict[str, Any] = {}

    if has_app_context() and current_app is not None:
        try:
            merged_config.update(dict(current_app.config))
        except Exception:
            LOGGER.exception("Could not read current_app.config while building editor asset settings.")

    if app_config:
        try:
            merged_config.update(dict(app_config))
        except Exception:
            LOGGER.exception("Could not merge explicit app_config while building editor asset settings.")

    service_root = _resolve_service_root()

    static_editor_root = _coerce_path(
        _first_config_value(
            merged_config,
            keys=(
                "STATIC_EDITOR_ROOT",
                "EDITOR_STATIC_EDITOR_ROOT",
                "VECTOPLAN_EDITOR_STATIC_EDITOR_ROOT",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_STATIC_EDITOR_ROOT",
                "EDITOR_STATIC_EDITOR_ROOT",
            ),
            default=service_root / "static" / "editor",
        ),
        default=service_root / "static" / "editor",
    )

    static_editor_url_prefix = _normalize_route_path(
        str(
            _first_config_value(
                merged_config,
                keys=(
                    "STATIC_EDITOR_URL_PREFIX",
                    "EDITOR_STATIC_EDITOR_URL_PREFIX",
                    "VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX",
                ),
                env_keys=(
                    "VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX",
                    "EDITOR_STATIC_EDITOR_URL_PREFIX",
                ),
                default=DEFAULT_STATIC_EDITOR_URL_PREFIX,
            )
        ),
        DEFAULT_STATIC_EDITOR_URL_PREFIX,
    )

    manifest_name = _coerce_non_empty_string(
        _first_config_value(
            merged_config,
            keys=(
                "STATIC_EDITOR_MANIFEST_NAME",
                "EDITOR_STATIC_EDITOR_MANIFEST_NAME",
                "VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME",
                "EDITOR_STATIC_EDITOR_MANIFEST_NAME",
            ),
            default=DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
        ),
        DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
    )

    entrypoint = _coerce_non_empty_string(
        _first_config_value(
            merged_config,
            keys=(
                "VITE_ENTRYPOINT",
                "EDITOR_VITE_ENTRYPOINT",
                "VECTOPLAN_EDITOR_VITE_ENTRYPOINT",
                "VECTOPLAN_EDITOR_FRONTEND_ENTRYPOINT",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_VITE_ENTRYPOINT",
                "VECTOPLAN_EDITOR_FRONTEND_ENTRYPOINT",
                "EDITOR_VITE_ENTRYPOINT",
            ),
            default=DEFAULT_VITE_ENTRYPOINT,
        ),
        DEFAULT_VITE_ENTRYPOINT,
    )

    use_manifest = _coerce_bool(
        _first_config_value(
            merged_config,
            keys=(
                "USE_VITE_MANIFEST",
                "EDITOR_USE_VITE_MANIFEST",
                "VECTOPLAN_EDITOR_USE_VITE_MANIFEST",
                "VECTOPLAN_EDITOR_USE_MANIFEST_ASSETS",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_USE_VITE_MANIFEST",
                "VECTOPLAN_EDITOR_USE_MANIFEST_ASSETS",
                "EDITOR_USE_VITE_MANIFEST",
            ),
            default=True,
        ),
        True,
    )

    strict = _coerce_bool(
        _first_config_value(
            merged_config,
            keys=(
                "STRICT_ASSET_CHECKS",
                "EDITOR_STRICT_ASSET_CHECKS",
                "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS",
                "VECTOPLAN_EDITOR_FAIL_ON_MISSING_ASSETS",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS",
                "VECTOPLAN_EDITOR_FAIL_ON_MISSING_ASSETS",
                "EDITOR_STRICT_ASSET_CHECKS",
            ),
            default=False,
        ),
        False,
    )

    fallback_js = _coerce_string_tuple(
        _first_config_value(
            merged_config,
            keys=(
                "FALLBACK_STATIC_JS",
                "EDITOR_FALLBACK_STATIC_JS",
                "VECTOPLAN_EDITOR_FALLBACK_STATIC_JS",
                "VECTOPLAN_EDITOR_MAIN_JS_FILE",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_FALLBACK_STATIC_JS",
                "VECTOPLAN_EDITOR_MAIN_JS_FILE",
                "EDITOR_FALLBACK_STATIC_JS",
            ),
            default="",
        )
    )

    fallback_css = _coerce_string_tuple(
        _first_config_value(
            merged_config,
            keys=(
                "FALLBACK_STATIC_CSS",
                "EDITOR_FALLBACK_STATIC_CSS",
                "VECTOPLAN_EDITOR_FALLBACK_STATIC_CSS",
                "VECTOPLAN_EDITOR_MAIN_CSS_FILE",
            ),
            env_keys=(
                "VECTOPLAN_EDITOR_FALLBACK_STATIC_CSS",
                "VECTOPLAN_EDITOR_MAIN_CSS_FILE",
                "EDITOR_FALLBACK_STATIC_CSS",
            ),
            default="",
        )
    )

    return EditorAssetSettings(
        static_editor_root=static_editor_root,
        static_editor_url_prefix=static_editor_url_prefix,
        manifest_name=manifest_name,
        entrypoint=entrypoint,
        use_manifest=use_manifest,
        strict=strict,
        fallback_js=fallback_js,
        fallback_css=fallback_css,
    )


def resolve_editor_assets(settings: EditorAssetSettings) -> EditorAssets:
    """
    Löst die Asset-Dateien für die gegebene Settings-Struktur auf.
    """

    warnings: list[str] = []
    errors: list[str] = []

    manifest_path = settings.manifest_path
    manifest_url = settings.manifest_url

    if not settings.use_manifest:
        warnings.append("Vite manifest usage is disabled by configuration.")
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-manifest-disabled",
        )

    try:
        manifest_state = _stat_manifest(manifest_path)
    except Exception as exc:
        message = f"Could not stat Vite manifest: {exc}"
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=False,
                manifest_loaded=False,
                source="error",
            )

        warnings.append(message)
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-manifest-stat-failed",
        )

    if manifest_state is None:
        message = f"Vite manifest not found: {manifest_path}"
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=False,
                manifest_loaded=False,
                source="error",
            )

        warnings.append(message)
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-manifest-missing",
        )

    try:
        manifest = _read_manifest_cached(
            str(manifest_path),
            manifest_state["mtimeNs"],
            manifest_state["size"],
        )
    except Exception as exc:
        message = f"Could not read Vite manifest {manifest_path}: {exc}"
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=True,
                manifest_loaded=False,
                source="error",
            )

        warnings.append(message)
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-manifest-read-failed",
            manifest_found=True,
        )

    if not isinstance(manifest, Mapping):
        message = "Vite manifest did not contain a JSON object."
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=True,
                manifest_loaded=False,
                source="error",
            )

        warnings.append(message)
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-manifest-invalid",
            manifest_found=True,
        )

    entry_key = _find_manifest_entry_key(manifest, settings.entrypoint)

    if entry_key is None:
        message = (
            f"Vite manifest entrypoint {settings.entrypoint!r} not found. "
            f"Available entries: {', '.join(sorted(str(key) for key in manifest.keys()))}"
        )
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=True,
                manifest_loaded=True,
                source="error",
            )

        warnings.append(message)
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-entry-missing",
            manifest_found=True,
            manifest_loaded=True,
        )

    try:
        files = _collect_manifest_assets(
            manifest=manifest,
            entry_key=entry_key,
            static_editor_url_prefix=settings.static_editor_url_prefix,
        )
    except Exception as exc:
        message = f"Could not resolve assets from Vite manifest: {exc}"
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=True,
                manifest_loaded=True,
                source="error",
            )

        warnings.append(message)
        return _fallback_assets(
            settings,
            warnings=warnings,
            errors=errors,
            source="fallback-manifest-resolve-failed",
            manifest_found=True,
            manifest_loaded=True,
        )

    js = tuple(asset.url for asset in files if asset.kind == "js")
    css = tuple(asset.url for asset in files if asset.kind == "css")
    preload = tuple(asset.url for asset in files if asset.is_import and asset.kind == "js")

    if not js:
        message = f"Vite manifest entry {entry_key!r} did not resolve to a JS file."
        if settings.strict:
            errors.append(message)
            return _empty_assets(
                settings,
                warnings=warnings,
                errors=errors,
                manifest_found=True,
                manifest_loaded=True,
                source="error",
            )
        warnings.append(message)

    return EditorAssets(
        ok=bool(js) and not errors,
        source="manifest",
        manifest_path=str(manifest_path),
        manifest_url=manifest_url,
        entrypoint=settings.entrypoint,
        js=js,
        css=css,
        files=tuple(files),
        preload=preload,
        warnings=tuple(warnings),
        errors=tuple(errors),
        manifest_found=True,
        manifest_loaded=True,
        fallback_used=False,
    )


def build_editor_assets_template_context(
    app_config: Mapping[str, Any] | None = None,
    *,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """
    Komfortfunktion für `routes/editor.py`.

    Rückgabe ist direkt als `editor_assets` im Template nutzbar.
    """

    return get_editor_assets(app_config=app_config, force_refresh=force_refresh).to_template_context()


def clear_asset_caches() -> None:
    """
    Löscht interne Caches.

    Nützlich für:
    - Tests
    - Development-Reloads
    - nach neuem Vite-Build ohne Prozessneustart
    """
    for candidate in (
        _read_manifest_cached,
        _normalize_asset_file,
        _join_url_path_cached,
    ):
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            pass


# =============================================================================
# Manifest-Auflösung
# =============================================================================

def _stat_manifest(path: Path) -> dict[str, int] | None:
    try:
        if not path.exists() or not path.is_file():
            return None

        stat_result = path.stat()
        return {
            "mtimeNs": int(getattr(stat_result, "st_mtime_ns", int(stat_result.st_mtime * 1_000_000_000))),
            "size": int(stat_result.st_size),
        }
    except Exception:
        raise


@lru_cache(maxsize=16)
def _read_manifest_cached(path_text: str, mtime_ns: int, size: int) -> dict[str, Any]:
    """
    Liest das Vite-Manifest gecacht.

    `mtime_ns` und `size` sind Teil des Cache-Keys, damit ein neuer Build den
    Cache automatisch invalidiert.
    """
    del mtime_ns, size

    path = Path(path_text)

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, dict):
        raise ValueError("manifest root is not an object")

    return data


def _find_manifest_entry_key(
    manifest: Mapping[str, Any],
    entrypoint: str,
) -> str | None:
    """
    Sucht den passenden Entry im Vite-Manifest.

    Unterstützt typische Varianten:
    - main.ts
    - src/main.ts
    - /src/main.ts
    - Eintrag mit isEntry=true
    - Eintrag dessen file auf main*.js zeigt
    """
    normalized_entrypoint = _normalize_manifest_key(entrypoint)

    candidates = (
        normalized_entrypoint,
        normalized_entrypoint.lstrip("/"),
        f"src/{normalized_entrypoint.lstrip('/')}",
        f"/src/{normalized_entrypoint.lstrip('/')}",
    )

    for candidate in candidates:
        if candidate in manifest:
            return candidate

    # Vite speichert bei rollupOptions.input manchmal den Pfad relativ zum root.
    basename = Path(normalized_entrypoint).name

    for key, value in manifest.items():
        if not isinstance(value, Mapping):
            continue

        if key == basename or key.endswith(f"/{basename}"):
            return str(key)

    entry_keys: list[str] = []

    for key, value in manifest.items():
        if isinstance(value, Mapping) and value.get("isEntry") is True:
            entry_keys.append(str(key))

    if len(entry_keys) == 1:
        return entry_keys[0]

    for key, value in manifest.items():
        if not isinstance(value, Mapping):
            continue

        file_value = value.get("file")
        if isinstance(file_value, str) and file_value.endswith(".js") and "main" in Path(file_value).name:
            return str(key)

    return None


def _collect_manifest_assets(
    *,
    manifest: Mapping[str, Any],
    entry_key: str,
    static_editor_url_prefix: str,
) -> list[EditorAssetFile]:
    visited: set[str] = set()
    ordered: list[EditorAssetFile] = []

    def visit(key: str, *, is_entry: bool, is_import: bool) -> None:
        if key in visited:
            return

        visited.add(key)

        entry = manifest.get(key)
        if not isinstance(entry, Mapping):
            return

        # Imports zuerst, damit gemeinsame Chunks vor Entry-Script geladen werden.
        imports = entry.get("imports")
        if isinstance(imports, list):
            for imported_key in imports:
                if isinstance(imported_key, str):
                    visit(imported_key, is_entry=False, is_import=True)

        css_values = entry.get("css")
        if isinstance(css_values, list):
            for css_file in css_values:
                if isinstance(css_file, str):
                    ordered.append(
                        EditorAssetFile(
                            url=_asset_url(static_editor_url_prefix, css_file),
                            kind="css",
                            source="manifest",
                            file=css_file,
                            is_entry=is_entry,
                            is_import=is_import,
                        )
                    )

        file_value = entry.get("file")
        if isinstance(file_value, str) and file_value:
            kind = "css" if file_value.endswith(".css") else "js" if file_value.endswith(".js") else "asset"
            if kind in {"js", "css"}:
                ordered.append(
                    EditorAssetFile(
                        url=_asset_url(static_editor_url_prefix, file_value),
                        kind=kind,
                        source="manifest",
                        file=file_value,
                        is_entry=is_entry,
                        is_import=is_import,
                    )
                )

        dynamic_imports = entry.get("dynamicImports")
        if isinstance(dynamic_imports, list):
            for imported_key in dynamic_imports:
                if isinstance(imported_key, str):
                    visit(imported_key, is_entry=False, is_import=True)

    visit(entry_key, is_entry=True, is_import=False)

    return _dedupe_assets(ordered)


def _dedupe_assets(files: list[EditorAssetFile]) -> list[EditorAssetFile]:
    seen: set[tuple[str, str]] = set()
    result: list[EditorAssetFile] = []

    for asset in files:
        key = (asset.kind, asset.url)
        if key in seen:
            continue
        seen.add(key)
        result.append(asset)

    return result


# =============================================================================
# Fallbacks / Empty Responses
# =============================================================================

def _fallback_assets(
    settings: EditorAssetSettings,
    *,
    warnings: list[str],
    errors: list[str],
    source: str,
    manifest_found: bool = False,
    manifest_loaded: bool = False,
) -> EditorAssets:
    files: list[EditorAssetFile] = []

    for css_file in settings.fallback_css:
        files.append(
            EditorAssetFile(
                url=_asset_url(settings.static_editor_url_prefix, css_file),
                kind="css",
                source="fallback",
                file=css_file,
            )
        )

    for js_file in settings.fallback_js:
        files.append(
            EditorAssetFile(
                url=_asset_url(settings.static_editor_url_prefix, js_file),
                kind="js",
                source="fallback",
                file=js_file,
                is_entry=True,
            )
        )

    js = tuple(asset.url for asset in files if asset.kind == "js")
    css = tuple(asset.url for asset in files if asset.kind == "css")

    if not js:
        warnings.append(
            "No fallback JS configured. Editor template can render, but no frontend bundle will be loaded."
        )

    return EditorAssets(
        ok=bool(js) and not errors,
        source=source,
        manifest_path=str(settings.manifest_path),
        manifest_url=settings.manifest_url,
        entrypoint=settings.entrypoint,
        js=js,
        css=css,
        files=tuple(files),
        preload=(),
        warnings=tuple(warnings),
        errors=tuple(errors),
        manifest_found=manifest_found,
        manifest_loaded=manifest_loaded,
        fallback_used=True,
    )


def _empty_assets(
    settings: EditorAssetSettings,
    *,
    warnings: list[str],
    errors: list[str],
    manifest_found: bool,
    manifest_loaded: bool,
    source: str,
) -> EditorAssets:
    return EditorAssets(
        ok=False,
        source=source,
        manifest_path=str(settings.manifest_path),
        manifest_url=settings.manifest_url,
        entrypoint=settings.entrypoint,
        js=(),
        css=(),
        files=(),
        preload=(),
        warnings=tuple(warnings),
        errors=tuple(errors),
        manifest_found=manifest_found,
        manifest_loaded=manifest_loaded,
        fallback_used=False,
    )


# =============================================================================
# Config-/Pfad-Helfer
# =============================================================================

def _resolve_service_root() -> Path:
    try:
        # assets.py liegt in services/vectoplan-editor/src/bootstrap/assets.py
        return Path(__file__).resolve().parents[2]
    except Exception:
        return Path(".").resolve()


def _first_config_value(
    config: Mapping[str, Any],
    *,
    keys: tuple[str, ...],
    env_keys: tuple[str, ...],
    default: Any,
) -> Any:
    for key in keys:
        try:
            value = config.get(key)
        except Exception:
            value = None

        if value not in {None, ""}:
            return value

    for key in env_keys:
        try:
            value = os.environ.get(key)
        except Exception:
            value = None

        if value not in {None, ""}:
            return value

    return default


def _coerce_path(value: Any, *, default: Path) -> Path:
    if isinstance(value, Path):
        return value

    try:
        text = str(value).strip()
    except Exception:
        return default

    if not text:
        return default

    try:
        return Path(text)
    except Exception:
        return default


def _coerce_non_empty_string(value: Any, default: str) -> str:
    try:
        normalized = str(value).strip()
    except Exception:
        return default

    return normalized or default


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    try:
        normalized = str(value).strip().lower()
    except Exception:
        return default

    if normalized in {"1", "true", "t", "yes", "y", "on", "enabled"}:
        return True

    if normalized in {"0", "false", "f", "no", "n", "off", "disabled"}:
        return False

    return default


def _coerce_string_tuple(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()

    if isinstance(value, (list, tuple, set)):
        raw_values = value
    else:
        try:
            raw_values = str(value).split(",")
        except Exception:
            return ()

    result: list[str] = []

    for item in raw_values:
        try:
            text = str(item).strip()
        except Exception:
            continue

        if text:
            result.append(text)

    return tuple(result)


def _normalize_route_path(value: str, default: str) -> str:
    try:
        normalized = str(value or "").strip()
    except Exception:
        normalized = ""

    if not normalized:
        normalized = default

    if not normalized.startswith("/"):
        normalized = f"/{normalized}"

    if len(normalized) > 1:
        normalized = normalized.rstrip("/")

    return normalized


def _normalize_manifest_key(value: str) -> str:
    try:
        return str(value).strip().replace("\\", "/")
    except Exception:
        return DEFAULT_VITE_ENTRYPOINT


@lru_cache(maxsize=512)
def _join_url_path_cached(prefix: str, file_path: str) -> str:
    clean_prefix = _normalize_route_path(prefix, DEFAULT_STATIC_EDITOR_URL_PREFIX)
    clean_file = str(file_path or "").strip().replace("\\", "/").lstrip("/")

    if not clean_file:
        return clean_prefix

    return f"{clean_prefix}/{clean_file}"


def _join_url_path(prefix: str, file_path: str) -> str:
    return _join_url_path_cached(prefix, file_path)


@lru_cache(maxsize=2048)
def _normalize_asset_file(file_path: str) -> str:
    return str(file_path or "").strip().replace("\\", "/").lstrip("/")


def _asset_url(static_editor_url_prefix: str, file_path: str) -> str:
    return _join_url_path(
        static_editor_url_prefix,
        _normalize_asset_file(file_path),
    )


__all__ = [
    "EditorAssetFile",
    "EditorAssets",
    "EditorAssetSettings",
    "get_editor_assets",
    "get_editor_asset_settings",
    "resolve_editor_assets",
    "build_editor_assets_template_context",
    "clear_asset_caches",
]