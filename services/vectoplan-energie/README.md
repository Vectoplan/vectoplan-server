# VECTOPLAN Energie

Eigenständiger Energie-Fachdienst für VECTOPLAN. Der Service stellt eine vollflächige Arbeitsoberfläche, versionierte Austauschverträge, Editor-/CAD-Einbettungen und eine transparente Fachrechenpipeline bereit. Serverseitige Schreibzugriffe auf `vectoplan-core`, `vectoplan-library`, `vectoplan-cad` und `vectoplan-editor` bleiben deaktiviert; die Browser-Ansichten sind lesend eingebettet und für Objektauswahl vorbereitet.

## Aktueller Umfang

- Flask-App-Factory nach dem VECTOPLAN-Service-Muster
- UI-Route `GET /energie` (100 % Breite und Höhe)
- Liveness `GET /health/live` und Readiness `GET /health/ready`
- Editor-Route `/editor/test-generator` nach dem Muster von `vectoplan-library`
- CAD-Route `/cad` für Gebäude/Zonen und Anlagenschema
- Auswahlvertrag `vectoplan.energy-selection.v1` mit strikter Origin-/Frame-Prüfung
- normalisiertes Projektmodell `energy-project/0.2` für Wohn-, Nichtwohn- und Mischnutzung
- modulare Pipeline für U-Werte, Wärmebrücken, Lüftung, Heizlast, Feuchte- und Sommer-Screening, Jahresbilanz, Anlagen, Primärenergie und Zielprüfung
- deterministische Sanierungsvarianten und strukturierter Sanierungsfahrplan-Entwurf
- Energieausweis-, Wärme- und Fahrplan-Dokumententwürfe mit gesperrter amtlicher Ausgabe
- vier Testgebäude für Neubau, Bestand, Büro und Mischnutzung
- vollständige Herkunftsdaten, Modellfingerprint, Revisionsbezug und Qualitätsmeldungen
- Docker-/Gunicorn-Start und Tests

## Start

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Danach: `http://localhost:5000/energie`

Alternativ:

```bash
docker build -t vectoplan-energie .
docker run --rm -p 5000:5000 vectoplan-energie
```

## API

| Methode | Route | Zweck |
|---|---|---|
| `GET` | `/api/v1/energie/status` | Service- und Vertragsstatus |
| `GET` | `/api/v1/energie/bootstrap` | UI-Bootstrap, Demo-Snapshot, Module und Integrationsgrenze |
| `GET` | `/api/v1/energie/sample-project` | Validierter Demo-Gebäudesnapshot |
| `POST` | `/api/v1/energie/calculate` | Transparente Arbeitsberechnung |
| `POST` | `/api/v1/energie/pipeline/run` | Gesamte versionierte Fachrechenpipeline |
| `GET` | `/api/v1/energie/model-sources` | Browser-Routen und Auswahlvertrag für Editor/CAD |
| `POST` | `/api/v1/energie/model-selections/normalize` | Editor-/CAD-Auswahl prüfen und normalisieren |
| `GET` | `/api/v1/energie/datasets` | Verfügbare Testfälle |
| `GET` | `/api/v1/energie/datasets/<id>` | Einzelnen Testfall laden |
| `GET` | `/api/v1/energie/rule-profiles/de-working-2026.1` | Versioniertes Regelprofil und Quellenstand |
| `POST` | `/api/v1/energie/documents/<type>` | Strukturierter, nicht amtlicher Dokumententwurf |
| `POST` | `/api/v1/energie/change-sets` | Nicht persistierter Änderungsentwurf |
| `POST` | `/api/v1/energie/report-drafts` | Nicht generierter Berichtsentwurf |

## Pipeline

```text
Editor 3D / CAD 2D / Library
              │
              ▼
      Modell normalisieren
              │
              ▼
 Datenprüfung und Herkunft
              │
     ┌────────┼──────────┐
     ▼        ▼          ▼
   Hülle   Lüftung   Bauphysik
     └────────┼──────────┘
              ▼
       Jahresenergiebilanz
              │
              ▼
   Anlagen / Primärenergie
              │
       ┌──────┴──────┐
       ▼             ▼
  Zielprüfung    Varianten
                       │
                       ▼
              Dokumententwurf
```

Jede Stufe liefert Eingabepfade, Status, Rechenergebnis und fachliche Grenzen. Einzelne Kerne können dadurch später gegen validierte DIN-/GEG-Implementierungen ausgetauscht werden.

## Architektur für die Plattformverbindung

Das Energiesystem soll nicht selbst zur zweiten Quelle der Gebäudewahrheit werden. Die vorbereitete Grenze folgt deshalb diesem Ablauf:

```text
CAD / Editor / Core
        │
        ▼
unveränderter building_snapshot + base_revision
        │
        ├──── Library-Katalogsnapshot + catalog_revision
        ▼
VECTOPLAN Energie
  - Annahmen
  - Berechnung
  - Experten-Overrides
        │
        ▼
energy_change_set (draft)
        │
        ▼
zukünftiger Orchestrator prüft Konflikte und verteilt Änderungen
```

Die Protocols in `src/integrations/ports.py` definieren die späteren Server-Ports. Die aktuelle Editor-/CAD-Verbindung erfolgt ausschließlich im Browser. Es existiert absichtlich keine automatische Rückschreibung. Ein zukünftiges Änderungsset enthält mindestens:

- `project_id`
- `base_revision`
- deterministischen Fingerprint
- fachliche Absicht
- einzelne Pfadänderungen
- Autorendienst und Erstellungszeitpunkt

Damit kann eine Plattformintegration später optimistisch sperren, Konflikte erkennen, Änderungen auditieren und alle abhängigen Ansichten kontrolliert aktualisieren.

## Fachlicher Ausbaupfad

1. Auswahlvertrag direkt in Editor und CAD senden und empfangen
2. kanonischen Gebäudesnapshot gemeinsam mit Core versionieren
3. Energieparameter und Materialkennwerte in `vectoplan-library` vervollständigen
4. validierte DIN-V-18599-/GEG-Rechenkerne hinter den vorhandenen Stufen ergänzen
5. Referenzgebäude, offizielle Klima-/Nutzungsprofile und Förderstände versionieren
6. Expertenfreigabe, Signatur, Registrierung und amtliche Exportwege implementieren
7. kontrollierte Rückschreibung von Varianten über konfliktgeprüfte Änderungssets anbinden

## Wichtige Grenze

`energy-pipeline/0.3` erzeugt reproduzierbare Facharbeitswerte, ist aber noch keine validierte DIN-V-18599-/GEG-Rechenengine. Energieausweis und iSFP werden deshalb nur als strukturierte Entwürfe erzeugt; die amtliche Ausgabe bleibt technisch gesperrt.
