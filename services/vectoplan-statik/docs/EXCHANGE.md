# Tragwerksaustausch

## Kanonisches VECTOPLAN-Format

`vectoplan-structural-exchange/0.2` enthält Analysis-Job, optionales Ergebnis,
Koordinatensystem, Revision, Normprofil und Adapterstatus ohne Informationsverlust.

## SAF 2.2

Der Excel-Export verwendet SAF-Version 2.2.0 und erzeugt je nach Modell unter
anderem die offiziellen Objektlisten:

- `Project`, `Model`, `StructuralMaterial`,
- `StructuralCrossSection`, `StructuralPointConnection`,
- `StructuralCurveMember` oder `StructuralSurfaceMember`,
- `StructuralPointSupport` oder `StructuralEdgeConnection`,
- `StructuralLoadGroup`, `StructuralLoadCase`,
- `StructuralCurveAction` oder `StructuralSurfaceAction`,
- `StructuralLoadCombination`.

Referenz: https://www.saf.guide/en/stable/

Der Export ist ein implementierter Baseline-Adapter. `round_trip_certified` ist
bewusst `false`, bis Golden-File-Tests mit den Zielprogrammen durchgeführt sind.
Im Zielprogramm müssen Achsen, Profile, Lager, Freigaben, Lastrichtungen,
Kombinationen und National-Code-Einstellungen kontrolliert werden.

## IFC 4.3 Structural Analysis

IFC 4.3.2 kann analytische Stäbe/Flächen, Verbindungen, Lager, Lastfälle,
Kombinationen sowie Kräfte und Verschiebungen transportieren. Dynamik,
Vorspannlasten, FE-Topologie und detaillierte Netzspannungen sind laut offizieller
IFC-Dokumentation nicht im Anwendungsumfang. Deshalb ist das Mapping vorbereitet,
aber noch nicht als Export implementiert.

Referenz: https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/ifcstructuralanalysisdomain/content.html

