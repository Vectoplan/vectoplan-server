# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runtime

ARG APP_HOME=/opt/vectoplan/services/vectoplan-statik
ARG APP_USER=vectoplan

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOME=${APP_HOME} \
    VECTOPLAN_STATIK_HOST=0.0.0.0 \
    VECTOPLAN_STATIK_PORT=5000 \
    VECTOPLAN_STATIK_INTEGRATIONS_ENABLED=false

RUN groupadd --system "${APP_USER}" \
    && useradd --system --gid "${APP_USER}" --home-dir "${APP_HOME}" "${APP_USER}" \
    && mkdir -p "${APP_HOME}" \
    && chown -R "${APP_USER}:${APP_USER}" "${APP_HOME}"

WORKDIR ${APP_HOME}

COPY --chown=${APP_USER}:${APP_USER} requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --requirement requirements.txt

COPY --chown=${APP_USER}:${APP_USER} . .
RUN chmod +x ./entrypoint.sh

USER ${APP_USER}
EXPOSE 5000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=5 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health/ready', timeout=3)"]

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "60", "wsgi:app"]
