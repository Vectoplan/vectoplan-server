#!/usr/bin/env sh
set -eu

SERVICE_NAME="vectoplan-energie"
PORT="${PORT:-${VECTOPLAN_ENERGIE_PORT:-5000}}"
WORKERS="${GUNICORN_WORKERS:-2}"
THREADS="${GUNICORN_THREADS:-4}"

required_files="app.py wsgi.py config.py routes/__init__.py templates/energie/index.html static/energie/css/main.css static/energie/js/main.js"
for required_file in $required_files; do
  if [ ! -f "$required_file" ]; then
    echo "[$SERVICE_NAME] missing required file: $required_file" >&2
    exit 1
  fi
done

python - <<'PY'
from app import create_app

app = create_app()
client = app.test_client()
response = client.get("/health/ready")
if response.status_code != 200:
    raise SystemExit(f"prestart readiness failed: {response.status_code} {response.get_data(as_text=True)}")
print("[vectoplan-energie] prestart readiness passed")
PY

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "[$SERVICE_NAME] starting on 0.0.0.0:$PORT"
exec gunicorn \
  --workers "$WORKERS" \
  --worker-class gthread \
  --threads "$THREADS" \
  --bind "0.0.0.0:$PORT" \
  --access-logfile - \
  --error-logfile - \
  "wsgi:app"
