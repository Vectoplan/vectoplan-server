# Literatur- und Rechennachweis

## Verbindliche Arbeitsregel

Neue Fachliteratur wird nicht als unstrukturierter Formelspeicher übernommen. Jede fachliche Aussage erhält eine durchgehende Spur:

`Quelle und Seitenbereich -> Fachthema -> Rechenmodell -> Eingaben -> Formel/Algorithmus -> Anwendungsgrenze -> Referenztest -> Berichtskapitel`

Die Kapitelzuordnung liegt in `src/knowledge/catalog.json`. Der Formelkatalog 0.3
wird aus `formulas.json`, `extended_formulas.json` und der festen Taxonomie in
`catalog_structure.json` aufgebaut. Die Endpunkte `/api/v1/statik/literature`
und `/api/v1/statik/formulas` geben die jeweilige fachliche Ebene aus. Literatur ist eine
fachliche oder didaktische Quelle, aber kein Ersatz für aktuelle, lizenzierte
Normtexte und das am Projektort geltende Landesrecht.

Jeder Formeleintrag enthält Kennung, Kapitel, Gleichung, Beschreibung,
Variablen/Einheiten, Annahmen, Literaturseiten, Regelwerksbezug, Backend,
Umsetzungsstatus und benannten Regressionstest. Die Statuswerte bedeuten:

- `implemented`: deterministisch im angegebenen, getesteten Rechenumfang;
- `implemented_bounded`: implementiert, aber ausdrücklich auf das beschriebene
  Modell begrenzt;
- `documented`: fachlich erfasst, jedoch noch ohne freigegebenen Rechenkern;
- `incomplete`: mindestens ein erforderlicher Katalogbaustein ist bewusst als
  `unvollständig` markiert.

## Modulkarte

| Fachgebiet | Backend | Ergebnisbeleg |
|---|---|---|
| Gleichgewicht und Lastpfad | `src/loads/transfer.py` | Quellen, Übergaben, Reaktionen, Gleichgewichtsrest |
| Sicherheitskonzept und Kombinationen | `src/loads/combinations.py` | Faktoren je Lastfall und Kombination |
| Eigenlasten und Lastumrechnung | `src/loads/actions.py` | Volumen-, Schicht- und Lasteinzugsrechnung |
| Wind und Schnee | `src/loads/environmental.py` | Grundwerte, Beiwerte, Einsetzung, Flächendruck und Resultierende |
| Balken und Durchbiegung | `src/solvers/beam.py` | Schnittgrößen, Verformung, Reaktionen |
| Idealplatte | `src/solvers/plate.py` | Navier-Feld für den eng begrenzten Rechteckfall |
| Decken mit Öffnungen und inneren Lagern | `src/solvers/grillage.py` | Knotenfeld, Öffnung, Lager, Kontakt, Rissiteration |
| Fachwerke | `src/solvers/truss.py` | Stabkräfte, Knotenverschiebungen, Reaktionen |
| Stahlbeton | `src/design/concrete.py` | Biegung, Mindestbewehrung, Querkraft, Bügel |
| Stahl, Holz, Mauerwerk | `src/design/steel.py`, `timber.py`, `masonry.py` | Werkstoffbezogene Querschnittsnachweise |
| Gründung | `src/design/foundation.py`, `geotechnical.py` | Sohlpressung, Kern, Gleiten, Erd-/Wasserdruck |
| Stabilität, Brand, Ermüdung, Bauzustände | `src/design/advanced.py` | Getrennte Nachweise mit expliziten Eingaben und Grenzen |
| Projektpipeline | `src/projects/service.py` | Mehrpositionslauf, Status, Fähigkeiten, Lastbeziehungen |
| Programm- und Berichtsausgabe | `src/reports/dossier.py`, `project_renderer.py` | Gemeinsamer Ergebnisdatensatz für HTML und PDF |

## Anwendungsgrenzen

Der Grillagenkern ist ein diskretes Biegestreifenmodell. Er ist kein allgemeiner Mindlin-Schalen-, Membran-, Volumen- oder großer-Verformungs-Solver. Die Rissbildung wird als dokumentierte Sekantensteifigkeit, der Kontakt als vertikale Feder beziehungsweise Druckfeder und die Stabilität als begrenzter Stabnachweis abgebildet. Eine allgemeine nichtlineare 3D-FEM darf nur über einen externen Solveradapter mit versioniertem Ergebnisbeleg in die Projektakte gelangen.

## Aktueller Literaturstand

Der Katalog enthält aktuell 89 einzeln nachverfolgbare Ansätze aus `Kleine
Baustatik`, `Tragwerke`, den bereitgestellten historischen DIN-1055-Ausgaben,
den Musterstatiken und den vorhandenen Rechenkernen. Die eigene Oberfläche
`/statik/formelkatalog` zeigt je Ansatz Quelle, Fundstelle, Normfamilie,
Verarbeitung, Beispiel und Vollständigkeit. Das ist bewusst **keine** Behauptung
einer vollständigen Normimplementierung. Noch fehlende Spezialfälle werden als
eigene Zeilen geführt und dürfen nicht durch einen pauschalen Kapitelstatus
verdeckt werden. Alte Tabellenwerte werden nicht ungeprüft in Material- oder
Normenkataloge kopiert. Der genaue Quellenumfang steht in
`docs/FORMULA_CATALOG.md`.

## Variantenrechnung in HTML

Der Projektbericht zeigt Formeln nicht eingeklappt, sondern in der Reihenfolge
`Formel -> Einsetzung -> Ergebnis -> Regelwerksbezug/Annahmen`. Numerische
Projektwerte werden über einen begrenzten JSON-Pointer-Vertrag an
`POST /api/v1/statik/project-cases/<id>/preview` übergeben. Die Projektdatei
wird dabei nicht verändert. Der komplette Projektlauf wird erneut ausgeführt;
im Wohngebäude-Testfall wird eine geänderte Dachschneelast bis in die
Fachwerkknoten synchronisiert.
