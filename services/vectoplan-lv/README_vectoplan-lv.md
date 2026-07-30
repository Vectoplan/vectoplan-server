<!-- services/vectoplan-lv/README.md -->

# VECTOPLAN LV

`vectoplan-lv` ist der eigenständige VECTOPLAN-Microservice für die Erstellung, Bearbeitung, Prüfung, den Austausch und die Abrechnung von Leistungsverzeichnissen.

Der Service soll langfristig den vollständigen fachlichen Lebenszyklus eines Leistungsverzeichnisses abbilden:

```text
LV anlegen oder importieren
→ LV strukturieren und bearbeiten
→ Preise und Kalkulationsdaten verwalten
→ LV prüfen und versionieren
→ Ausschreibungs- und Vertragsstände austauschen
→ Aufmaße und Nachweise positionsbezogen verwalten
→ Abschlags- und Schlussrechnungen vorbereiten
→ Leistungs- und Abrechnungsstände nachvollziehen
```

Der erste Entwicklungsschritt konzentriert sich ausschließlich auf den Microservice `vectoplan-lv`.

Andere Systeme wie Nextcloud, `vectoplan-library`, CAD-Auswertung oder eine KI-gestützte Dokumentanalyse werden im Service fachlich und technisch berücksichtigt, aber zunächst nicht implementiert. Für diese Systeme werden stabile Schnittstellen und Platzhalter vorgesehen, damit sie später ergänzt werden können, ohne das Kernmodell des LV-Services neu aufzubauen.

---

## 1. Status dieses Dokuments

Dieses Dokument beschreibt die fachliche und technische Zielstruktur von `vectoplan-lv`.

Es ist zugleich:

- Produktbeschreibung,
- Architekturgrundlage,
- fachliches Domänenmodell,
- technischer Servicevertrag,
- Grundlage für Datenbankmodelle,
- Grundlage für API und Frontend,
- Grundlage für spätere Implementierungsaufgaben,
- Abgrenzung zu anderen VECTOPLAN-Services.

Dieses Dokument beschreibt noch keine vollständig implementierte Anwendung.

Der aktuelle Schwerpunkt liegt auf:

1. der klaren fachlichen Struktur,
2. dem internen Datenmodell,
3. der GAEB-Import- und Exportarchitektur,
4. dem Aufmaß- und Abrechnungsmodell,
5. einer einfachen und professionellen Benutzeroberfläche,
6. der sauberen Vorbereitung späterer Integrationen.

---

## 2. Rolle im VECTOPLAN-System

`vectoplan-lv` ist ein eigener Fachservice.

Die zentrale VECTOPLAN-Anwendung bleibt Portal, Projektverwaltung und Workspace-Shell. Sie öffnet `vectoplan-lv` im Projektkontext, verwaltet aber nicht die fachlichen LV-Daten.

Vereinfacht:

```text
vectoplan-app
  = Projekte, Benutzerkontext, Rechte, Workspace, Service-Referenzen

vectoplan-lv
  = Leistungsverzeichnis, Versionen, GAEB, Aufmaß, Abrechnung, Anlagenreferenzen

vectoplan-library
  = externe Bibliotheken für Geräte, Maschinen, Material und Kostenansätze

späteres Dateisystem
  = physische Ablage und Bearbeitung von Dateien
```

Die fachliche Wahrheit eines Leistungsverzeichnisses liegt ausschließlich in `vectoplan-lv`.

Die Portal-Anwendung hält nur die Verbindung, zum Beispiel:

```text
project_public_id
lv_public_id
lv_service_public_url
lv_service_internal_url
```

### 2.1 Zentrale Architekturregel

```text
Browser / iframe / redirect  → PUBLIC_URL
Backend / server-to-server   → INTERNAL_URL
```

Docker-interne Hostnamen dürfen nicht in Browser-URLs, Links oder iframe-Zielen erscheinen.

### 2.2 Projektbindung

Jedes LV gehört genau zu einem VECTOPLAN-Projekt.

```text
Project 1 ─── n LV-Dokumente
```

Ein Projekt kann beispielsweise enthalten:

- ein Ausschreibungs-LV,
- mehrere Lose,
- ein beauftragtes LV,
- ein Nachtrags-LV,
- ein internes Kalkulations-LV,
- ein Abrechnungs-LV.

Die Projekt-ID wird durch `vectoplan-app` übergeben. `vectoplan-lv` speichert sie als externe Referenz und prüft sie bei jedem fachlichen Zugriff.

---

## 3. Produktziel

Das Ziel ist ein LV-System, das trotz komplexer Bauabläufe einfach bedienbar bleibt.

Die Anwendung soll nicht versuchen, jede mögliche AVA-Funktion sofort anzubieten. Sie soll zuerst die täglichen Probleme zuverlässig lösen:

- LV-Dateien öffnen und bearbeiten,
- Positionen schnell finden,
- Mengen und Preise eindeutig verstehen,
- Versionen unterscheiden,
- Aufmaße einer Position sicher zuordnen,
- Anlagen ohne langes Suchen wiederfinden,
- erkennen, was bereits eingereicht, geprüft und abgerechnet wurde,
- GAEB-Dateien kontrolliert importieren und exportieren.

### 3.1 Produktprinzipien

#### Einfachheit vor Funktionsfülle

Die Oberfläche zeigt nur die Funktionen, die im aktuellen Arbeitsmodus benötigt werden.

#### Ein LV, mehrere Arbeitsmodi

LV-Erstellung, Kalkulation, Aufmaß und Abrechnung verwenden dieselbe fachliche Grundlage. Es werden keine voneinander getrennten Kopien desselben LVs erzeugt.

#### Nachvollziehbarkeit vor stiller Änderung

Freigegebene, eingereichte oder abgerechnete Daten dürfen nicht unbemerkt überschrieben werden.

#### Stabile interne IDs

Sichtbare Ordnungszahlen können sich ändern. Interne Identitäten dürfen sich nicht ändern.

#### GAEB als Austauschformat

Das interne VECTOPLAN-Modell bleibt unabhängig von einer konkreten GAEB-Version.

#### Dateien als Nachweise, nicht als Datenbank

Die fachlichen Zustände liegen in PostgreSQL. Ein späteres Dateisystem speichert die physischen Dokumente.

#### Professionelle, ruhige Oberfläche

Die Anwendung soll weiß, übersichtlich, präzise und technisch wirken. Dekorative Elemente treten hinter Inhalt und Lesbarkeit zurück.

---

## 4. Umfang des ersten Microservices

### 4.1 Bestandteil von `vectoplan-lv`

Der Microservice soll schrittweise folgende Fachbereiche enthalten:

- LV-Verwaltung,
- LV-Struktur,
- Positionen und Texte,
- Mengen und Einheiten,
- Preise und Summen,
- Versionierung,
- Freigabestände,
- GAEB-Import,
- GAEB-Export,
- Import- und Prüfberichte,
- Anlagenmetadaten,
- Aufmaßblätter,
- positionsbezogene Aufmaßverweise,
- Abrechnungsperioden,
- Rechnungsstände,
- Leistungsfortschritt,
- Prüfstatus,
- Audit-Historie.

### 4.2 Noch nicht Bestandteil der ersten Implementierung

Folgende Themen werden nur vorbereitet:

- produktive Nextcloud-Integration,
- produktive Integration eines anderen Filesystems,
- Entwicklung von `vectoplan-library`,
- automatische Übernahme von Bibliothekspreisen,
- CAD-basierte Mengenermittlung,
- automatische Analyse beliebiger PDF-, Word- oder Excel-Dateien,
- KI-gestützte LV-Erzeugung,
- XRechnung-Erzeugung,
- digitale Signatur,
- vollständiger Nachrichtenaustausch mit Vergabeplattformen.

### 4.3 Abgrenzung zu `vectoplan-library`

`vectoplan-lv` implementiert keine Maschinen-, Geräte-, Werkzeug- oder Materialbibliothek.

Der Service erhält nur eine spätere Integrationsgrenze:

```text
vectoplan-lv
  → LibraryClient
  → vectoplan-library
```

Im LV gespeicherte Kalkulationsansätze müssen später als Snapshot übernommen werden können. Eine spätere Preisänderung in `vectoplan-library` darf bereits gespeicherte LV-Stände nicht rückwirkend verändern.

---

## 5. Zielgruppen und Rollen

### 5.1 Typische Benutzer

- Planer,
- Ausschreibende,
- Bauleiter,
- Kalkulatoren,
- Auftragnehmer,
- Aufmaßtechniker,
- Rechnungsprüfer,
- Projektleiter,
- Administratoren.

### 5.2 Fachliche Rollen

Die Rollen werden projektbezogen vergeben.

```text
owner
admin
editor
calculator
measurement_editor
reviewer
billing_editor
viewer
```

### 5.3 Beispielrechte

```text
lv.view
lv.create
lv.edit
lv.delete
lv.version.create
lv.release
lv.import
lv.export
lv.price.view
lv.price.edit
measurement.view
measurement.edit
measurement.submit
measurement.review
billing.view
billing.edit
billing.release
attachment.view
attachment.manage
audit.view
```

Die endgültige Autorisierung kann später über `vectoplan-app` oder einen zentralen Auth-Service erfolgen. `vectoplan-lv` muss Rechte trotzdem serverseitig prüfen.

---

## 6. Fachbegriffe

| Begriff | Bedeutung |
|---|---|
| LV | Leistungsverzeichnis als fachliches Dokument |
| LV-Version | unverwechselbarer Bearbeitungs- oder Freigabestand |
| LV-Knoten | hierarchisches Element wie Los, Bereich, Titel oder Untertitel |
| Position | abrechenbare oder beschreibende LV-Position |
| OZ | sichtbare Ordnungszahl einer Position |
| Vertragsstand | für die Abrechnung verbindliche LV-Version |
| Aufmaßblatt | Sammlung positionsbezogener Aufmaßangaben und Nachweise |
| Anlage | Datei oder externe Dateireferenz zu LV, Position, Aufmaß oder Rechnung |
| Abrechnungsperiode | Abschlagsrechnung, Teilrechnung oder Schlussrechnung |
| Abrechnungszeile | Abrechnungsstand einer LV-Position in einer Periode |
| kumuliert | Summe aller anerkannten oder abgerechneten Vorgänge bis zu einem Stichtag |
| Nachtrag | ergänzte oder geänderte Leistung nach dem ursprünglichen Vertragsstand |
| Importlauf | kontrollierter Import einer externen Datei |
| Exportlauf | dokumentierter Export eines LV-Stands |

---

## 7. Technologievorschlag

### 7.1 Backend

```text
Python 3.12
Flask
Gunicorn
SQLAlchemy
Alembic
PostgreSQL
Pydantic oder klar definierte DTO-Modelle
```

Das Backend folgt dem bestehenden VECTOPLAN-Flask-Service-Muster:

```text
create_app()
→ Konfiguration
→ Extensions
→ Blueprints
→ Startup-Prüfungen
→ Fachlogik in src/
→ Datenbankmodelle in models/
→ Gunicorn-Start
```

### 7.2 Frontend

Empfohlen:

```text
Vue 3
TypeScript
Vite
Pinia
TanStack Table
```

Begründung:

Ein LV-Editor benötigt große hierarchische Tabellen, Inline-Bearbeitung, Tastaturnavigation, Spaltenumschaltung, Detailbereiche, Prüfmeldungen und verschiedene Ansichten derselben Positionen. Eine komponentenbasierte Oberfläche ist dafür besser geeignet als ausschließlich serverseitige Templates.

Der produktive Build kann vom Flask-Service als statische Anwendung ausgeliefert werden. Ein eigener Node-Server ist im Produktivbetrieb nicht zwingend erforderlich.

### 7.3 Datenbank

PostgreSQL ist die fachliche Datenbank.

PostgreSQL speichert unter anderem:

- LV-Dokumente,
- Versionen,
- Knoten,
- Positionen,
- Preise,
- Mengen,
- Aufmaße,
- Abrechnungsstände,
- Anlagenmetadaten,
- externe Dateireferenzen,
- Importberichte,
- Exporthistorie,
- Audit-Ereignisse.

### 7.4 Hintergrundaufgaben

Für die erste Version können kleine Importe synchron verarbeitet werden.

Für große GAEB-Dateien und spätere Dokumentanalysen sollte eine Job-Schnittstelle vorbereitet werden:

```text
JobQueue
├── import_gaeb
├── export_gaeb
├── validate_gaeb
├── generate_attachment_manifest
└── analyze_document   # später
```

Eine konkrete Queue wie Redis/RQ kann später ergänzt werden.

---

## 8. Empfohlene Service-Struktur

```text
services/vectoplan-lv/
│
├── app.py
├── wsgi.py
├── config.py
├── extensions.py
├── requirements.txt
├── Dockerfile
├── entrypoint.sh
├── alembic.ini
│
├── migrations/
│
├── routes/
│   ├── __init__.py
│   ├── health.py
│   ├── ui.py
│   ├── context.py
│   ├── lvs.py
│   ├── versions.py
│   ├── nodes.py
│   ├── items.py
│   ├── measurements.py
│   ├── billing.py
│   ├── attachments.py
│   ├── imports.py
│   ├── exports.py
│   └── audit.py
│
├── models/
│   ├── __init__.py
│   ├── base.py
│   ├── lv_document.py
│   ├── lv_version.py
│   ├── lv_node.py
│   ├── lv_item.py
│   ├── lv_text.py
│   ├── measurement_sheet.py
│   ├── measurement_reference.py
│   ├── billing_period.py
│   ├── billing_line.py
│   ├── attachment.py
│   ├── storage_reference.py
│   ├── import_job.py
│   ├── export_job.py
│   └── audit_event.py
│
├── src/
│   ├── bootstrap/
│   │   ├── startup.py
│   │   └── health.py
│   │
│   ├── domain/
│   │   ├── identifiers.py
│   │   ├── enums.py
│   │   ├── errors.py
│   │   ├── money.py
│   │   ├── quantities.py
│   │   └── ordering.py
│   │
│   ├── lvs/
│   │   ├── service.py
│   │   ├── repository.py
│   │   ├── versioning.py
│   │   ├── tree.py
│   │   └── validation.py
│   │
│   ├── measurements/
│   │   ├── service.py
│   │   ├── references.py
│   │   ├── folders.py
│   │   ├── review.py
│   │   └── summaries.py
│   │
│   ├── billing/
│   │   ├── service.py
│   │   ├── calculations.py
│   │   ├── progress.py
│   │   └── validation.py
│   │
│   ├── gaeb/
│   │   ├── common/
│   │   │   ├── errors.py
│   │   │   ├── report.py
│   │   │   ├── secure_xml.py
│   │   │   └── value_mapping.py
│   │   └── v33/
│   │       ├── parser.py
│   │       ├── mapper.py
│   │       ├── exporter.py
│   │       ├── validator.py
│   │       ├── phases.py
│   │       └── schemas/
│   │
│   ├── storage/
│   │   ├── base.py
│   │   ├── local.py
│   │   ├── null.py
│   │   └── nextcloud_placeholder.py
│   │
│   ├── library/
│   │   ├── client.py
│   │   └── placeholder.py
│   │
│   ├── document_analysis/
│   │   ├── service.py
│   │   └── placeholder.py
│   │
│   ├── repositories/
│   ├── api/
│   └── utils/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app/
│       ├── api/
│       ├── components/
│       ├── modules/
│       │   ├── lv-editor/
│       │   ├── calculation/
│       │   ├── measurements/
│       │   ├── billing/
│       │   ├── attachments/
│       │   └── gaeb/
│       └── styles/
│
└── tests/
    ├── unit/
    ├── integration/
    ├── gaeb/
    │   ├── fixtures/
    │   ├── golden_files/
    │   └── roundtrip/
    └── e2e/
```

### 8.1 Schichtentrennung

```text
routes/
  = HTTP, Request, Response, Statuscodes

src/
  = Fachlogik und Anwendungsfälle

models/
  = persistente Datenbankmodelle

frontend/
  = Benutzeroberfläche
```

Routen dürfen keine tiefe Geschäftslogik enthalten.

---

## 9. Internes Domänenmodell

Das interne Datenmodell darf keine direkte Kopie einer GAEB-XML-Datei sein.

VECTOPLAN benötigt zusätzliche Informationen, die nicht vollständig durch eine einzelne GAEB-Austauschphase beschrieben werden:

- interne Versionierung,
- Projektzuordnung,
- Prüfstatus,
- Aufmaßverweise,
- Anlagenordner,
- Rechnungsstände,
- CAD-Verknüpfungen,
- Audit-Historie,
- Benutzerrechte,
- interne Notizen.

Deshalb gilt:

```text
VECTOPLAN-Domänenmodell
        ↓
versionierter GAEB-Adapter
        ↓
GAEB-Datei
```

### 9.1 `LvDocument`

Das fachliche Hauptobjekt.

Wichtige Felder:

```text
id
public_id
project_public_id
name
description
kind
status
currency
owner_user_id
current_draft_version_id
current_contract_version_id
created_at
updated_at
deleted_at
```

Mögliche `kind`-Werte:

```text
tender
estimate
offer
contract
change_order
billing
internal
```

### 9.2 `LvVersion`

Ein klar abgegrenzter LV-Stand.

```text
id
public_id
lv_document_id
version_number
label
status
source_type
source_reference
based_on_version_id
created_by
created_at
released_by
released_at
content_hash
```

Status:

```text
draft
in_review
released
contractual
superseded
archived
```

### 9.3 `LvNode`

Hierarchischer Strukturknoten.

```text
id
public_id
lv_version_id
parent_node_id
node_type
sort_key
outline_level
outline_number
short_label
long_label
is_collapsed_by_default
```

Mögliche Knotentypen:

```text
root
lot
area
section
subsection
title
subtitle
text_block
item
```

### 9.4 `LvItem`

Fachliche Position.

```text
id
public_id
lv_version_id
node_id
stable_item_id
ordinal_number
item_type
short_text
long_text
quantity
unit
unit_price
total_price
price_status
execution_notes
billing_type
created_at
updated_at
```

Mögliche Positionstypen:

```text
standard
alternative
optional
contingency
lump_sum
text
surcharge
subtraction
```

### 9.5 Stabile Identität und sichtbare OZ

Die sichtbare Ordnungszahl ist kein Primärschlüssel.

Beispiel:

```text
interne ID: itm_8fdf7e...
sichtbare OZ: 01.01.0010
```

Die OZ kann sich ändern, wenn Positionen eingefügt, verschoben oder neu nummeriert werden. Verknüpfungen zu Aufmaßen, Anlagen und Abrechnungen bleiben über die interne ID stabil.

Zusätzlich wird bei freigegebenen Vorgängen ein OZ-Snapshot gespeichert. Dadurch bleibt nachvollziehbar, unter welcher Ordnungszahl eine Position zu diesem Zeitpunkt geführt wurde.

---

## 10. LV-Struktur und Bearbeitung

### 10.1 Beispielstruktur

```text
01 Baustelleneinrichtung
  01.01 Allgemeine Leistungen
    01.01.0010 Baustelle einrichten
    01.01.0020 Baustelle räumen

02 Erdarbeiten
  02.01 Baugrube
    02.01.0010 Oberboden abtragen
    02.01.0020 Boden lösen und laden
```

### 10.2 Bearbeitungsfunktionen

- Knoten anlegen,
- Position anlegen,
- Position duplizieren,
- Position verschieben,
- Position löschen,
- Positionen neu nummerieren,
- Kurztext bearbeiten,
- Langtext bearbeiten,
- Menge bearbeiten,
- Einheit bearbeiten,
- Einheitspreis bearbeiten,
- Positionstyp ändern,
- mehrere Positionen auswählen,
- Bereiche ein- und ausklappen,
- Positionen filtern,
- Volltextsuche,
- Fehler und Warnungen anzeigen.

### 10.3 Autosave

Entwurfsänderungen können automatisch gespeichert werden.

Dabei gelten folgende Regeln:

- Autosave nur für Entwurfsstände,
- optimistische UI mit serverseitiger Versionsprüfung,
- Konflikterkennung über `revision` oder ETag,
- keine stillen Überschreibungen,
- Anzeige des letzten Speicherzeitpunkts,
- Anzeige eines Fehlers bei nicht gespeicherten Änderungen.

### 10.4 Neunummerierung

Neunummerierungen müssen als explizite Fachaktion ausgeführt werden.

Vor der Durchführung zeigt das System eine Vorschau:

```text
alt          neu
01.01.0010 → 01.01.0010
01.01.0015 → 01.01.0020
01.01.0020 → 01.01.0030
```

Freigegebene oder vertragliche Versionen werden nicht nachträglich neu nummeriert. Dafür wird eine neue Version erzeugt.

---

## 11. Versionierung und Freigabe

### 11.1 Grundregel

Ein bearbeiteter Entwurf ist veränderbar.

Ein freigegebener oder vertraglicher Stand ist unveränderlich.

```text
Entwurf
→ Prüfung
→ Freigabe
→ Vertragsstand
```

### 11.2 Beispiel

```text
Version 1 – Import X83
Version 2 – redaktionelle Bearbeitung
Version 3 – Ausschreibung freigegeben
Version 4 – Angebot X84 importiert
Version 5 – Auftrag X86 / Vertragsstand
Version 6 – Nachtrag 01
```

### 11.3 Abrechnung gegen Vertragsstand

Jede Abrechnungsperiode verweist auf eine konkrete vertragliche Version.

```text
BillingPeriod.contract_version_id
```

Spätere Änderungen an einem LV dürfen vergangene Rechnungsstände nicht verändern.

### 11.4 Versionserstellung

Eine neue Version kann entstehen durch:

- manuelle Versionierung,
- Freigabe,
- GAEB-Import,
- Annahme eines Angebots,
- Vertragserteilung,
- Nachtrag,
- Revisionsanforderung.

### 11.5 Versionvergleich

Später soll ein Vergleich möglich sein:

- hinzugefügte Positionen,
- entfernte Positionen,
- geänderte Texte,
- geänderte Mengen,
- geänderte Preise,
- geänderte Einheiten,
- geänderte Hierarchie,
- geänderte OZ.

---

## 12. GAEB-Import und -Export

### 12.1 Ziel

`vectoplan-lv` soll Leistungsverzeichnisse im gebräuchlichen GAEB-Format kontrolliert importieren und exportieren können.

Zum Stand dieses Dokuments am 29. Juli 2026 ist GAEB DA XML 3.3, Ausgabe 2023-01, die aktuell eingeführte Version. GAEB DA XML 3.4, Ausgabe 2026-03, liegt als Beta-Version für Testzwecke vor und ist zunächst nicht das produktive Zielformat.

### 12.2 Relevante Austauschphasen

| Phase | Bedeutung | Geplante Priorität |
|---|---|---|
| X80 | Universelle LV-Daten | später |
| X81 | Leistungsbeschreibung | Stufe 2 |
| X82 | Kostenanschlag | später |
| X83 | Angebotsaufforderung | Stufe 1 |
| X84 | Angebotsabgabe | Stufe 1 |
| X85 | Nebenangebot | später |
| X86 | Auftragserteilung | Stufe 2 |
| X87 | Auftragsbestätigung | später |
| X31 | Mengenermittlung | spätere Abrechnungsstufe |
| X89 | Rechnung | spätere Abrechnungsstufe |
| X89B | rechnungsbegründende Unterlage | spätere Abrechnungsstufe |

### 12.3 Erste Implementierungsstufe

Der erste produktive GAEB-Kreislauf sollte enthalten:

```text
X83 importieren
X83 prüfen
X83 bearbeiten
X83 exportieren

X84 importieren
X84 exportieren
```

Danach:

```text
X81
X86
X31
X89 / X89B
```

### 12.4 Adapterstruktur

```text
src/gaeb/v33/
├── parser.py
├── mapper.py
├── exporter.py
├── validator.py
├── phases.py
└── schemas/
```

Eine spätere Version erhält einen neuen Adapter:

```text
src/gaeb/v34/
```

Das Domänenmodell bleibt unverändert, solange keine fachlich notwendige Erweiterung besteht.

### 12.5 Importablauf

```text
Datei hochladen
→ Dateityp erkennen
→ sichere XML-Verarbeitung
→ Version und Austauschphase erkennen
→ XSD-Prüfung
→ fachliche Vorprüfung
→ Vorschau erzeugen
→ Warnungen und Fehler anzeigen
→ Benutzer bestätigt Import
→ Import in neuer LV-Version
→ Importbericht und Originaldatei referenzieren
```

Ein Import überschreibt niemals ungeprüft einen bestehenden Vertragsstand.

### 12.6 Importbericht

Der Bericht enthält mindestens:

```text
Dateiname
Dateigröße
Datei-Hash
erkannte GAEB-Version
erkannte Austauschphase
Anzahl Bereiche
Anzahl Positionen
Anzahl Texte
Anzahl Preise
Anzahl Anlagen
Warnungen
Fehler
nicht unterstützte Elemente
Importzeitpunkt
importierender Benutzer
```

### 12.7 Fehlerklassen

```text
fatal
error
warning
info
```

Beispiele:

- XML nicht lesbar,
- GAEB-Version nicht unterstützt,
- Austauschphase nicht unterstützt,
- XSD-Verletzung,
- doppelte OZ,
- fehlende Einheit,
- ungültiger Dezimalwert,
- nicht unterstützter Positionstyp,
- fehlerhafte Hierarchie,
- widersprüchliche Summen,
- nicht zuordenbare Anlage.

### 12.8 Sicheres XML

Der Parser muss gegen typische XML-Angriffe abgesichert sein.

Insbesondere:

- keine externen Entities,
- keine DTD-Verarbeitung,
- kein Netzwerkzugriff durch den Parser,
- Begrenzung von Dateigröße und Tiefe,
- Begrenzung eingebetteter Dateien,
- Prüfung der MIME-Typen,
- keine ungeprüfte Ausführung oder Interpretation von Inhalt.

### 12.9 Exportablauf

```text
LV-Version auswählen
→ Austauschphase auswählen
→ Exportfähigkeit prüfen
→ Warnungen anzeigen
→ GAEB-Datei erzeugen
→ XSD-validieren
→ Hash bilden
→ Export protokollieren
→ Datei bereitstellen
```

### 12.10 Roundtrip-Tests

Ein wichtiger Testfall:

```text
GAEB-Datei importieren
→ intern speichern
→ gleiche Austauschphase exportieren
→ fachliche Gleichheit prüfen
```

Die XML-Datei muss nicht bytegenau identisch sein. Struktur, Inhalte, IDs, Texte, Mengen und Preise müssen jedoch fachlich korrekt erhalten bleiben.

---

## 13. Arbeitsmodi der Benutzeroberfläche

Die Anwendung verwendet dieselbe Datenbasis, zeigt aber unterschiedliche Arbeitsmodi.

```text
[ LV ] [ Kalkulation ] [ Aufmaß ] [ Abrechnung ]
```

### 13.1 LV-Modus

Typische Spalten:

```text
OZ
Kurztext
Menge
Einheit
Einheitspreis
Gesamtpreis
Status
Anlagen
```

### 13.2 Kalkulationsmodus

Kalkulation wird fachlich vorbereitet, aber die Bibliothek selbst entsteht in `vectoplan-library`.

Typische Informationen:

```text
OZ
Kurztext
Lohn
Material
Gerät
Nachunternehmer
Zuschläge
Einheitspreis
Gesamtpreis
```

### 13.3 Aufmaßmodus

Typische Spalten:

```text
OZ
Kurztext
Vertragsmenge
bisher aufgemessen
aktuell eingereicht
geprüft
Rest
Anhang
Status
```

### 13.4 Abrechnungsmodus

Typische Spalten:

```text
OZ
Vertragsmenge
bisher anerkannt
aktuell abzurechnen
kumuliert abgerechnet
Restmenge
Fortschritt
Über- / Unterschreitung
Status
```

---

## 14. Aufmaßkonzept

### 14.1 Zentrales Praxisprinzip

Im Aufmaßblatt soll nicht zwingend die vollständige Berechnung oder Aufmaßformel stehen.

Der einfachste und in der Praxis gut auffindbare Eintrag ist ein klarer Positionsverweis:

```text
Anhang: siehe 01.01.0010
```

Der eigentliche Nachweis liegt im zugehörigen positionsbezogenen Anlagenordner.

Damit werden zwei Dinge getrennt:

```text
Aufmaßblatt
  = Übersicht, Status und Positionsbezug

Anlagenordner
  = Rechenblätter, Pläne, PDFs, Fotos und weitere Nachweise
```

Das System darf später zusätzlich Rechenformeln unterstützen. Die Standardbedienung muss sie jedoch nicht verlangen.

### 14.2 Aufmaßzeile

Eine Aufmaßzeile kann deshalb sehr kompakt sein:

```text
Position: 01.01.0010
Text: Anhang: siehe 01.01.0010
Menge: optional
Einheit: aus Position
Status: eingereicht
Anlagen: 4 Dateien
```

Die Menge kann je nach Ablauf:

- direkt auf der Aufmaßzeile stehen,
- aus einem beigefügten Rechenblatt übernommen werden,
- erst bei der Prüfung ergänzt werden,
- über eine spätere X31-Datei übertragen werden.

### 14.3 Aufmaßblatt als eigenes Objekt

`MeasurementSheet` enthält:

```text
id
public_id
project_public_id
lv_document_id
contract_version_id
sheet_number
invoice_number
invoice_label
period_from
period_to
status
created_by
submitted_by
reviewed_by
created_at
submitted_at
reviewed_at
```

Beispiel:

```text
Aufmaßblatt: 045
Rechnung: 1. Abschlagsrechnung
Vertragsstand: Version 5
Status: eingereicht
```

### 14.4 Positionsverweis

`MeasurementReference` enthält:

```text
id
public_id
measurement_sheet_id
lv_item_id
item_ordinal_snapshot
reference_text
claimed_quantity
reviewed_quantity
approved_quantity
unit_snapshot
status
attachment_folder_key
created_at
updated_at
```

Standardwert für `reference_text`:

```text
Anhang: siehe <item_ordinal_snapshot>
```

Beispiel:

```text
Anhang: siehe 01.01.0010
```

### 14.5 Warum ein OZ-Snapshot notwendig ist

Die interne Verknüpfung erfolgt über `lv_item_id`.

Zusätzlich wird die damals sichtbare OZ gespeichert:

```text
item_ordinal_snapshot = 01.01.0010
```

Wenn eine spätere LV-Version die Position neu nummeriert, bleibt der eingereichte Aufmaßnachweis unter seiner ursprünglichen Nummer auffindbar.

### 14.6 Status eines Aufmaßblatts

```text
draft
submitted
in_review
partially_approved
approved
rejected
billed
superseded
```

Deutsche Anzeige:

```text
Entwurf
Eingereicht
In Prüfung
Teilweise anerkannt
Anerkannt
Abgelehnt
Abgerechnet
Ersetzt
```

### 14.7 Status eines Positionsverweises

Ein gesamtes Aufmaßblatt kann teilweise anerkannt sein, während einzelne Positionen unterschiedliche Zustände besitzen.

```text
draft
submitted
questioned
partially_approved
approved
rejected
billed
```

### 14.8 Keine stillen Änderungen nach Einreichung

Nach dem Einreichen gilt:

- Positionsverweise werden gesperrt,
- Dateien werden nicht still ersetzt,
- Änderungen erzeugen eine Revision,
- der ursprüngliche Stand bleibt nachvollziehbar,
- Prüfergebnisse werden als eigene Vorgänge gespeichert,
- Ablehnungsgründe bleiben erhalten.

---

## 15. Anlagen- und Ordnerkonzept

### 15.1 Ziel

Der Benutzer muss Aufmaßnachweise ohne Suche über viele unsystematische Dateinamen finden können.

Die Ordnerstruktur folgt daher der LV-Hierarchie und der Position.

Vom Benutzer gewünschtes Grundmuster:

```text
01.XX.XXXX/
  01.01.XXXX/
    01.01.0010/
      1. Rechnung_Aufmaßblatt 045/
```

Beispiel mit Dateien:

```text
01.XX.XXXX/
  01.01.XXXX/
    01.01.0010/
      1. Rechnung_Aufmaßblatt 045/
        Aufmaß_01.01.0010.pdf
        Berechnung.xlsx
        Plan_Ausschnitt.pdf
        Foto_001.jpg
```

### 15.2 Bedeutung der Ebenen

```text
01.XX.XXXX
  = oberster LV-Bereich beziehungsweise erste OZ-Ebene

01.01.XXXX
  = untergeordneter Titel beziehungsweise zweite OZ-Ebene

01.01.0010
  = konkrete LV-Position

1. Rechnung_Aufmaßblatt 045
  = konkrete Rechnung und konkretes Aufmaßblatt
```

### 15.3 Normalisierte Ordnersegmente

Das System soll aus der OZ automatisch Ordnersegmente ableiten.

Beispiel:

```text
OZ: 01.01.0010

Ebene 1: 01.XX.XXXX
Ebene 2: 01.01.XXXX
Position: 01.01.0010
```

Die konkrete Logik muss konfigurierbar sein, weil Ordnungszahlstrukturen je LV variieren können.

### 15.4 Rechnungsordner

Empfohlenes Format:

```text
<rechnungsnummer>. Rechnung_Aufmaßblatt <blattnummer>
```

Beispiele:

```text
1. Rechnung_Aufmaßblatt 045
2. Rechnung_Aufmaßblatt 061
Schlussrechnung_Aufmaßblatt 102
```

Intern sollten Dateisystem-unabhängige, sichere Namen verwendet werden. Der Benutzer sieht die fachliche Bezeichnung.

### 15.5 Ordnerpfad-Generator

Der Pfad wird zentral generiert:

```python
build_measurement_attachment_path(
    ordinal_number="01.01.0010",
    invoice_label="1. Rechnung",
    sheet_number="045",
)
```

Ergebnis:

```text
01.XX.XXXX/01.01.XXXX/01.01.0010/1. Rechnung_Aufmaßblatt 045/
```

Die Generierung darf nicht an mehreren Stellen im Code dupliziert werden.

### 15.6 Trennung von Anzeige und physischem Pfad

Der Service speichert:

```text
display_path
storage_key
provider
external_file_id
etag
checksum
```

Beispiel:

```text
display_path:
01.XX.XXXX/01.01.XXXX/01.01.0010/1. Rechnung_Aufmaßblatt 045/

storage_key:
projects/prj_x/lvs/lv_x/measurements/ms_x/items/itm_x/
```

Dadurch bleibt das physische Speichersystem austauschbar.

### 15.7 Ordner-Snapshot

Nach Einreichung eines Aufmaßblatts wird der fachliche Anzeigeordner als Snapshot gespeichert.

Eine spätere Änderung der OZ darf den alten Nachweisordner nicht automatisch umbenennen.

Optional kann die Benutzeroberfläche zusätzlich anzeigen:

```text
Damals: 01.01.0010
Heute:  01.01.0020
```

### 15.8 Dateimetadaten

`Attachment` enthält mindestens:

```text
id
public_id
project_public_id
lv_document_id
lv_version_id
linked_entity_type
linked_entity_id
purpose
original_filename
display_name
mime_type
size_bytes
checksum
storage_provider
storage_key
external_file_id
external_etag
status
revision_number
created_by
created_at
supersedes_attachment_id
```

Mögliche `linked_entity_type`-Werte:

```text
lv_document
lv_version
lv_node
lv_item
measurement_sheet
measurement_reference
billing_period
billing_line
import_job
export_job
```

### 15.9 Dateirevisionen

Eine neue Datei mit gleichem fachlichem Zweck ersetzt eine eingereichte Datei nicht still.

```text
Revision 1
→ Revision 2
→ Revision 3
```

Der aktuelle Stand wird markiert, alte Revisionen bleiben abrufbar.

---

## 16. Storage-Schnittstelle und Nextcloud-Platzhalter

### 16.1 Aktueller Umfang

Nextcloud wird in der ersten Phase nicht integriert.

`vectoplan-lv` muss trotzdem so aufgebaut werden, dass die spätere Integration keine Änderung der Fachlogik erfordert.

### 16.2 Storage-Vertrag

```python
class StorageProvider:
    def create_folder(self, *, storage_key: str): ...
    def list_entries(self, *, storage_key: str): ...
    def upload_file(self, *, storage_key: str, file_stream, metadata): ...
    def download_file(self, *, external_file_id: str): ...
    def move_entry(self, *, external_file_id: str, target_storage_key: str): ...
    def create_revision(self, *, external_file_id: str, file_stream): ...
    def delete_entry(self, *, external_file_id: str): ...
    def get_open_url(self, *, external_file_id: str): ...
```

### 16.3 Erste Provider

```text
NullStorageProvider
  = speichert nur Metadaten, keine Datei

LocalStorageProvider
  = lokale Entwicklung und Tests

NextcloudStorageProvider
  = später
```

### 16.4 Fachlogik darf Provider nicht kennen

Fachmodule rufen nur den abstrakten Storage-Service auf.

Nicht zulässig:

```text
measurements/service.py
  → direkter WebDAV-Aufruf
```

Zulässig:

```text
measurements/service.py
  → StorageProvider
  → konkrete Implementierung
```

### 16.5 Placeholder-Konfiguration

```text
VECTOPLAN_LV_STORAGE_PROVIDER=local
VECTOPLAN_LV_STORAGE_ROOT=/data/vectoplan-lv

# später
VECTOPLAN_LV_NEXTCLOUD_BASE_URL=
VECTOPLAN_LV_NEXTCLOUD_USERNAME=
VECTOPLAN_LV_NEXTCLOUD_PASSWORD=
VECTOPLAN_LV_NEXTCLOUD_ROOT=
```

Leere Nextcloud-Werte dürfen den Service nicht am Start hindern, solange der Nextcloud-Provider nicht aktiviert ist.

---

## 17. Abrechnungskonzept

### 17.1 Ziel

Für jede Position muss jederzeit erkennbar sein:

- welche Menge beauftragt wurde,
- welche Menge aufgemessen wurde,
- welche Menge eingereicht wurde,
- welche Menge geprüft wurde,
- welche Menge bereits abgerechnet wurde,
- wie hoch der aktuelle Abrechnungsstand ist,
- welche Menge verbleibt,
- ob eine Über- oder Unterschreitung besteht.

### 17.2 Keine einzelne Prozentzahl als Wahrheit

Ein frei eingegebener Wert wie „65 % abgerechnet“ reicht nicht.

Der Prozentsatz wird aus nachvollziehbaren Mengen oder freigegebenen Pauschalständen berechnet.

### 17.3 Mengenbasierte Position

```text
Vertragsmenge
+ genehmigte Nachtragsmenge
= aktuelle Vertragsmenge

anerkannte kumulierte Menge
÷ aktuelle Vertragsmenge
= Leistungsfortschritt
```

### 17.4 Pauschalposition

Für Pauschalpositionen kann ein freigegebener Leistungsstand geführt werden.

```text
billing_type = percentage
approved_progress_percent = 65,00
```

Dieser Wert muss einer konkreten Abrechnungsperiode und einer Freigabe zugeordnet sein.

### 17.5 Abrechnungstypen

```text
quantity
percentage
milestone
lump_sum
not_billable
```

### 17.6 `BillingPeriod`

```text
id
public_id
lv_document_id
contract_version_id
period_number
invoice_type
invoice_number
label
period_from
period_to
status
submitted_at
approved_at
created_by
created_at
```

Mögliche `invoice_type`-Werte:

```text
advance
partial
final
correction
```

Status:

```text
draft
prepared
submitted
in_review
partially_approved
approved
rejected
booked
cancelled
```

### 17.7 `BillingLine`

```text
id
public_id
billing_period_id
lv_item_id
item_ordinal_snapshot
contract_quantity_snapshot
contract_unit_price_snapshot
previous_approved_quantity
current_claimed_quantity
current_approved_quantity
cumulative_approved_quantity
remaining_quantity
previous_approved_amount
current_claimed_amount
current_approved_amount
cumulative_approved_amount
progress_percent
status
review_note
```

### 17.8 Kumulierte Darstellung

Beispiel:

```text
Position:                 01.01.0010
Vertragsmenge:            100,000 m²
Bisher anerkannt:          40,000 m²
Aktuell eingereicht:       25,000 m²
Aktuell anerkannt:         20,000 m²
Kumuliert anerkannt:       60,000 m²
Restmenge:                 40,000 m²
Fortschritt:               60,00 %
```

### 17.9 Übermengen

Übersteigt die eingereichte oder anerkannte Menge die Vertragsmenge, zeigt das System keine negative Restmenge ohne Erklärung.

Stattdessen:

```text
Vertragsmenge:             100,000 m²
Kumuliert anerkannt:       112,000 m²
Übermenge:                  12,000 m²
Status: Nachtrag / Freigabe erforderlich
```

### 17.10 Verbindung zu Aufmaßblättern

Eine Abrechnungszeile kann auf mehrere Aufmaßverweise zeigen.

```text
BillingLine 1
├── MeasurementReference A
├── MeasurementReference B
└── MeasurementReference C
```

Dadurch bleibt erkennbar, aus welchen Nachweisen die aktuelle Abrechnung besteht.

---

## 18. Nachträge

Nachträge dürfen nicht durch unkontrollierte Änderung des ursprünglichen Vertragsstands abgebildet werden.

Empfohlen:

```text
ursprünglicher Vertragsstand
+ Nachtragsversion 01
+ Nachtragsversion 02
= aktueller abrechenbarer Vertragsumfang
```

Ein Nachtrag kann enthalten:

- neue Position,
- geänderte Menge,
- geänderten Preis,
- geänderten Text,
- entfallene Position,
- zusätzliche Anlage,
- Freigabestatus.

Die Abrechnung verweist auf den ursprünglichen Vertragsstand und die genehmigten Nachträge.

---

## 19. Bibliotheksintegration als Platzhalter

`vectoplan-library` wird separat entwickelt.

`vectoplan-lv` erhält lediglich einen Client-Vertrag:

```python
class LibraryClient:
    def search_resources(self, *, query: str, filters: dict): ...
    def get_resource(self, *, resource_public_id: str): ...
    def create_snapshot(self, *, resource_public_id: str, context: dict): ...
```

In `vectoplan-lv` wird später nur der übernommene Snapshot gespeichert:

```text
source_service = vectoplan-library
source_resource_id
source_version
name_snapshot
unit_snapshot
price_snapshot
currency_snapshot
valid_at
metadata_snapshot
```

Die erste Version kann in der Oberfläche einen deaktivierten Eintrag anzeigen:

```text
Aus Bibliothek übernehmen
Noch nicht verfügbar
```

---

## 20. Dokumentanalyse als Platzhalter

Später soll ein Benutzer beispielsweise ein PDF, Word-Dokument, Excel-Dokument oder ein nicht direkt unterstütztes LV hochladen können.

Zielablauf:

```text
Datei hochladen
→ Inhalt extrahieren
→ Struktur erkennen
→ Positionen vorschlagen
→ Mengen und Einheiten vorschlagen
→ Konfidenz anzeigen
→ Benutzer prüft jeden Vorschlag
→ Übernahme in neue LV-Version
→ fachliche Prüfung
→ optional GAEB-Export
```

### 20.1 Wichtige Regel

```text
Die Analyse schlägt vor.
Der Benutzer bestätigt.
Der deterministische Validator entscheidet über Exportfähigkeit.
```

Eine KI darf keine ungeprüfte Datei als gültiges GAEB-Ergebnis ausgeben.

### 20.2 Placeholder-Objekt

```text
DocumentAnalysisJob
├── id
├── source_attachment_id
├── status
├── detected_document_type
├── progress
├── result_reference
├── warnings
├── created_at
└── completed_at
```

Status:

```text
not_available
queued
processing
review_required
completed
failed
```

---

## 21. Benutzeroberfläche

### 21.1 Grundlayout

```text
┌────────────────────────────────────────────────────────────────────┐
│ LV | Kalkulation | Aufmaß | Abrechnung       Import | Export | ... │
├────────────────┬────────────────────────────────────┬──────────────┤
│ LV-Struktur    │ Tabelle / Arbeitsfläche            │ Details      │
│                │                                    │ Dateien      │
│ 01 ...         │ 01.01.0010 ...                     │ Prüfung      │
│ 02 ...         │ 01.01.0020 ...                     │ Historie     │
│                │                                    │ Verweise     │
└────────────────┴────────────────────────────────────┴──────────────┘
```

### 21.2 Gestaltungsprinzipien

- weißer Hauptbereich,
- sehr helle graue Sekundärflächen,
- klare schwarze oder dunkelgraue Schrift,
- eine sparsame Akzentfarbe,
- dünne Trennlinien,
- kleine Radien,
- wenig Schatten,
- keine unnötig großen Karten,
- kompakte, gut lesbare Tabellen,
- deutliche Fokuszustände,
- vollständige Tastaturbedienung,
- Status nicht ausschließlich durch Farbe kennzeichnen.

### 21.3 Oberste Werkzeugleiste

```text
Neu
Importieren
Exportieren
Prüfen
Versionen
Anlagen
Mehr
```

### 21.4 Detailbereich

Der rechte Detailbereich zeigt abhängig von der Auswahl:

- Position,
- Langtext,
- Preise,
- Aufmaßstatus,
- Abrechnungsstand,
- Anlagen,
- Prüfmeldungen,
- Versionshistorie,
- externe Verknüpfungen.

### 21.5 Aufmaßansicht

Die Aufmaßansicht soll den positionsbezogenen Anhangsworkflow deutlich unterstützen.

Beispiel:

```text
OZ           Verweis                         Anlagen  Status
01.01.0010   Anhang: siehe 01.01.0010       4        Eingereicht
01.01.0020   Anhang: siehe 01.01.0020       2        Anerkannt
```

Ein Klick auf die Anlagenzahl öffnet direkt den fachlichen Ordner der Position und des Aufmaßblatts.

### 21.6 Abrechnungsfortschritt

Die Darstellung soll gleichzeitig absolute Werte und Prozentwerte zeigen.

Beispiel:

```text
60,000 / 100,000 m²
60,00 % anerkannt
40,000 m² verbleibend
```

---

## 22. API-Entwurf

Basis:

```text
/v1
```

### 22.1 Status und Kontext

```text
GET /health
GET /ready
GET /v1/context
```

### 22.2 LV-Dokumente

```text
GET    /v1/lvs
POST   /v1/lvs
GET    /v1/lvs/<lv_id>
PATCH  /v1/lvs/<lv_id>
DELETE /v1/lvs/<lv_id>
```

### 22.3 Versionen

```text
GET  /v1/lvs/<lv_id>/versions
POST /v1/lvs/<lv_id>/versions
GET  /v1/lvs/<lv_id>/versions/<version_id>
POST /v1/lvs/<lv_id>/versions/<version_id>/release
POST /v1/lvs/<lv_id>/versions/<version_id>/mark-contractual
GET  /v1/lvs/<lv_id>/versions/compare
```

### 22.4 Struktur und Positionen

```text
GET    /v1/lvs/<lv_id>/versions/<version_id>/tree
POST   /v1/lvs/<lv_id>/versions/<version_id>/nodes
PATCH  /v1/nodes/<node_id>
DELETE /v1/nodes/<node_id>
POST   /v1/nodes/<node_id>/move
POST   /v1/lvs/<lv_id>/versions/<version_id>/renumber-preview
POST   /v1/lvs/<lv_id>/versions/<version_id>/renumber
```

### 22.5 Aufmaß

```text
GET    /v1/lvs/<lv_id>/measurements
POST   /v1/lvs/<lv_id>/measurements
GET    /v1/measurements/<sheet_id>
PATCH  /v1/measurements/<sheet_id>
POST   /v1/measurements/<sheet_id>/references
PATCH  /v1/measurement-references/<reference_id>
DELETE /v1/measurement-references/<reference_id>
POST   /v1/measurements/<sheet_id>/submit
POST   /v1/measurements/<sheet_id>/review
GET    /v1/measurement-references/<reference_id>/attachment-path
```

### 22.6 Abrechnung

```text
GET   /v1/lvs/<lv_id>/billing-periods
POST  /v1/lvs/<lv_id>/billing-periods
GET   /v1/billing-periods/<period_id>
PATCH /v1/billing-periods/<period_id>
POST  /v1/billing-periods/<period_id>/lines
POST  /v1/billing-periods/<period_id>/calculate
POST  /v1/billing-periods/<period_id>/submit
POST  /v1/billing-periods/<period_id>/review
GET   /v1/lvs/<lv_id>/billing-summary
```

### 22.7 Anlagen

```text
GET    /v1/attachments
POST   /v1/attachments
GET    /v1/attachments/<attachment_id>
POST   /v1/attachments/<attachment_id>/revisions
DELETE /v1/attachments/<attachment_id>
GET    /v1/attachments/<attachment_id>/open
```

### 22.8 GAEB

```text
POST /v1/lvs/imports/gaeb
GET  /v1/imports/<import_id>
POST /v1/imports/<import_id>/confirm
POST /v1/imports/<import_id>/cancel

POST /v1/lvs/<lv_id>/exports/gaeb
GET  /v1/exports/<export_id>
GET  /v1/exports/<export_id>/download
```

---

## 23. Beispielantworten

### 23.1 Aufmaßverweis

```json
{
  "public_id": "mref_32b8f0b7",
  "measurement_sheet_id": "ms_045",
  "lv_item_id": "itm_74a030d1",
  "item_ordinal_snapshot": "01.01.0010",
  "reference_text": "Anhang: siehe 01.01.0010",
  "claimed_quantity": "25.000",
  "unit": "m²",
  "status": "submitted",
  "attachment_folder": {
    "display_path": "01.XX.XXXX/01.01.XXXX/01.01.0010/1. Rechnung_Aufmaßblatt 045/",
    "storage_provider": "local",
    "attachment_count": 4
  }
}
```

### 23.2 Abrechnungsübersicht einer Position

```json
{
  "lv_item_id": "itm_74a030d1",
  "ordinal_number": "01.01.0010",
  "unit": "m²",
  "contract_quantity": "100.000",
  "previous_approved_quantity": "40.000",
  "current_claimed_quantity": "25.000",
  "current_approved_quantity": "20.000",
  "cumulative_approved_quantity": "60.000",
  "remaining_quantity": "40.000",
  "progress_percent": "60.00",
  "status": "partially_approved"
}
```

---

## 24. Datenintegrität

### 24.1 Dezimalwerte

Mengen, Preise und Prozentwerte dürfen nicht mit binären Fließkommazahlen berechnet werden.

Backend:

```text
Decimal
```

Datenbank:

```text
NUMERIC / DECIMAL
```

### 24.2 Geldwerte

Beispiel:

```text
unit_price     NUMERIC(18, 6)
total_price    NUMERIC(18, 2)
```

Die genaue Genauigkeit muss an GAEB und interne Berechnungsanforderungen angepasst werden.

### 24.3 Währung

Die Währung wird am LV und als Snapshot an freigegebenen Preisständen gespeichert.

Standardwert für deutsche Projekte:

```text
EUR
```

### 24.4 Einheiten

Einheiten werden intern normalisiert und zusätzlich in ihrer importierten Schreibweise gespeichert, wenn dies für Roundtrip-Exporte notwendig ist.

### 24.5 Löschung

Fachlich relevante Daten werden in der Regel nicht physisch gelöscht.

Stattdessen:

```text
soft delete
archived
cancelled
superseded
```

Freigegebene, eingereichte oder abgerechnete Datensätze dürfen nicht physisch gelöscht werden.

---

## 25. Audit und Nachvollziehbarkeit

Wichtige Aktionen erzeugen ein Audit-Ereignis.

Beispiele:

```text
lv.created
lv.updated
lv.version.created
lv.version.released
lv.version.marked_contractual
lv.import.started
lv.import.confirmed
lv.export.created
measurement.created
measurement.submitted
measurement.reviewed
attachment.created
attachment.revised
billing.created
billing.submitted
billing.approved
```

Ein Audit-Ereignis enthält:

```text
id
project_public_id
lv_document_id
actor_user_id
action
entity_type
entity_id
before_snapshot
after_snapshot
metadata
created_at
```

Sensible Inhalte und große Dateien werden nicht vollständig in Audit-JSON kopiert. Dafür werden IDs, Hashes und relevante Änderungen gespeichert.

---

## 26. Sicherheit

### 26.1 Mandanten- und Projekttrennung

Jeder Request wird gegen `project_public_id` und Benutzerrechte geprüft.

Eine bekannte `lv_public_id` allein darf keinen Zugriff ermöglichen.

### 26.2 Uploads

- Dateigrößen begrenzen,
- MIME-Typen prüfen,
- Dateiendungen nicht allein vertrauen,
- sichere Dateinamen erzeugen,
- keine Dateien als ausführbaren Inhalt ausliefern,
- Download-Header setzen,
- später Virenprüfung integrieren,
- eingebettete GAEB-Anlagen separat prüfen.

### 26.3 Export

Ein Export darf nur aus einer konsistenten Version erzeugt werden.

Der Export erhält:

- Datei-Hash,
- Zeitstempel,
- Benutzer,
- LV-Version,
- GAEB-Version,
- Austauschphase,
- Validierungsergebnis.

---

## 27. Konfiguration

Beispiel:

```dotenv
VECTOPLAN_LV_ENV=development
VECTOPLAN_LV_HOST=0.0.0.0
VECTOPLAN_LV_PORT=5000
VECTOPLAN_LV_LOG_LEVEL=INFO

VECTOPLAN_LV_DATABASE_URL=postgresql+psycopg://vectoplan:password@postgres:5432/vectoplan_lv

VECTOPLAN_LV_PUBLIC_URL=http://localhost:5110
VECTOPLAN_LV_INTERNAL_URL=http://vectoplan-lv:5000

VECTOPLAN_LV_STORAGE_PROVIDER=local
VECTOPLAN_LV_STORAGE_ROOT=/data/vectoplan-lv

VECTOPLAN_LV_MAX_UPLOAD_MB=100
VECTOPLAN_LV_MAX_GAEB_EMBEDDED_ATTACHMENT_MB=50
VECTOPLAN_LV_GAEB_DEFAULT_VERSION=3.3

VECTOPLAN_LV_LIBRARY_ENABLED=false
VECTOPLAN_LV_DOCUMENT_ANALYSIS_ENABLED=false
VECTOPLAN_LV_NEXTCLOUD_ENABLED=false
```

---

## 28. Health und Startup-Prüfungen

### 28.1 Health

```text
GET /health
```

Beispiel:

```json
{
  "status": "ok",
  "service": "vectoplan-lv",
  "version": "0.1.0"
}
```

### 28.2 Readiness

```text
GET /ready
```

Prüft:

- Konfiguration,
- Datenbankverbindung,
- registrierte Blueprints,
- Migrationstand,
- Schreibbarkeit des aktiven Storage-Providers,
- Verfügbarkeit notwendiger GAEB-Schemata.

Nicht aktivierte Platzhalterintegrationen dürfen die Readiness nicht fehlschlagen lassen.

### 28.3 Startup-Invarianten

- `create_app()` funktioniert,
- `wsgi:app` wird exportiert,
- Konfiguration ist valide,
- Blueprints sind registriert,
- Datenbankmodelle sind geladen,
- Migrationstand ist prüfbar,
- `/health` ist erreichbar,
- Kernrouten sind vorhanden,
- Storage-Konfiguration passt zum aktivierten Provider,
- GAEB-Schemata der aktivierten Version sind vorhanden.

---

## 29. Tests

### 29.1 Unit-Tests

- OZ-Parser,
- Ordnerpfad-Generator,
- Mengenberechnung,
- Abrechnungsfortschritt,
- Versionierungsregeln,
- Statusübergänge,
- GAEB-Wertemapping,
- Berechtigungsregeln.

### 29.2 Integrationstests

- LV anlegen,
- Version erzeugen,
- Positionen anlegen,
- Aufmaßblatt einreichen,
- Anlage referenzieren,
- Abrechnungsperiode berechnen,
- GAEB importieren,
- GAEB exportieren,
- Rollback bei fehlerhaftem Import.

### 29.3 GAEB-Golden-Files

Für jede unterstützte Phase werden bekannte Testdateien versioniert.

```text
tests/gaeb/golden_files/
├── x83/
├── x84/
├── x86/
├── x31/
└── x89/
```

### 29.4 Roundtrip-Tests

- Import X83 → Export X83,
- Import X84 → Export X84,
- Texte erhalten,
- Mengen erhalten,
- Einheiten erhalten,
- Preise erhalten,
- Hierarchie erhalten,
- IDs soweit fachlich vorgesehen erhalten.

### 29.5 End-to-End-Tests

- LV im Portal öffnen,
- Position bearbeiten,
- Version freigeben,
- Aufmaßverweis erzeugen,
- Anhangspfad öffnen,
- Rechnung erzeugen,
- Fortschritt prüfen,
- GAEB exportieren.

---

## 30. Erste Migrationsmodelle

Die erste Datenbankmigration sollte mindestens enthalten:

```text
lv_documents
lv_versions
lv_nodes
lv_items
measurement_sheets
measurement_references
billing_periods
billing_lines
attachments
storage_references
import_jobs
export_jobs
audit_events
```

Noch nicht zwingend in Migration 1:

```text
library_snapshots
document_analysis_jobs
cad_references
xrechnung_documents
```

Diese Erweiterungspunkte müssen jedoch im Modell berücksichtigt werden.

---

## 31. Entwicklungsschritte

### Phase 0 – Service-Grundgerüst

- Muster auf `vectoplan-lv` übertragen,
- Service-Namen anpassen,
- ENV-Präfix auf `VECTOPLAN_LV_*` setzen,
- `/health` und `/ready` ergänzen,
- PostgreSQL anbinden,
- Alembic einrichten,
- leere UI-Shell bereitstellen,
- Portal-Verknüpfung vorbereiten.

### Phase 1 – LV-Kern

- `LvDocument`,
- `LvVersion`,
- `LvNode`,
- `LvItem`,
- Baumdarstellung,
- Positionsbearbeitung,
- Summen,
- Autosave,
- Versionierung,
- Freigabe.

### Phase 2 – Anlagenmetadaten und Storage-Abstraktion

- `Attachment`,
- `StorageReference`,
- `StorageProvider`,
- lokaler Entwicklungsprovider,
- positionsbezogener Ordnerpfad,
- Dateirevisionen,
- Nextcloud-Platzhalter.

### Phase 3 – GAEB-Grundfunktion

- sicherer XML-Parser,
- GAEB 3.3,
- X83-Import,
- X83-Export,
- X84-Import,
- X84-Export,
- XSD-Validierung,
- Importvorschau,
- Importberichte,
- Golden-Files.

### Phase 4 – Aufmaß

- Aufmaßblatt,
- Positionsverweis,
- Standardtext `Anhang: siehe <OZ>`,
- Aufmaßordner nach OZ-Struktur,
- Einreichung,
- Prüfung,
- Revisionen,
- Statusübersicht.

### Phase 5 – Abrechnung

- Vertragsstand auswählen,
- Abrechnungsperioden,
- Abschlagsrechnungen,
- kumulierte Mengen,
- Restmengen,
- Übermengen,
- Pauschalpositionen,
- Prüfstatus,
- Fortschrittsanzeige.

### Phase 6 – Weitere GAEB-Phasen

- X81,
- X86,
- X31,
- X89,
- X89B.

### Phase 7 – Externe Integrationen

- `vectoplan-library`,
- Nextcloud oder anderes Filesystem,
- CAD-Referenzen,
- Dokumentanalyse,
- XRechnung.

---

## 32. Akzeptanzkriterien für den ersten nutzbaren Stand

Ein erster nutzbarer Stand ist erreicht, wenn:

1. `vectoplan-lv` als eigener Container startet.
2. `/health` und `/ready` funktionieren.
3. Ein Projektkontext aus `vectoplan-app` übernommen wird.
4. Ein LV angelegt werden kann.
5. Ein LV eine hierarchische Struktur besitzen kann.
6. Positionen angelegt, bearbeitet, verschoben und gesucht werden können.
7. Entwurfs- und Freigabestände getrennt sind.
8. Eine freigegebene Version nicht still geändert werden kann.
9. X83 importiert und exportiert werden kann.
10. Importfehler verständlich angezeigt werden.
11. Ein Aufmaßblatt angelegt werden kann.
12. Der Standardverweis `Anhang: siehe <OZ>` erzeugt wird.
13. Der zugehörige Anlagenpfad automatisch gebildet wird.
14. Die Struktur `01.XX.XXXX/01.01.XXXX/01.01.0010/...` unterstützt wird.
15. Anlagenmetadaten revisionssicher gespeichert werden.
16. Eine Abrechnungsperiode angelegt werden kann.
17. Je Position bisherige, aktuelle, kumulierte und verbleibende Mengen sichtbar sind.
18. Die Benutzeroberfläche weiß, professionell und übersichtlich wirkt.
19. Nextcloud, Library und Dokumentanalyse als klar getrennte Platzhalter existieren.
20. Unit-, Integrations- und erste GAEB-Roundtrip-Tests vorhanden sind.

---

## 33. Wichtige Architekturentscheidungen

### ADR-001: Ein Microservice für LV und Abrechnung

LV-Erstellung, Aufmaß und Abrechnung bleiben Module desselben Microservices, weil sie dieselben Positionen, Versionen und Vertragsstände verwenden.

### ADR-002: PostgreSQL ist die fachliche Wahrheit

Ein Filesystem speichert Dokumente, aber keine LV-Fachstruktur.

### ADR-003: Nextcloud wird nicht vorzeitig integriert

Der erste Service implementiert nur die Storage-Abstraktion und einen Platzhalter.

### ADR-004: `vectoplan-library` bleibt eigenständig

`vectoplan-lv` implementiert keine Bibliotheksfachlogik.

### ADR-005: GAEB ist ein Adapter

Das VECTOPLAN-Domänenmodell wird nicht als Kopie eines XSD-Modells aufgebaut.

### ADR-006: Aufmaßstandard ist der Anlagenverweis

Der Standardtext lautet:

```text
Anhang: siehe <OZ>
```

Vollständige Rechenformeln im Aufmaßblatt sind optional, nicht verpflichtend.

### ADR-007: Anlagen folgen der Position

Der fachliche Anlagenpfad wird aus der OZ-Struktur, der Position, der Rechnung und dem Aufmaßblatt erzeugt.

### ADR-008: Interne IDs bleiben stabil

OZ und Ordneranzeige können sich ändern. Verknüpfungen verwenden stabile IDs und Snapshots.

### ADR-009: Freigegebene Daten sind unveränderlich

Korrekturen erzeugen Versionen oder Revisionen.

### ADR-010: Abrechnungsprozent wird berechnet

Mengenbasierte Positionen erhalten keinen frei eingegebenen Prozentwert als alleinige Wahrheit.

---

## 34. Offene Detailentscheidungen

Diese Punkte müssen vor oder während der Implementierung konkretisiert werden:

1. Welche OZ-Masken müssen neben `01.01.0010` unterstützt werden?
2. Wie werden sehr tiefe Gliederungen in Ordnernamen dargestellt?
3. Welche Dateitypen sind als Aufmaßanlagen zulässig?
4. Wie groß dürfen einzelne und gesamte Anlagenpakete sein?
5. Werden Mengen bei Einreichung immer verlangt oder können sie ausschließlich aus dem Anhang stammen?
6. Wie werden Prüferkorrekturen fachlich dokumentiert?
7. Können mehrere Aufmaßblätter derselben Rechnung dieselbe Position referenzieren?
8. Wie wird eine Position behandelt, die in mehreren Nachträgen vorkommt?
9. Welche GAEB-Elemente müssen im ersten X83/X84-Umfang vollständig unterstützt werden?
10. Welche Browser und Bildschirmgrößen werden als Minimum unterstützt?
11. Wie wird der Benutzerkontext zwischen Portal und iframe signiert?
12. Welche Regeln gelten für parallele Bearbeitung?

Diese Punkte ändern nicht die Grundarchitektur.

---

## 35. Nicht verhandelbare Invarianten

1. `vectoplan-lv` bleibt ein eigenständiger Microservice.
2. Der Service folgt dem gemeinsamen VECTOPLAN-Flask-Muster.
3. Fachlogik liegt nicht in den Routen.
4. PostgreSQL ist die fachliche Wahrheit.
5. Ein externes Filesystem wird über einen Adapter angebunden.
6. Nextcloud ist zunächst nur ein Platzhalter.
7. `vectoplan-library` wird nicht innerhalb dieses Services entwickelt.
8. Das interne Datenmodell bleibt unabhängig von einer konkreten GAEB-Version.
9. GAEB-Importe werden geprüft und bestätigt.
10. Freigegebene und vertragliche Versionen sind unveränderlich.
11. Sichtbare OZ sind keine Primärschlüssel.
12. Aufmaßverweise speichern einen OZ-Snapshot.
13. Der Standardaufmaßtext ist `Anhang: siehe <OZ>`.
14. Anlagenordner folgen einer eindeutigen positionsbezogenen Struktur.
15. Eingereichte Dateien werden nicht still ersetzt.
16. Abrechnungsstände bleiben kumuliert und prüfbar.
17. Mengen und Geldwerte verwenden Dezimalarithmetik.
18. Die Oberfläche bleibt einfach, weiß und professionell.
19. Platzhalterintegrationen dürfen den Service nicht blockieren.
20. Jede wesentliche Fachaktion ist auditierbar.

---

## 36. Externe fachliche Referenzen

Für die Implementierung der GAEB-Schnittstelle sind ausschließlich die offiziellen Fachdokumentationen und Schemadateien der jeweiligen GAEB-Version als technische Grundlage zu verwenden.

Relevante offizielle Bereiche:

- GAEB DA XML Version 3.3, Ausgabe 2023-01,
- GAEB DA XML 3.4, Ausgabe 2026-03 Beta, nur zu Test- und Beobachtungszwecken,
- offizielle XSD-Schemata,
- offizielle Dokumentation der Austauschphasen,
- GAEB-FAQ und GAEB-XML-Prüfwerkzeuge.

Die Schemadateien sollen kontrolliert und versioniert in den Service eingebunden werden. Ihre Lizenz- und Weitergabebedingungen sind vor dem Commit in das Repository zu prüfen.

---

## 37. Kurzfassung

`vectoplan-lv` wird ein eigenständiger Flask-/Python-Microservice mit PostgreSQL und einer modernen, tabellenorientierten Weboberfläche.

Der Service verwaltet:

```text
Leistungsverzeichnisse
Versionen
GAEB-Import und -Export
Aufmaßblätter
positionsbezogene Anlagenverweise
Abrechnungsperioden
kumulierte Leistungsstände
Audit-Historie
```

Nextcloud, `vectoplan-library`, CAD-Verknüpfungen und Dokumentanalyse werden nicht in der ersten Phase umgesetzt. Sie werden über getrennte Schnittstellen vorbereitet.

Der wichtigste Aufmaßgrundsatz lautet:

```text
Anhang: siehe 01.01.0010
```

Die Nachweise werden nach einer eindeutigen Struktur abgelegt:

```text
01.XX.XXXX/
  01.01.XXXX/
    01.01.0010/
      1. Rechnung_Aufmaßblatt 045/
```

Damit bleiben Position, Rechnung, Aufmaßblatt und Anlagen dauerhaft nachvollziehbar.

Der wichtigste technische Grundsatz lautet:

```text
VECTOPLAN-Domänenmodell
→ stabile interne IDs und Versionen
→ geprüfte GAEB-Adapter
→ austauschbarer Storage-Provider
```

So kann `vectoplan-lv` zuerst als klar abgegrenzter Microservice umgesetzt und später kontrolliert um Nextcloud, Bibliotheken, CAD-Mengen und automatische Dokumentanalyse erweitert werden.
