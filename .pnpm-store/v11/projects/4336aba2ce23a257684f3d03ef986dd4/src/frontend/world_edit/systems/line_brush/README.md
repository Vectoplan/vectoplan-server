# Linien-Brush-System

Dieser Ordner kapselt den Gebäude-Linien-Brush. Er darf weder Kamera- noch
Workspace-Modi umschalten. Ego- und Planungsansicht verwenden denselben
WorldEdit-, Geschoss- und Persistenzvertrag.

## Zuständigkeiten

- `building_programs.ts`: Bibliothek-/Marketplace-Vertrag und Materialien.
- `building_presets.ts`: rein datengetriebene Standardwerte je Gebäudetyp.
- `building_layout.ts`: Module, Abstände und effektive Gebäudegrundrisse.
- `building_geometry.ts`: vollständige Wand- und Decken-Rasterzellen.
- `building_preview.ts`: rendert ausschließlich Ergebnisse der Geometry- und
  Roof-Verträge; enthält keine zweite Gebäude- oder Dachberechnung.
- `quick_settings_state.ts`: serialisierbarer UI-/Generierungszustand.
- `quick_settings.ts` und `quick_settings.css`: weißes Einstellungsfenster.

## Schutzregeln

1. Die semantische Geschosshöhe bleibt exakt `2,645 m` / `2645 mm`.
2. Außenwand, Decke und Dach müssen dieselbe Layout-Fläche konsumieren. Keine
   unabhängige Rundung oder nachträgliche Skalierung im Renderer einführen.
3. Dächer immer über `systems/roof/contracts.ts` berechnen und mit
   `scene/roof_calculation_rendering.ts` darstellen. Keine lokale Kopie einer
   Dachformel ergänzen.
4. Live-Vorschau und ObjectBatch-Persistenz konsumieren dieselben Storey- und
   Roof-Ergebnisse. Die Vorschau ist niemals die Quelle persistierter Geometrie.
5. Segment-Geschosse werden als signierte Abweichung vom Basisgeschossprofil
   gespeichert. Mindestens ein Geschoss je Segment erhalten.
6. Alle zusammengehörigen Wand-, Decken-, Dach- und Elternobjekte bleiben eine
   atomare `ObjectBatch`-Generation. Keine Teil-Speicherung aus UI-Code.
7. Änderungen an Rasterzellen oder Dachflächen benötigen Geometry-, Preset-,
   Quick-Settings- und Persistenztests, weil dort die gemeinsame Naht liegt.
