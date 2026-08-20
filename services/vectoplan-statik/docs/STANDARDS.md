# Normen- und Entscheidungslogik

Stand: 14. August 2026. Dieses Dokument enthält Metadaten und
Anwendungsentscheidungen, keine urheberrechtlich geschützten Normtexte.

## Grundprinzip

Eine Berechnung speichert immer ein explizites `standards_profile`. Eine neuere
Normausgabe ersetzt niemals stillschweigend das Projektprofil. Vor Freigabe sind
insbesondere zu prüfen:

1. Bauort und einschlägiges Landesrecht,
2. eingeführte Technische Baubestimmungen,
3. Normgeneration und Ausgabe,
4. Nationaler Anhang und nationale Parameter,
5. projektspezifische Einwirkungen und Bemessungssituationen,
6. Anwendungsgrenzen des verwendeten Rechenmoduls.

## Historische DIN-1055-Unterlagen

DIN 1055-1:2002-06, DIN 1055-4:2005-03 samt Berichtigung 1:2006-03,
DIN 1055-5:2005-07 und DIN 1055-100:2001-03 werden im Formelkatalog als
historische Quellen geführt. Ihre Ansätze und Tabellen helfen bei Herleitung,
Bestandsakten und Vergleichsrechnungen, sind aber kein aktives Normprofil.

Jeder betroffene Formeldatensatz nennt deshalb getrennt:

1. die historische Ausgabe und genaue Fundstelle,
2. den Status `zurückgezogen`,
3. die heutige Eurocode-Familie mit Nationalem Anhang,
4. den im Projekt tatsächlich bestätigten Parametersatz.

Eine historische Windregel darf außerdem nur zusammen mit der zugehörigen
Berichtigung ausgewertet werden. Der aktuelle Katalog implementiert keine
automatische Auswahl historischer Tabellenwerte.

## Warum welche Eurocodes ausgewählt werden

| Situation | Regelwerksfamilie | Grund |
|---|---|---|
| jedes Tragwerk | DIN EN 1990 | Grundlagen, Grenzzustände, Zuverlässigkeit und Kombinationen |
| Eigengewicht/Nutzlast | DIN EN 1991-1-1 | allgemeine Einwirkungen im Hochbau |
| Schnee/Wind/Brand | DIN EN 1991-1-3/-1-4/-1-2 | Einwirkungsart wird im Lastfall explizit klassifiziert |
| Brücke | DIN EN 1991-2 | Verkehrslasten auf Brücken; ein Hochbau-Nutzlastprofil reicht nicht aus |
| Beton/Stahlbeton/Spannbeton | DIN EN 1992 | werkstoffbezogene Tragfähigkeit, Gebrauch, Dauerhaftigkeit |
| Stahl | DIN EN 1993 | Stahlquerschnitte, Bauteile und Stabilität |
| Holz | DIN EN 1995 | Holztragwerke einschließlich Nutzungsklasse und Lasteinwirkungsdauer |
| Mauerwerk | DIN EN 1996 | Mauerwerkswände und materialabhängige Regeln |
| Baugrund/Fundament | DIN EN 1997 | geotechnische Bemessung; Baugrundwiderstand darf nicht geraten werden |
| Erdbeben | DIN EN 1998 | seismische Einwirkungen und Tragwerksregeln |
| Aluminium | DIN EN 1999 | Aluminiumtragwerke |

## Übergang zur zweiten Eurocode-Generation

Die zweite Generation ist 2026 normativ im Übergang. Laut JRC wurden die
formalen Abstimmungen bis Ende 2025 abgeschlossen. Gemeinsames spätestes
Publikationsdatum ist September 2027, das späteste Rückzugsdatum kollidierender
Erstgenerationsnormen März 2028. Nationale Anhänge und bauaufsichtliche
Einführung folgen eigenen Zeitplänen. Daher bleibt `EU_2G_PREVIEW` ein
Migrationsprofil und wird nicht automatisch als deutsches Projektprofil
aktiviert.

Offizielle Quellen:

- https://eurocodes.jrc.ec.europa.eu/second-generation-eurocodes
- https://eurocodes.jrc.ec.europa.eu/2nd-generation/second-generation-eurocodes-what-new
- https://www.dibt.de/de/wir-bieten/technische-baubestimmungen
- https://www.din.de/de/meta/suche/62730!search

## Laufzeitentscheidung

`StandardsRegistry.select()` erhält Bauwerkstyp, Werkstoff und vorhandene
Einwirkungsarten. Das Ergebnis enthält:

- alle ausgewählten `StandardReference`-Einträge,
- eine `DecisionRecord` für Normprofil und Werkstoff,
- bei Brücken eine gesonderte Entscheidung für Verkehrslasten,
- zusätzliche Referenzen für Schnee, Wind oder Brand.

Die Faktoren liegen im versionierten Projektprofil. Sie müssen gegen die
lizenzierte Originalnorm und den Nationalen Anhang geprüft werden.
