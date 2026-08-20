# Eurocode-Formelkatalog und Rechenmethoden

## Verbindliche Trennung

Der normative Formelkatalog von `vectoplan-statik` wird aus den projektintern
vorliegenden Dokumenten der Eurocodes EC1 bis EC9, den Nationalen Anhängen,
Änderungen und Berichtigungen aufgebaut. Im Katalog gilt:

```text
formula_id == eurocode rule_id
```

Der aktuelle Import enthält 12.089 maschinell erkannte Regel- und
Gleichungsstellen. `erfasst` bedeutet dabei nicht `fachlich geprüft` und nicht
`ausführbar`. Bis zur manuellen Kuratierung bleiben Variablen, Grenzen,
NA-Overlay, Implementierung und Tests gesperrt.

Die früheren 154 Katalogeinträge sind kein zweiter normativer Formelkatalog.
Sie werden als **Rechenmethoden und Implementierungen** weitergeführt. Das ist
nötig, weil Gleichgewicht, Mechanik, Solverbausteine, Umrechnungen,
Beispielsubstitutionen und historische Verfahren nicht mit einer maschinell
erkannten Normstelle gleichgesetzt werden dürfen.

## Quellenhierarchie

1. Eurocode-Basisnorm für die normative Regel.
2. Nationaler Anhang für national festgelegte Parameter und Entscheidungen.
3. Änderungen und Berichtigungen als versioniertes Overlay.
4. Landesrecht und Technische Baubestimmungen für die projektbezogene
   Anwendbarkeit.
5. Fachliteratur wie `Kleine Baustatik` für Herleitung, Erklärung,
   Plausibilität und Beispiele, nicht als Ersatz für den Normtext.
6. Interne Rechenmethoden für die nachvollziehbare technische Umsetzung.

Die `Kleine Baustatik` ist daher keine vereinfachte Ausgabe des Eurocodes. Sie
fasst Lehrstoff, allgemeine Baustatik und ausgewählte Bemessungsverfahren
didaktisch zusammen. Inhaltliche Überschneidungen mit Eurocodes sind möglich;
die normative Gültigkeit muss trotzdem an der konkreten Eurocode-Regel und dem
zugehörigen Nationalen Anhang geprüft werden.

## Manuelle Kuratierung einer Eurocode-Regel

Eine Regel wird erst freigegeben, wenn mindestens folgende Angaben bestätigt
sind:

- Dokument, Ausgabe, Abschnitt, Absatz, Gleichung und Seitenfundstelle,
- Normstatus sowie passender Nationaler Anhang, Änderungen und Berichtigungen,
- Regeltyp, Zweck, Voraussetzungen und Reihenfolge abhängiger Regeln,
- Variablen, Bedeutung, Einheit, Vorzeichen, Dimension und Herkunft,
- Mindest-, Höchst-, Ausschluss- und Anwendungsgrenzen,
- verknüpfte Rechenmethode und nachvollziehbare Zwischenschritte,
- Referenzwerte, Grenzfälle, Regressionstests und fachliche Freigabe.

Ein PDF-Treffer darf bis dahin nur `candidate_unverified` oder `incomplete`
tragen. Die Pipeline darf ihn nicht ausführen.

## Routen

```text
GET /statik/formelkatalog
GET /statik/katalog?bereich=eurocodes
GET /statik/methoden
GET /statik/katalog?bereich=methoden

GET /api/v1/statik/formulas
GET /api/v1/statik/formulas/<rule_id>
GET /api/v1/statik/formula-variables
GET /api/v1/statik/formulas/<rule_id>/variables

GET /api/v1/statik/implementation-methods
GET /api/v1/statik/implementation-methods/<method_id>
GET /api/v1/statik/implementation-variables
```

Diese Struktur bewahrt die Eurocode-Regel als normative Wahrheit, ohne bereits
vorhandene und getestete Rechenbausteine zu verlieren oder fälschlich zu
Normtext zu erklären.
