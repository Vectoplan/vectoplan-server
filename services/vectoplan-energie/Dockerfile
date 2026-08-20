FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000

WORKDIR /opt/vectoplan/services/vectoplan-energie

RUN addgroup --system vectoplan \
    && adduser --system --ingroup vectoplan --home /opt/vectoplan vectoplan

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN sed -i 's/\r$//' entrypoint.sh \
    && chmod +x entrypoint.sh \
    && chown -R vectoplan:vectoplan /opt/vectoplan/services/vectoplan-energie

USER vectoplan

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD python -c "import json, urllib.request; payload=json.load(urllib.request.urlopen('http://127.0.0.1:5000/health/ready', timeout=3)); raise SystemExit(0 if payload.get('ok') else 1)"

ENTRYPOINT ["./entrypoint.sh"]
