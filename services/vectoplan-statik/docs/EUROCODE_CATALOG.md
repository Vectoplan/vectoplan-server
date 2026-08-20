# Eurocode-Gesamtregister EC1 bis EC9

## Ziel

Das Register erschließt alle PDF-Dateien in den lokalen Projektordnern `EC 1`
bis `EC 9`. Es bildet die vollständige Quellen- und Prüfwarteschlange für den
strukturierten Formelkatalog. Es ist keine Behauptung, dass sämtliche Regeln
bereits fachlich bestätigt oder als Rechenkern implementiert sind.

Oberfläche:

```text
/statik/formelkatalog/eurocodes
```

APIs:

```text
GET /api/v1/statik/eurocodes
GET /api/v1/statik/eurocodes/rules
GET /api/v1/statik/eurocodes/rules/<rule_id>
GET /api/v1/statik/eurocodes/documents/<document_id>
```

`/eurocodes/rules` unterstützt `q`, `family`, `document_id`, `document_kind`,
`confidence`, `topic`, `page` und `page_size`. Die Seitengröße ist auf 100
begrenzt, damit 12.000 Regelstellen nicht ungefiltert in Browser oder Bericht
geladen werden.

## Vollinventur

| Familie | Dokumente | Seiten | erkannte Regelstellen | Abschnitte |
|---|---:|---:|---:|---:|
| EC1 – Einwirkungen | 19 | 938 | 1.444 | 1.740 |
| EC2 – Betonbau | 10 | 761 | 3.929 | 1.417 |
| EC3 – Stahlbau | 41 | 1.751 | 2.355 | 3.863 |
| EC4 – Verbundbau | 6 | 362 | 480 | 944 |
| EC5 – Holzbau | 7 | 387 | 562 | 840 |
| EC6 – Mauerwerk | 9 | 416 | 1.548 | 1.009 |
| EC7 – Geotechnik | 4 | 389 | 164 | 809 |
| EC8 – Erdbeben | 10 | 662 | 830 | 1.389 |
| EC9 – Aluminium | 12 | 636 | 777 | 1.036 |
| **Gesamt** | **118** | **6.302** | **12.089** | **13.047** |

6.270 Seiten besitzen eine brauchbare Textebene. 32 Seiten sind schwach,
weitgehend grafisch oder gescannt und müssen bei der fachlichen Bearbeitung
visuell geprüft werden. Beim vollständigen Leselauf trat kein defektes PDF auf.

Dokumentarten:

- 57 Stammnormen,
- 55 Nationale Anhänge,
- 4 Änderungen,
- 2 Berichtigungen.

## Datenstruktur einer Regelstelle

Jede erkannte Stelle enthält:

- stabile Regel-ID und Eurocode-Familie,
- Normbezeichnung und Dokumentart,
- Gleichungsnummer, soweit aus der Textebene erkennbar,
- kurze extrahierte Gleichungszeile,
- kurzen Kontextauszug,
- genaue PDF-Seite sowie den nächstgelegenen Abschnitt,
- fachliches Thema und maschinelle Erkennungsqualität,
- getrennten Status für Fachprüfung und Implementierung,
- Platzhalter für Gültigkeit, Variablen, Einheiten, Algorithmus, Beispiel und
  Regressionstest.

Ungeprüfte Felder tragen immer `unvollständig`. Der Ausgangsstatus aller
maschinell erkannten Stellen lautet `machine_candidate_unverified`.

## Normen- und Overlaymodell

Eine Stammformel wird nicht durch Inhalte aus einem Nationalen Anhang ersetzt.
Die Ebenen bleiben getrennt:

```text
Stammnorm
  + Nationaler Anhang / nationale Parameter
  + Änderung A1, A2, …
  + Berichtigung
  + bestätigtes Projekt- und Rechtsprofil
  = im Projekt verwendbarer Regelstand
```

Mehrere Dokumente derselben Normbezeichnung sind über `related_documents`
verknüpft. Welcher Stand aktuell bauaufsichtlich anwendbar ist, bleibt bis zur
gesonderten Prüfung als `unvollständig` markiert.

## Fachliche Hochstufung

Eine erkannte Regelstelle darf erst von `unvollständig` zu `documented`
wechseln, wenn folgende Punkte geprüft sind:

1. Originalseite, Gleichung und Indizes stimmen.
2. Abschnitt, Anwendungsbereich und Ausschlüsse sind erfasst.
3. Variablen, Einheiten und Wertebereiche sind vollständig.
4. NA, Änderungen und Berichtigungen sind zugeordnet.
5. Ein nachvollziehbares Zahlenbeispiel liegt vor.

`implemented_bounded` erfordert zusätzlich einen begrenzten Rechenkern und
mindestens einen analytischen oder normnahen Regressionstest. `implemented`
erfordert die vollständige Abdeckung des ausdrücklich beschriebenen Umfangs.

## Reproduzierbare Pipeline

```powershell
python scripts/index_eurocodes.py <Eurocode-Ordner> `
  --output tmp/pdfs/eurocode_catalog --workers 6 --resume

python scripts/build_eurocode_rule_catalog.py `
  tmp/pdfs/eurocode_catalog/eurocode_inventory.json `
  --output src/knowledge/eurocode_catalog.json
```

Der erste Schritt liest jede Seite und erzeugt eine überprüfbare
Quelleninventur. Der zweite Schritt normalisiert die Fundstellen für API und
Oberfläche. Eine Neuerzeugung ersetzt den maschinellen Import, darf aber weder
manuell kuratierte Regelergänzungen noch interne Rechenmethoden überschreiben.
Der Eurocode-Regelsatz ist der primäre normative Formelkatalog; die
Rechenmethoden bleiben eine getrennte Umsetzungsschicht.
