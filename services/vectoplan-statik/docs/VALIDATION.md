# Validierungsstrategie

## Stufen

1. **Einheiten- und Vertragstests** - Eingaben, Wertebereiche und Versionen.
2. **Analytische Referenzen** - Einfeldträger gegen geschlossene Lösung für
   Auflagerkräfte, Moment und Durchbiegung; Plattensymmetrie und Randwerte.
3. **Gleichgewicht** - Summe der Auflagerkräfte gegen Gesamtlast.
4. **Determinismus** - gleiche Eingabe ergibt denselben Fingerprint und dasselbe Ergebnis.
5. **Werkstoffmodule** - bekannte Monotonie- und Grenzwertbeziehungen.
6. **Export** - SAF-Sheet-/Tabellennamen, Datentypen und Pflichtbezüge.
7. **Bericht** - HTML-Struktur, PDF-Lesbarkeit und visuelle Seitendarstellung.
8. **Zielprogramm-Golden-Files** - noch ausstehend für SCIA, FRILO/ALLPLAN,
   Dlubal, SOFiSTiK und weitere SAF-Importer.

## Referenzfälle

Unter `src/reference_cases/` liegen acht versionierte Fälle:

- Stahlbeton-Einfeldträger,
- Stahl-Zweifeldträger,
- Wohngebäudedecke als Fläche,
- Hallendachträger mit Schnee,
- vorbereitender Brückenträger,
- Spannglied,
- Mauerwerkswand,
- Einzelfundament.

Die Fälle sind Regressionseingaben, keine Typenstatiken. Neue Solver werden nur
mit analytischen oder unabhängigen Vergleichsergebnissen freigegeben.

