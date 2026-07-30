# vectoplan-lv

`vectoplan-lv` ist der eigenständige VECTOPLAN-Fachservice für
Leistungsverzeichnisse, Versionen, GAEB-Austausch, Aufmaß, Anlagenreferenzen
und Abrechnung.

Die vollständige fachliche Zielbeschreibung steht in
[`README_vectoplan-lv.md`](README_vectoplan-lv.md). Das gemeinsame technische
Service-Muster steht in [`Muster.md`](Muster.md).

## Aktueller Stand

Der erste implementierte Schnitt umfasst:

- Flask-App-Factory und Gunicorn-Einstieg,
- zentrale `VECTOPLAN_LV_*`-Konfiguration,
- SQLAlchemy- und Alembic-Anbindung,
- `/health`, `/ready` und `/v1/context`,
- projektgebundene LV-Liste und LV-Erstellung unter `/v1/lvs`,
- `LvDocument` und die automatisch angelegte erste `LvVersion`,
- Provider-neutrale Storage-Grenze mit lokalem und Null-Provider,
- explizite Platzhalter für Nextcloud, Library und Dokumentanalyse,
- erste professionelle UI-Shell unter `/lv`,
- Unit- und Integrationstests.

Noch nicht implementiert sind LV-Knoten und Positionen, Freigabe-Workflows,
GAEB, Aufmaß, Abrechnung, Uploads sowie produktive Autorisierung. Die
Projekt-ID wird bereits strikt zur Datensicht verwendet; der Header ist in
diesem Stand jedoch noch nicht kryptografisch als Portal-Kontext verifiziert.

## Lokal testen

```bash
python -m pip install -r requirements.txt
python -m pytest
```

Die Tests verwenden SQLite ausschließlich als isolierte Testdatenbank.
Entwicklung und Produktion sind für PostgreSQL konfiguriert.

## Starten

```bash
cp .env.example .env
flask --app app:create_app db upgrade
gunicorn --bind 0.0.0.0:5000 wsgi:app
```

Für Windows-Entwicklung kann der Service mit dem vorhandenen Python-Launcher
über `py -m flask --app app:create_app run` gestartet werden.

Die vorhandene Kernmigration erzeugt zunächst `lv_documents` und
`lv_versions`, damit der erste vertikale API-Schnitt auch im Compose-Stack
lauffähig ist. Die übrigen in Abschnitt 30 der Zielspezifikation geforderten
Modelle folgen in fachlich abgegrenzten Migrationen.

Im Gesamtstack stehen die Endpunkte nach
`docker compose -f docker-compose.all.yml up -d --build vectoplan-lv` unter
folgenden Adressen bereit:

- UI: `http://localhost:5105/lv`
- Health: `http://localhost:5105/health`
- Readiness: `http://localhost:5105/ready`

## Erste API-Aufrufe

```bash
curl http://localhost:5000/health

curl -H "X-Vectoplan-Project-Id: prj_demo" \
  http://localhost:5000/v1/lvs

curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Vectoplan-Project-Id: prj_demo" \
  -H "X-Vectoplan-User-Id: usr_demo" \
  -d '{"name":"Neubau Verwaltungsgebäude","kind":"tender","currency":"EUR"}' \
  http://localhost:5000/v1/lvs
```

Die UI-Shell ist unter
`http://localhost:5000/lv?project_public_id=prj_demo` erreichbar.
