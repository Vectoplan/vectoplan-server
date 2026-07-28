#!/usr/bin/env sh
set -eu

: "${VECTOPLAN_CAD_HOST:=0.0.0.0}"
: "${VECTOPLAN_CAD_PORT:=5000}"
: "${VECTOPLAN_CAD_WORKERS:=2}"
: "${VECTOPLAN_CAD_THREADS:=2}"
: "${VECTOPLAN_CAD_TIMEOUT:=120}"

python -m py_compile app.py wsgi.py config.py extensions.py

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec gunicorn \
  --bind "${VECTOPLAN_CAD_HOST}:${VECTOPLAN_CAD_PORT}" \
  --workers "${VECTOPLAN_CAD_WORKERS}" \
  --threads "${VECTOPLAN_CAD_THREADS}" \
  --timeout "${VECTOPLAN_CAD_TIMEOUT}" \
  wsgi:app
