# Universelle Statikakte

## Ziel

Die Statikakte ist ein adaptives Kapitelmodell für Wohngebäude, Hallen, Brücken,
Stützbauwerke und Gründungen. HTML, PDF und die Rechenakte in der Anwendung
werden aus demselben Vertrag `structural-calculation-dossier/0.1` erzeugt.

Die Struktur ist aus den bereitgestellten Musterstatiken abgeleitet. Wiederkehrend
sind nicht nur Resultate, sondern die Kette aus Positionsplan, Eingaben,
Lastursprung, Kombination, Systemberechnung, Nachweis, Detail und
Lastweiterleitung.

## Verbindliche Kapitel

1. Deckblatt, Projekt, Bearbeitungsstand und Revision
2. Inhalts- und Prüfverzeichnis
3. Berechnungsgrundlagen, Normprofil, nationale Anhänge und Planungsunterlagen
4. Standort, Umweltbedingungen, Baugrund und Grundwasser
5. Materialien, Dauerhaftigkeit und gegebenenfalls Brandanforderungen
6. Tragsystem, Idealisierung, Aussteifung und Lastpfad
7. Lastfälle, Einwirkungsursprung, Lastgruppen und Kombinationen
8. Positionskatalog
9. Positionsweise Systemberechnung und Nachweise
10. Gründung und Geotechnik
11. Objektspezifische Themen
12. Ergebnis- und Ausnutzungsmatrix, offene Punkte und Freigabe
13. Anhänge, Zulassungen, Quelldokumente und Austauschdateien

## Positionsakte

Jede berechnete Position enthält mindestens:

- stabile Positions- und Revisionsreferenz;
- Systemskizze, Geometrie, Material, Querschnitt und Lagerung;
- Lastfälle mit Herkunft und Einheiten;
- Lastweiterleitung aus vorherigen Positionen;
- Faktoren und maßgebende Kombinationen;
- Solver, Theorie, Randbedingungen und Anwendungsgrenzen;
- Ergebnisfelder, Schnittgrößen, Verformungen und Reaktionen;
- Vergleich `Einwirkung ≤ Widerstand`, Ausnutzung und Status;
- Formel, Einsetzungen, Ergebnis und Regelwerksreferenz;
- weiterzugebende charakteristische oder bemessene Reaktionen;
- Annahmen, Warnungen, offene Nachweise und Prüfvermerk.

## Adaptive Objektkapitel

### Wohngebäude

Geschossstabilität, Dach, Decken, Wände, Unterzüge, Treppen, Gründung,
Dauerhaftigkeit und gegebenenfalls WU-Konzept.

### Halle

Rahmenstabilität, Theorie II. Ordnung, Verbände, Wind, Schnee/Verwehungen,
Kran- oder Nutzlasten, Anschlüsse, Stützenfüße und Gründung.

### Brücke

Verkehrslastmodelle, Temperatur, Lagerwege, Ermüdung, Dynamik, Bauzustände,
Widerlager/Pfeiler/Gründung und optionaler Messdatenabgleich.

### Stützbauwerk und Gründung

Baugrundmodell, Schichten, Grundwasser, Erd-/Wasserdruck, Bauzustände,
Spundwände, Anker, Pfähle, Gebrauchstauglichkeit und Stahlbetondetails.

## Statusregeln

Ein Kapitel ist `calculated`, wenn ein expliziter Eingabedatensatz, ein
ausgewiesener Solver bzw. Nachweis und ein reproduzierbares Ergebnis vorliegen.
`open` bedeutet, dass Eingabe, Solver oder Fachnachweis fehlt. Der Bericht darf
einen offenen Punkt niemals durch eine stillschweigende Standardannahme als
erledigt markieren.

## Aktuelle Rechengrenzen

Der lokale Kern deckt lineare Balkenlinien, rechteckige vierseitig gelenkig
gelagerte isotrope Platten, ausgewählte Querschnitts-/Bauteilchecks,
Fundamentkontakt, vereinfachten aktiven Erddruck und freie lineare
Temperaturbewegung ab. Allgemeine Platten-/Schalen-FEM, Nichtlinearität,
Stabilität komplexer Systeme, Ermüdung, Dynamik, vollständige Brückenlastmodelle,
Bauzustände sowie Boden-Bauwerk-Interaktion benötigen eigene verifizierte
Solvermodule.

## Quellenmuster

- `Statik-Auszuege.pdf`: Wohngebäude-Positionsgliederung, explizite
  Lastweiterleitung, Tragfähigkeits-/Gebrauchstauglichkeitsnachweise und
  Schlussvermerk.
- `Musterstatik_1-Fam.pdf`: System- und Lasttabellen, FE-Plattenergebnisse,
  Stabilitätsvorbemerkungen und Gründungsnachweise.
- `Anlage_6_-_Statische_Berechnung__Grndung.pdf`: Baugrundquellen,
  Positionspläne, Erd-/Wasserdruck, Pfähle/Spundwände, Stahlbetondetails,
  handschriftliche Prüfmarken und Bauzustandsbezug.
- `1745947647.pdf`: brückenspezifische Temperatur- und Lagerbewegungen,
  Objektparameter, Messsystem, Vergleich Rechnung/Messung und Diagrammserien.

