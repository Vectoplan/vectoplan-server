# Architektur und Implementierungsgrenze

## Zweck des Services

`vectoplan-lv` hält die fachliche Wahrheit eines Leistungsverzeichnisses über
seinen gesamten Lebenszyklus. Das Portal übergibt Projekt-, Benutzer- und
Rechtekontext; es speichert nicht die LV-Fachstruktur. Physische Dateien liegen
später hinter einem austauschbaren Storage-Adapter. `vectoplan-library` bleibt
ein separater Service.

## Kernfluss

```text
vectoplan-app
  -> projektgebundene HTTP-API
  -> Anwendungsfälle in src/
  -> stabiles VECTOPLAN-Domänenmodell
  -> SQLAlchemy/PostgreSQL

GAEB-Datei
  -> sicherer, versionierter GAEB-Adapter
  -> VECTOPLAN-Domänenmodell

Anlagenmetadaten
  -> StorageProvider
  -> lokaler Provider / später Nextcloud
```

## Nicht verhandelbare Grenzen

- Routen übersetzen nur HTTP; Geschäftslogik liegt in `src/`.
- Sichtbare OZ sind keine Identitäten.
- Freigegebene und vertragliche Versionen werden nicht verändert.
- Geld und Mengen verwenden später `Decimal`/`NUMERIC`.
- PostgreSQL ist die fachliche Wahrheit; SQLite wird nur in Tests verwendet.
- GAEB bleibt ein Adapter und bestimmt nicht das interne Modell.
- Projektfilterung gehört in jeden fachlichen Zugriff.
- Platzhalterintegrationen dürfen Readiness und Kernbetrieb nicht blockieren.

## Aktueller vertikaler Schnitt

Ein `POST /v1/lvs` legt innerhalb einer Transaktion ein `LvDocument` sowie
Version 1 im Status `draft` an. `GET /v1/lvs` und `GET /v1/lvs/<id>` sind
projektgebunden. Damit sind App-Factory, HTTP-Schicht, Service-Schicht,
Persistenz, Serialisierung und Tests früh gemeinsam verifiziert.

## Nächster empfohlener Schnitt

1. Initialen Modellsatz aus Zielspezifikation Abschnitt 30 vollständig
   definieren und die erste Migration erzeugen.
2. `LvNode`, `LvItem` und Dezimalwertobjekte implementieren.
3. Versionierungs- und Unveränderlichkeitsregeln mit Zustandsübergangstests
   absichern.
4. Erst danach den sicheren GAEB-3.3-X83-Import als bestätigten Importlauf
   beginnen.
