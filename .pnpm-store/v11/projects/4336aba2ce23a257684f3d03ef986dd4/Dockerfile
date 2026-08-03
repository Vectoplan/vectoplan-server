# services/vectoplan-editor/Dockerfile

# -----------------------------------------------------------------------------
# VECTOPLAN Editor - Multi-Stage Dockerfile
# -----------------------------------------------------------------------------
# Ziel dieser Version:
# - NICHT mehr das alte Frontend unter `frontend/` bauen
# - neues TypeScript-Frontend unter `src/frontend/` bauen
# - Vite-Output nach `static/editor/` schreiben lassen
# - Vite-Manifest `static/editor/manifest.json` prüfen
# - keine feste Abhängigkeit mehr auf `static/editor/js/main.js`
# - keine Dockerfile-Heredocs verwenden
# - alte statische Fallback-Artefakte im Runtime-Image nicht übernehmen
# - Python/Flask/Gunicorn als schlanke Runtime betreiben
# - Non-Root-Betrieb beibehalten
#
# Erwartete neue Frontend-Struktur:
#   services/vectoplan-editor/src/frontend/package.json
#   services/vectoplan-editor/src/frontend/tsconfig.json
#   services/vectoplan-editor/src/frontend/vite.config.ts
#   services/vectoplan-editor/src/frontend/main.ts
#
# Erwartete Build-Ausgabe:
#   services/vectoplan-editor/static/editor/manifest.json
#   services/vectoplan-editor/static/editor/assets/...
# -----------------------------------------------------------------------------


# =============================================================================
# Stage 1 - Frontend Builder
# =============================================================================

FROM node:22-bookworm-slim AS frontend-builder


# -----------------------------------------------------------------------------
# Build-Argumente / Environment
# -----------------------------------------------------------------------------

ARG APP_HOME=/opt/vectoplan/services/vectoplan-editor

ENV FRONTEND_DIR=${APP_HOME}/src/frontend \
    STATIC_EDITOR_DIR=${APP_HOME}/static/editor \
    NODE_ENV=development \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    npm_config_loglevel=warn


# -----------------------------------------------------------------------------
# Arbeitsverzeichnis
# -----------------------------------------------------------------------------

WORKDIR ${APP_HOME}


# -----------------------------------------------------------------------------
# Nur neue Frontend-Manifeste zuerst kopieren
# -----------------------------------------------------------------------------
# Wichtig:
# - absichtlich `src/frontend/...`
# - absichtlich NICHT `frontend/...`
# -----------------------------------------------------------------------------

COPY src/frontend/package*.json ./src/frontend/
COPY src/frontend/tsconfig.json ./src/frontend/
COPY src/frontend/vite.config.ts ./src/frontend/


# -----------------------------------------------------------------------------
# Frontend-Abhängigkeiten installieren
# -----------------------------------------------------------------------------

WORKDIR ${FRONTEND_DIR}

RUN set -eux; \
    node --version; \
    npm --version; \
    test -f package.json; \
    if [ -f package-lock.json ]; then \
        npm ci --include=dev; \
    else \
        npm install --include=dev; \
    fi; \
    npm cache clean --force || true


# -----------------------------------------------------------------------------
# Neuen Frontend-Quellcode kopieren
# -----------------------------------------------------------------------------

WORKDIR ${APP_HOME}

COPY src/frontend ./src/frontend


# -----------------------------------------------------------------------------
# Frontend-Build ausführen
# -----------------------------------------------------------------------------
# Wichtig:
# - kein Heredoc
# - bevorzugt `build:only`, damit Docker nicht von einem noch fehlenden
#   verify-manifest.mjs abhängt
# - Manifest wird direkt per `node -e` geprüft
# -----------------------------------------------------------------------------

WORKDIR ${FRONTEND_DIR}

RUN set -eux; \
    rm -rf "${STATIC_EDITOR_DIR}"; \
    mkdir -p "${STATIC_EDITOR_DIR}"; \
    if node -e 'const scripts=require("./package.json").scripts||{}; process.exit(scripts.typecheck ? 0 : 1);'; then \
        npm run typecheck; \
    fi; \
    if node -e 'const scripts=require("./package.json").scripts||{}; process.exit(scripts["build:only"] ? 0 : 1);'; then \
        npm run build:only; \
    else \
        npm run build; \
    fi; \
    test -f "${STATIC_EDITOR_DIR}/manifest.json"; \
    STATIC_EDITOR_DIR="${STATIC_EDITOR_DIR}" node -e 'const fs=require("fs"); const path=require("path"); const staticDir=process.env.STATIC_EDITOR_DIR || "/opt/vectoplan/services/vectoplan-editor/static/editor"; const manifestPath=path.join(staticDir,"manifest.json"); const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8")); const entries=Object.entries(manifest).filter(([,value]) => value && value.isEntry); if (!entries.length) { throw new Error("Vite manifest enthält keinen Entry mit isEntry=true."); } const jsFiles=entries.map(([,value]) => value && value.file).filter((file) => typeof file === "string" && file.endsWith(".js")); if (!jsFiles.length) { throw new Error("Vite manifest enthält keinen Entry-JS."); } const missing=jsFiles.filter((file) => !fs.existsSync(path.join(staticDir,file))); if (missing.length) { throw new Error("Manifest verweist auf fehlende JS-Datei: " + missing.join(", ")); } console.log("Vite manifest OK:", jsFiles.join(", "));'


# =============================================================================
# Stage 2 - Python Runtime
# =============================================================================

FROM python:3.12-slim AS runtime


# -----------------------------------------------------------------------------
# Build-Argumente
# -----------------------------------------------------------------------------

ARG APP_HOME=/opt/vectoplan/services/vectoplan-editor
ARG APP_USER=vectoplan
ARG APP_UID=10001
ARG APP_GID=10001


# -----------------------------------------------------------------------------
# Metadaten
# -----------------------------------------------------------------------------

LABEL org.opencontainers.image.title="vectoplan-editor" \
      org.opencontainers.image.description="VECTOPLAN Editor Flask/Python service" \
      org.opencontainers.image.vendor="VECTOPLAN"


# -----------------------------------------------------------------------------
# Laufzeit-Umgebung
# -----------------------------------------------------------------------------

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=${APP_HOME} \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VECTOPLAN_EDITOR_HOST=0.0.0.0 \
    VECTOPLAN_EDITOR_PORT=5000 \
    VECTOPLAN_EDITOR_CONFIG=production \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED=true \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL=http://vectoplan-chunk:5000 \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL=/editor/api/chunk \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID=dev-project \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID=world_spawn \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_SOURCE_KIND=vectoplan-chunk \
    VECTOPLAN_EDITOR_CHUNK_SERVICE_MODE=editor-proxy \
    VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED=false \
    VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED=false \
    VECTOPLAN_EDITOR_USE_VITE_MANIFEST=true \
    VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX=/static/editor \
    VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME=manifest.json \
    VECTOPLAN_EDITOR_VITE_ENTRYPOINT=main.ts \
    GUNICORN_WORKERS=1 \
    GUNICORN_THREADS=100 \
    GUNICORN_TIMEOUT=120 \
    GUNICORN_KEEPALIVE=5 \
    GUNICORN_LOG_LEVEL=info \
    GUNICORN_ACCESSLOG=- \
    GUNICORN_ERRORLOG=-


# -----------------------------------------------------------------------------
# Arbeitsverzeichnis
# -----------------------------------------------------------------------------

WORKDIR ${APP_HOME}


# -----------------------------------------------------------------------------
# Systembenutzer anlegen
# -----------------------------------------------------------------------------

RUN set -eux; \
    if ! getent group "${APP_USER}" > /dev/null 2>&1; then \
        addgroup --system --gid "${APP_GID}" "${APP_USER}"; \
    fi; \
    if ! id -u "${APP_USER}" > /dev/null 2>&1; then \
        adduser \
            --system \
            --uid "${APP_UID}" \
            --ingroup "${APP_USER}" \
            --home "${APP_HOME}" \
            --shell /usr/sbin/nologin \
            "${APP_USER}"; \
    fi; \
    mkdir -p "${APP_HOME}"; \
    chown -R "${APP_USER}:${APP_USER}" "${APP_HOME}"


# -----------------------------------------------------------------------------
# Python-Abhängigkeiten zuerst kopieren
# -----------------------------------------------------------------------------

COPY requirements.txt ./


# -----------------------------------------------------------------------------
# Python-Abhängigkeiten installieren
# -----------------------------------------------------------------------------

RUN set -eux; \
    python -m pip install --upgrade pip setuptools wheel; \
    python -m pip install --requirement requirements.txt; \
    python -m pip check


# -----------------------------------------------------------------------------
# Anwendungscode kopieren
# -----------------------------------------------------------------------------

COPY . .


# -----------------------------------------------------------------------------
# Alte Editor-Assets entfernen
# -----------------------------------------------------------------------------

RUN set -eux; \
    rm -rf "${APP_HOME}/static/editor"; \
    mkdir -p "${APP_HOME}/static/editor"; \
    rm -rf "${APP_HOME}/src/frontend/node_modules" || true; \
    rm -rf "${APP_HOME}/src/frontend/.vite" || true; \
    rm -rf "${APP_HOME}/src/frontend/.cache" || true


# -----------------------------------------------------------------------------
# Gebaute neue Frontend-Artefakte übernehmen
# -----------------------------------------------------------------------------

COPY --from=frontend-builder /opt/vectoplan/services/vectoplan-editor/static/editor ./static/editor


# -----------------------------------------------------------------------------
# Dateirechte und Build-Artefakt-Prüfung
# -----------------------------------------------------------------------------
# Wichtig:
# - kein Heredoc
# - Manifest-Prüfung erfolgt per Python-One-Liner
# -----------------------------------------------------------------------------

RUN set -eux; \
    if [ -f "./entrypoint.sh" ]; then \
        chmod +x ./entrypoint.sh; \
    fi; \
    find "${APP_HOME}" -type d -name "__pycache__" -prune -exec rm -rf {} + || true; \
    test -f "${APP_HOME}/static/editor/manifest.json"; \
    python -c "import json,sys; from pathlib import Path; p=Path('/opt/vectoplan/services/vectoplan-editor/static/editor/manifest.json'); m=json.loads(p.read_text(encoding='utf-8')); entries=[(k,v) for k,v in m.items() if isinstance(v,dict) and v.get('isEntry')]; js=[v.get('file') for _,v in entries if isinstance(v.get('file'),str) and v.get('file').endswith('.js')]; missing=[f for f in js if not (p.parent / f).exists()]; sys.exit('Vite manifest enthält keinen Entry mit isEntry=true.') if not entries else None; sys.exit('Vite manifest enthält keinen Entry-JS.') if not js else None; sys.exit('Manifest verweist auf fehlende JS-Datei: '+', '.join(missing)) if missing else None; print('Editor Vite assets OK:', ', '.join(js))"; \
    chown -R "${APP_USER}:${APP_USER}" "${APP_HOME}"


# -----------------------------------------------------------------------------
# Nicht als root laufen
# -----------------------------------------------------------------------------

USER ${APP_USER}


# -----------------------------------------------------------------------------
# Exponierter Port
# -----------------------------------------------------------------------------

EXPOSE 5000


# -----------------------------------------------------------------------------
# Stop-Signal
# -----------------------------------------------------------------------------

STOPSIGNAL SIGTERM


# -----------------------------------------------------------------------------
# Healthcheck
# -----------------------------------------------------------------------------

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,sys,urllib.request; port=os.getenv('VECTOPLAN_EDITOR_PORT','5000'); url='http://127.0.0.1:%s/editor' % port; resp=urllib.request.urlopen(url, timeout=3); sys.exit(0 if 200 <= getattr(resp,'status',200) < 400 else 1)" || exit 1


# -----------------------------------------------------------------------------
# Standardstart
# -----------------------------------------------------------------------------

CMD ["/bin/sh", "-c", "if [ -x ./entrypoint.sh ]; then exec ./entrypoint.sh; else exec gunicorn --bind ${VECTOPLAN_EDITOR_HOST:-0.0.0.0}:${VECTOPLAN_EDITOR_PORT:-5000} --workers ${GUNICORN_WORKERS:-1} --threads ${GUNICORN_THREADS:-100} --timeout ${GUNICORN_TIMEOUT:-120} --keep-alive ${GUNICORN_KEEPALIVE:-5} --log-level ${GUNICORN_LOG_LEVEL:-info} --access-logfile ${GUNICORN_ACCESSLOG:--} --error-logfile ${GUNICORN_ERRORLOG:--} wsgi:app; fi"]