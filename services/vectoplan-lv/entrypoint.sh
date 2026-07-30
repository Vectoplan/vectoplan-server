#!/bin/sh
set -eu

python -c "from app import create_app; app = create_app(); required = {'/health', '/ready', '/v1/lvs'}; routes = {rule.rule for rule in app.url_map.iter_rules()}; missing = required - routes; assert not missing, f'missing routes: {sorted(missing)}'"

if [ "$#" -eq 0 ]; then
  set -- gunicorn --bind "0.0.0.0:${VECTOPLAN_LV_PORT:-5000}" --workers 2 --threads 4 --timeout 60 wsgi:app
fi

exec "$@"
