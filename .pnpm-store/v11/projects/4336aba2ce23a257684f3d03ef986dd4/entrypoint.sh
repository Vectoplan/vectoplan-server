#!/bin/sh

set -eu
( set -o pipefail ) >/dev/null 2>&1 && set -o pipefail || true

APP_NAME="vectoplan-editor"
APP_DISPLAY_NAME="VECTOPLAN Editor"

DEFAULT_APP_HOME="/opt/vectoplan/services/vectoplan-editor"
DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT="5000"
DEFAULT_CONFIG="production"
DEFAULT_RUN_MODE="gunicorn"

DEFAULT_GUNICORN_APP="wsgi:app"
DEFAULT_GUNICORN_WORKERS="1"
DEFAULT_GUNICORN_THREADS="100"
DEFAULT_GUNICORN_TIMEOUT="120"
DEFAULT_GUNICORN_KEEPALIVE="5"
DEFAULT_GUNICORN_LOG_LEVEL="info"
DEFAULT_GUNICORN_ACCESSLOG="-"
DEFAULT_GUNICORN_ERRORLOG="-"

DEFAULT_FRONTEND_BUILD_REQUIRED="true"
DEFAULT_FRONTEND_STRICT_CHECKS="true"
DEFAULT_FRONTEND_SOURCE_CHECKS="false"

DEFAULT_STATIC_EDITOR_DIR="./static/editor"
DEFAULT_STATIC_MANIFEST_NAME="manifest.json"
DEFAULT_FRONTEND_MANIFEST_PATH="./static/editor/manifest.json"
DEFAULT_FRONTEND_SOURCE_ROOT="./src/frontend"
DEFAULT_LEGACY_FRONTEND_SOURCE_ROOT="./frontend/src"
LEGACY_FRONTEND_ENTRY="./static/editor/js/main.js"

timestamp_utc() {
  if command -v date >/dev/null 2>&1; then
    date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || printf '%s' "1970-01-01T00:00:00Z"
  else
    printf '%s' "1970-01-01T00:00:00Z"
  fi
}

log_info() {
  printf '%s [INFO]  [%s] %s\n' "$(timestamp_utc)" "$APP_NAME" "$*"
}

log_warn() {
  printf '%s [WARN]  [%s] %s\n' "$(timestamp_utc)" "$APP_NAME" "$*" >&2
}

log_error() {
  printf '%s [ERROR] [%s] %s\n' "$(timestamp_utc)" "$APP_NAME" "$*" >&2
}

die() {
  log_error "$*"
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

is_true() {
  case "${1:-}" in
    1|true|TRUE|True|yes|YES|Yes|y|Y|on|ON|On|enabled|ENABLED|Enabled)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

normalize_log_level() {
  case "${1:-}" in
    debug|DEBUG|Debug) printf '%s' "debug" ;;
    info|INFO|Info) printf '%s' "info" ;;
    warning|WARNING|Warning|warn|WARN|Warn) printf '%s' "warning" ;;
    error|ERROR|Error) printf '%s' "error" ;;
    critical|CRITICAL|Critical) printf '%s' "critical" ;;
    *) printf '%s' "$DEFAULT_GUNICORN_LOG_LEVEL" ;;
  esac
}

require_file() {
  file_path="$1"
  file_label="$2"

  if [ ! -f "$file_path" ]; then
    die "Erforderliche Datei fehlt: ${file_label} (${file_path})"
  fi
}

warn_if_missing_file() {
  file_path="$1"
  file_label="$2"

  if [ ! -f "$file_path" ]; then
    log_warn "Optionale Datei fehlt: ${file_label} (${file_path})"
  fi
}

require_dir() {
  dir_path="$1"
  dir_label="$2"

  if [ ! -d "$dir_path" ]; then
    die "Erforderliches Verzeichnis fehlt: ${dir_label} (${dir_path})"
  fi
}

warn_if_missing_dir() {
  dir_path="$1"
  dir_label="$2"

  if [ ! -d "$dir_path" ]; then
    log_warn "Optionales Verzeichnis fehlt: ${dir_label} (${dir_path})"
  fi
}

ensure_uint() {
  value="$1"
  var_name="$2"
  fallback="$3"

  case "$value" in
    ''|*[!0-9]*)
      log_warn "UngÃ¼ltiger numerischer Wert fÃ¼r ${var_name}: '${value}'. Fallback auf ${fallback}."
      printf '%s' "$fallback"
      ;;
    *)
      printf '%s' "$value"
      ;;
  esac
}

ensure_port() {
  raw_port="$1"
  validated_port="$(ensure_uint "$raw_port" "VECTOPLAN_EDITOR_PORT" "$DEFAULT_PORT")"

  if [ "$validated_port" -lt 1 ] || [ "$validated_port" -gt 65535 ]; then
    log_warn "Port auÃŸerhalb des gÃ¼ltigen Bereichs: '${raw_port}'. Fallback auf ${DEFAULT_PORT}."
    printf '%s' "$DEFAULT_PORT"
    return
  fi

  printf '%s' "$validated_port"
}

safe_pwd() {
  pwd 2>/dev/null || printf '%s' "."
}

normalize_run_mode() {
  case "${1:-}" in
    gunicorn|python|wsgi)
      printf '%s' "$1"
      ;;
    *)
      printf '%s' "$DEFAULT_RUN_MODE"
      ;;
  esac
}

strip_trailing_slash() {
  value="${1:-}"

  while [ "${value%/}" != "$value" ] && [ "$value" != "/" ]; do
    value="${value%/}"
  done

  printf '%s' "$value"
}

join_path() {
  left="$(strip_trailing_slash "$1")"
  right="${2#/}"

  if [ -z "$left" ]; then
    printf '%s' "$right"
    return
  fi

  printf '%s/%s' "$left" "$right"
}

normalize_frontend_manifest_path() {
  static_dir="$1"
  manifest_name="$2"
  explicit_manifest="${VECTOPLAN_EDITOR_FRONTEND_MANIFEST_PATH:-}"
  legacy_expected="${VECTOPLAN_EDITOR_FRONTEND_EXPECTED_ENTRY:-}"
  default_manifest="$(join_path "$static_dir" "$manifest_name")"

  if [ -n "$explicit_manifest" ]; then
    printf '%s' "$explicit_manifest"
    return
  fi

  case "$legacy_expected" in
    ""|"$LEGACY_FRONTEND_ENTRY"|./static/editor/js/main.js|static/editor/js/main.js|*/static/editor/js/main.js|*/js/main.js)
      if [ -n "$legacy_expected" ]; then
        log_warn "Legacy VECTOPLAN_EDITOR_FRONTEND_EXPECTED_ENTRY erkannt und auf Vite Manifest umgebogen: ${legacy_expected} -> ${default_manifest}"
      fi
      printf '%s' "$default_manifest"
      return
      ;;
    *.json|*/manifest.json)
      printf '%s' "$legacy_expected"
      return
      ;;
    *.js|*.css)
      log_warn "Legacy Frontend-Expected-Entry ist kein Manifest und wird ignoriert: ${legacy_expected} -> ${default_manifest}"
      printf '%s' "$default_manifest"
      return
      ;;
    *)
      printf '%s' "$legacy_expected"
      return
      ;;
  esac
}

print_file_info_if_exists() {
  file_path="$1"
  file_label="$2"

  if [ -f "$file_path" ]; then
    file_size="unbekannt"
    if command_exists wc; then
      file_size="$(wc -c < "$file_path" 2>/dev/null || printf '%s' "unbekannt")"
    fi
    log_info "${file_label} vorhanden: ${file_path} (bytes=${file_size})"
  else
    log_warn "${file_label} nicht vorhanden: ${file_path}"
  fi
}

APP_HOME="${APP_HOME:-$DEFAULT_APP_HOME}"
VECTOPLAN_EDITOR_HOST="${VECTOPLAN_EDITOR_HOST:-$DEFAULT_HOST}"
VECTOPLAN_EDITOR_PORT="${VECTOPLAN_EDITOR_PORT:-$DEFAULT_PORT}"
VECTOPLAN_EDITOR_CONFIG="${VECTOPLAN_EDITOR_CONFIG:-$DEFAULT_CONFIG}"
VECTOPLAN_EDITOR_RUN_MODE="${VECTOPLAN_EDITOR_RUN_MODE:-$DEFAULT_RUN_MODE}"

VECTOPLAN_EDITOR_PRESTART_CHECK="${VECTOPLAN_EDITOR_PRESTART_CHECK:-true}"
VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS="${VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS:-false}"
VECTOPLAN_EDITOR_PRINT_STARTUP_SUMMARY="${VECTOPLAN_EDITOR_PRINT_STARTUP_SUMMARY:-true}"

VECTOPLAN_EDITOR_FRONTEND_BUILD_REQUIRED="${VECTOPLAN_EDITOR_FRONTEND_BUILD_REQUIRED:-$DEFAULT_FRONTEND_BUILD_REQUIRED}"
VECTOPLAN_EDITOR_FRONTEND_STRICT_CHECKS="${VECTOPLAN_EDITOR_FRONTEND_STRICT_CHECKS:-$DEFAULT_FRONTEND_STRICT_CHECKS}"
VECTOPLAN_EDITOR_FRONTEND_SOURCE_CHECKS="${VECTOPLAN_EDITOR_FRONTEND_SOURCE_CHECKS:-$DEFAULT_FRONTEND_SOURCE_CHECKS}"

VECTOPLAN_EDITOR_STATIC_EDITOR_DIR="${VECTOPLAN_EDITOR_STATIC_EDITOR_DIR:-$DEFAULT_STATIC_EDITOR_DIR}"
VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME="${VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME:-$DEFAULT_STATIC_MANIFEST_NAME}"
VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT="${VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT:-$DEFAULT_FRONTEND_SOURCE_ROOT}"

GUNICORN_APP="${GUNICORN_APP:-$DEFAULT_GUNICORN_APP}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-$DEFAULT_GUNICORN_WORKERS}"
GUNICORN_THREADS="${GUNICORN_THREADS:-$DEFAULT_GUNICORN_THREADS}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-$DEFAULT_GUNICORN_TIMEOUT}"
GUNICORN_KEEPALIVE="${GUNICORN_KEEPALIVE:-$DEFAULT_GUNICORN_KEEPALIVE}"
GUNICORN_LOG_LEVEL="${GUNICORN_LOG_LEVEL:-$DEFAULT_GUNICORN_LOG_LEVEL}"
GUNICORN_ACCESSLOG="${GUNICORN_ACCESSLOG:-$DEFAULT_GUNICORN_ACCESSLOG}"
GUNICORN_ERRORLOG="${GUNICORN_ERRORLOG:-$DEFAULT_GUNICORN_ERRORLOG}"

VECTOPLAN_EDITOR_PORT="$(ensure_port "$VECTOPLAN_EDITOR_PORT")"
VECTOPLAN_EDITOR_RUN_MODE="$(normalize_run_mode "$VECTOPLAN_EDITOR_RUN_MODE")"

GUNICORN_WORKERS="$(ensure_uint "$GUNICORN_WORKERS" "GUNICORN_WORKERS" "$DEFAULT_GUNICORN_WORKERS")"
GUNICORN_THREADS="$(ensure_uint "$GUNICORN_THREADS" "GUNICORN_THREADS" "$DEFAULT_GUNICORN_THREADS")"
GUNICORN_TIMEOUT="$(ensure_uint "$GUNICORN_TIMEOUT" "GUNICORN_TIMEOUT" "$DEFAULT_GUNICORN_TIMEOUT")"
GUNICORN_KEEPALIVE="$(ensure_uint "$GUNICORN_KEEPALIVE" "GUNICORN_KEEPALIVE" "$DEFAULT_GUNICORN_KEEPALIVE")"
GUNICORN_LOG_LEVEL="$(normalize_log_level "$GUNICORN_LOG_LEVEL")"

if [ "$GUNICORN_WORKERS" != "1" ]; then
  log_warn "Realtime-Presence benötigt aktuell einen gemeinsamen Prozess; GUNICORN_WORKERS=${GUNICORN_WORKERS} wird auf 1 gesetzt."
  GUNICORN_WORKERS="1"
fi

if [ "$GUNICORN_THREADS" -lt "32" ]; then
  log_warn "Realtime-Presence benötigt freie HTTP-Threads; GUNICORN_THREADS=${GUNICORN_THREADS} wird auf 100 gesetzt."
  GUNICORN_THREADS="100"
fi

VECTOPLAN_EDITOR_STATIC_EDITOR_DIR="$(strip_trailing_slash "$VECTOPLAN_EDITOR_STATIC_EDITOR_DIR")"
VECTOPLAN_EDITOR_FRONTEND_EXPECTED_ENTRY="$(normalize_frontend_manifest_path "$VECTOPLAN_EDITOR_STATIC_EDITOR_DIR" "$VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME")"

if [ ! -d "$APP_HOME" ]; then
  die "APP_HOME existiert nicht: ${APP_HOME}"
fi

cd "$APP_HOME" || die "Wechsel in APP_HOME fehlgeschlagen: ${APP_HOME}"

command_exists python || die "'python' ist im Container nicht verfÃ¼gbar."
command_exists gunicorn || log_warn "'gunicorn' ist nicht im PATH verfÃ¼gbar. Direkter Gunicorn-Start wÃ¼rde scheitern."

log_info "Arbeitsverzeichnis: $(safe_pwd)"
log_info "Python: $(python --version 2>/dev/null || printf '%s' 'unbekannt')"

if command_exists node; then
  log_info "Node: $(node --version 2>/dev/null || printf '%s' 'unbekannt')"
fi

require_file "./app.py" "Flask-App-Factory"
require_file "./wsgi.py" "WSGI-Einstiegspunkt"
require_file "./config.py" "Service-Konfiguration"
require_file "./routes/__init__.py" "Blueprint-Registrierung"
require_file "./routes/editor.py" "Editor-Route"

require_dir "./routes" "Routenverzeichnis"
require_dir "./templates" "Template-Verzeichnis"
require_dir "./static" "Static-Verzeichnis"

if is_true "$VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS"; then
  require_file "./templates/editor/index.html" "Editor-Template"
else
  warn_if_missing_file "./templates/editor/index.html" "Editor-Template"
fi

if is_true "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_CHECKS"; then
  require_dir "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT" "neuer Frontend-Source-Root"
  require_file "$(join_path "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT" "package.json")" "Frontend package.json"
  require_file "$(join_path "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT" "tsconfig.json")" "Frontend tsconfig.json"
  require_file "$(join_path "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT" "vite.config.ts")" "Frontend vite.config.ts"
  require_file "$(join_path "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT" "main.ts")" "Frontend main.ts"
else
  warn_if_missing_dir "$VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT" "neuer Frontend-Source-Root"
fi

if [ -d "$DEFAULT_LEGACY_FRONTEND_SOURCE_ROOT" ]; then
  log_warn "Legacy-Frontend-Source wurde gefunden, wird aber nicht als Runtime-Wahrheit geprÃ¼ft: ${DEFAULT_LEGACY_FRONTEND_SOURCE_ROOT}"
fi

run_vite_manifest_check() {
  manifest_path="$1"
  static_dir="$2"
  strict="$3"

  export VECTOPLAN_EDITOR_MANIFEST_PATH="$manifest_path"
  export VECTOPLAN_EDITOR_STATIC_DIR="$static_dir"
  export VECTOPLAN_EDITOR_MANIFEST_STRICT="$strict"

  python <<'PY'
import json
import os
import sys
from pathlib import Path

manifest_path = Path(os.environ.get("VECTOPLAN_EDITOR_MANIFEST_PATH", "./static/editor/manifest.json"))
static_dir = Path(os.environ.get("VECTOPLAN_EDITOR_STATIC_DIR", "./static/editor"))
strict = os.environ.get("VECTOPLAN_EDITOR_MANIFEST_STRICT", "true").lower() in {"1", "true", "yes", "on", "enabled"}

def fail(message: str) -> None:
    print(f"[vectoplan-editor] Frontend-Manifest-Check fehlgeschlagen: {message}", file=sys.stderr)
    if strict:
        raise SystemExit(1)

def warn(message: str) -> None:
    print(f"[vectoplan-editor] Frontend-Manifest-Check Warnung: {message}", file=sys.stderr)

if not manifest_path.exists():
    fail(f"Manifest fehlt: {manifest_path}")
    raise SystemExit(0)

try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception as exc:
    fail(f"Manifest konnte nicht gelesen werden: {exc!r}")
    raise SystemExit(0)

if not isinstance(manifest, dict):
    fail("Manifest ist kein JSON-Objekt.")
    raise SystemExit(0)

entries = [
    (key, value)
    for key, value in manifest.items()
    if isinstance(value, dict) and value.get("isEntry") is True
]

if not entries:
    fallback_entries = [
        (key, value)
        for key, value in manifest.items()
        if isinstance(value, dict) and isinstance(value.get("file"), str) and value.get("file", "").endswith(".js")
    ]
    if fallback_entries:
        warn("Manifest enthÃ¤lt keinen isEntry=true Eintrag, aber JS-Dateien wurden gefunden.")
        entries = fallback_entries
    else:
        fail("Manifest enthÃ¤lt keinen Entry-JS.")
        raise SystemExit(0)

missing_files = []
entry_files = []
css_files = []

for _key, value in entries:
    file_name = value.get("file")
    if isinstance(file_name, str) and file_name.strip():
        entry_files.append(file_name)
        if not (static_dir / file_name).exists():
            missing_files.append(file_name)

    css_value = value.get("css")
    if isinstance(css_value, list):
        for css_file in css_value:
            if isinstance(css_file, str) and css_file.strip():
                css_files.append(css_file)
                if not (static_dir / css_file).exists():
                    missing_files.append(css_file)

if not entry_files:
    fail("Manifest-Entry enthÃ¤lt keine JS-Datei.")
    raise SystemExit(0)

if missing_files:
    fail("Manifest verweist auf fehlende Dateien: " + ", ".join(missing_files))
    raise SystemExit(0)

print("[vectoplan-editor] Frontend-Manifest-Check erfolgreich.")
print("[vectoplan-editor] Manifest: " + str(manifest_path))
print("[vectoplan-editor] Entry JS: " + ", ".join(entry_files))
print("[vectoplan-editor] Entry CSS: " + (", ".join(css_files) if css_files else "keine separate CSS-Datei im Manifest"))
PY
}

run_frontend_artifact_checks() {
  manifest_path="$VECTOPLAN_EDITOR_FRONTEND_EXPECTED_ENTRY"
  static_dir="$VECTOPLAN_EDITOR_STATIC_EDITOR_DIR"

  if ! is_true "$VECTOPLAN_EDITOR_FRONTEND_BUILD_REQUIRED"; then
    log_warn "Frontend-Build-ArtefaktprÃ¼fung wurde per ENV deaktiviert."
    return
  fi

  if is_true "$VECTOPLAN_EDITOR_FRONTEND_STRICT_CHECKS"; then
    require_dir "$static_dir" "Editor Static Build-Verzeichnis"
    require_file "$manifest_path" "Vite Manifest"
    run_vite_manifest_check "$manifest_path" "$static_dir" "true"
  else
    warn_if_missing_dir "$static_dir" "Editor Static Build-Verzeichnis"
    warn_if_missing_file "$manifest_path" "Vite Manifest"
    if [ -f "$manifest_path" ]; then
      run_vite_manifest_check "$manifest_path" "$static_dir" "false"
    fi
  fi

  print_file_info_if_exists "$manifest_path" "Vite Manifest"

  if [ -f "$LEGACY_FRONTEND_ENTRY" ]; then
    log_warn "Legacy-Build-Einstieg ist noch vorhanden, wird aber nicht mehr benÃ¶tigt: ${LEGACY_FRONTEND_ENTRY}"
  else
    log_info "Legacy-Build-Einstieg nicht vorhanden und nicht erforderlich: ${LEGACY_FRONTEND_ENTRY}"
  fi

  if [ -f "./static/editor/css/editor.css" ]; then
    log_info "Legacy-CSS-Datei vorhanden: ./static/editor/css/editor.css"
  else
    log_info "Legacy-CSS-Datei nicht vorhanden und nicht erforderlich: ./static/editor/css/editor.css"
  fi

  if [ -d "./static/editor/assets" ]; then
    log_info "Vite Asset-Verzeichnis vorhanden: ./static/editor/assets"
  else
    log_warn "Vite Asset-Verzeichnis fehlt: ./static/editor/assets"
  fi
}

run_frontend_artifact_checks

run_prestart_check() {
  log_info "Starte Python-Bootstrap-Check."

  python <<'PY'
import os
import sys

try:
    from app import create_app

    config_name = os.getenv("VECTOPLAN_EDITOR_CONFIG", "production")
    app = create_app(config_name)

    route_rules = []
    try:
        route_rules = sorted(str(rule) for rule in app.url_map.iter_rules())
    except Exception:
        route_rules = []

    print("[vectoplan-editor] Prestart-Check erfolgreich.")
    print(f"[vectoplan-editor] App Name: {app.config.get('APP_NAME', 'vectoplan-editor')}")
    print(f"[vectoplan-editor] Config: {config_name}")
    print(f"[vectoplan-editor] Routes: {', '.join(route_rules) if route_rules else 'keine ermittelbar'}")

except Exception as exc:
    print(f"[vectoplan-editor] Prestart-Check fehlgeschlagen: {exc!r}", file=sys.stderr)
    raise
PY
}

if is_true "$VECTOPLAN_EDITOR_PRESTART_CHECK"; then
  run_prestart_check || die "Python-Bootstrap-Check ist fehlgeschlagen."
else
  log_warn "Python-Bootstrap-Check wurde per ENV Ã¼bersprungen."
fi

print_startup_summary() {
  log_info "Startmodus: ${VECTOPLAN_EDITOR_RUN_MODE}"
  log_info "Config: ${VECTOPLAN_EDITOR_CONFIG}"
  log_info "Bind: ${VECTOPLAN_EDITOR_HOST}:${VECTOPLAN_EDITOR_PORT}"
  log_info "Gunicorn App: ${GUNICORN_APP}"
  log_info "Gunicorn Workers: ${GUNICORN_WORKERS}"
  log_info "Gunicorn Threads: ${GUNICORN_THREADS}"
  log_info "Gunicorn Timeout: ${GUNICORN_TIMEOUT}"
  log_info "Gunicorn Keepalive: ${GUNICORN_KEEPALIVE}"
  log_info "Gunicorn Log-Level: ${GUNICORN_LOG_LEVEL}"
  log_info "Frontend Build Required: ${VECTOPLAN_EDITOR_FRONTEND_BUILD_REQUIRED}"
  log_info "Frontend Strict Checks: ${VECTOPLAN_EDITOR_FRONTEND_STRICT_CHECKS}"
  log_info "Frontend Source Checks: ${VECTOPLAN_EDITOR_FRONTEND_SOURCE_CHECKS}"
  log_info "Frontend Source Root: ${VECTOPLAN_EDITOR_FRONTEND_SOURCE_ROOT}"
  log_info "Static Editor Dir: ${VECTOPLAN_EDITOR_STATIC_EDITOR_DIR}"
  log_info "Vite Manifest: ${VECTOPLAN_EDITOR_FRONTEND_EXPECTED_ENTRY}"
}

if is_true "$VECTOPLAN_EDITOR_PRINT_STARTUP_SUMMARY"; then
  print_startup_summary
fi

if [ "$#" -gt 0 ]; then
  log_info "Benutzerdefiniertes Kommando erkannt. Ãœbergabe an exec: $*"
  exec "$@"
fi

start_gunicorn() {
  command_exists gunicorn || die "'gunicorn' ist nicht installiert oder nicht im PATH."

  log_info "Starte ${APP_DISPLAY_NAME} Ã¼ber Gunicorn."

  exec gunicorn \
    --bind "${VECTOPLAN_EDITOR_HOST}:${VECTOPLAN_EDITOR_PORT}" \
    --workers "${GUNICORN_WORKERS}" \
    --threads "${GUNICORN_THREADS}" \
    --timeout "${GUNICORN_TIMEOUT}" \
    --keep-alive "${GUNICORN_KEEPALIVE}" \
    --log-level "${GUNICORN_LOG_LEVEL}" \
    --access-logfile "${GUNICORN_ACCESSLOG}" \
    --error-logfile "${GUNICORN_ERRORLOG}" \
    "${GUNICORN_APP}"
}

start_python_wsgi() {
  log_warn "Starte ${APP_DISPLAY_NAME} im Python-Direktmodus. Dies ist primÃ¤r fÃ¼r Entwicklung gedacht."
  exec python ./wsgi.py
}

case "$VECTOPLAN_EDITOR_RUN_MODE" in
  gunicorn)
    start_gunicorn
    ;;
  python|wsgi)
    start_python_wsgi
    ;;
  *)
    die "Unbekannter VECTOPLAN_EDITOR_RUN_MODE: ${VECTOPLAN_EDITOR_RUN_MODE}. Erlaubt sind: gunicorn, python, wsgi."
    ;;
esac