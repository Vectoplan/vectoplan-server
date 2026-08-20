#!/bin/sh
set -eu

python -c "from app import create_app; app = create_app(); required = {'/statik', '/health/ready', '/api/v1/statik/status', '/api/v1/statik/analysis-preview'}; routes = {rule.rule for rule in app.url_map.iter_rules()}; missing = required - routes; assert not missing, f'missing routes: {sorted(missing)}'"

if [ "$#" -eq 0 ]; then
  set -- gunicorn --bind "0.0.0.0:${VECTOPLAN_STATIK_PORT:-5000}" --workers 2 --threads 4 --timeout 60 wsgi:app
fi

exec "$@"
