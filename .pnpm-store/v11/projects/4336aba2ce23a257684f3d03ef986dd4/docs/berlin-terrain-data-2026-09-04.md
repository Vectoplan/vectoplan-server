# Berliner Gelände-Testdaten, 4. September 2026

Vier amtliche Berliner DGM1-Kacheln wurden über den vorhandenen Scraper heruntergeladen und als freigegebener Terrain-Datensatz bereitgestellt. Sie enthalten zusammen **16.000.000 Höhenpunkte**, **69.468.051 Byte** komprimierte Rohdaten und decken **4 × 4 km Berlin-Mitte** ab. Das aktive Editor-Projekt liegt innerhalb dieses Testgebiets. Dies ist ein begrenzter Testausschnitt, kein vollständiger Berlin-Download.

- [Scraper-Projekt DGM5](http://127.0.0.1:5109/datensammlung/project/49f07b47-845d-5952-8240-13794894aeca)
- [Abgeschlossener Download-Lauf](http://127.0.0.1:5109/datensammlung/run/0f561f6a-de75-4da4-a8e2-d81387959217)
- Kampagne: `dab74882-57df-47a8-a8e2-cbb70722bb34`
- Workflow-Version: `60aecc16-3ad9-44f4-93d7-a52886a38317`
- Datensatz: `digitales-gelaendemodell-5m`
- Freigegebener Release: `534c6986ff3aecc761877a3836a4a96d6c3e73fb19561290e49e48c1f9dd3bc2`
- [Datensatz und Download-Dateien](http://127.0.0.1:5109/geodaten/admin/api/production-publications/digitales-gelaendemodell-5m)
- [Status des vorbereiteten Höhenindex](http://127.0.0.1:5109/geodaten/admin/api/production-publications/digitales-gelaendemodell-5m/terrain-serving)

## Herkunft und Umfang

Quelle ist das [amtliche Berliner ATOM-Angebot DGM1](https://gdi.berlin.de/data/dgm1/atom/0.atom) der Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin. Der Katalog nennt die [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0), EPSG:25833 und 1 m Rasterweite. Jede ZIP-Datei enthält eine XYZ-Datei mit 2.000 × 2.000 Punkten. Die Rohdaten bleiben im vorhandenen Scraper-Objektspeicher; der Orchestrator speichert einen abgeleiteten, versionierten Höhenindex.

| Amtliche Datei | Download-Job | Punkte | Höhenbereich, m |
| --- | --- | ---: | ---: |
| [DGM1_390_5818.zip](https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5818.zip) | `6d70a68a-49eb-4461-82e2-b37caf5c007c` | 4.000.000 | 21,58–41,29 |
| [DGM1_390_5820.zip](https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5820.zip) | `fd2085d5-0077-4d60-89df-97f6f9fac756` | 4.000.000 | 21,68–53,73 |
| [DGM1_392_5818.zip](https://gdi.berlin.de/data/dgm1/atom/DGM1_392_5818.zip) | `e07c101d-8c9b-44a1-a950-35c94457474d` | 4.000.000 | 29,10–41,86 |
| [DGM1_392_5820.zip](https://gdi.berlin.de/data/dgm1/atom/DGM1_392_5820.zip) | `db5eef85-82f6-4b1a-a6f8-e95b2ab94f75` | 4.000.000 | 30,82–78,37 |

Gebietsgrenzen in EPSG:25833: `[390000, 5818000, 394000, 5822000]`.

## Korrigierte Bereitstellung

Im Geschwisterprojekt `services/vectoplan-bigdata` wurden folgende Dateien geändert:

- `services/vectoplan-data-dashboard/src/services/production_releases.py`: Die Run-Liste enthält nur Zusammenfassungen. Vor dem Einsammeln der fertigen Artefakte werden jetzt die Run-Details geladen. Die ursprüngliche Datenquelle wird im Release erhalten und Berliner DGM-ZIP-Dateien erhalten das Terrain-Profil.
- `services/vectoplan-data-dashboard/tests/test_production_releases.py`: Regressionstest für die Berliner DGM-Erkennung ohne LLM.
- `services/vectoplan-geoserver-orchestrator/src/publications/service.py`: Quellabhängige UTM32/UTM33-Auswahl, vollständige räumliche Zuordnung der 2-km-Kacheln, Verarbeitung aller vier Millionen Punkte statt Abschneiden nach zwei Millionen sowie CSV-Unterstützung. Einzel- und Stapelabfragen geben das zutreffende Koordinatensystem zurück.
- `services/vectoplan-geoserver-orchestrator/tests/test_berlin_terrain.py`: Regressionstests für UTM33, beide Kilometerhälften, Höhenwerte, WGS84-Eingaben, CSV und die Punktgrenze.

Die Quelländerungen sind auf dem Host gespeichert und dauerhaft in neu gebaute Images übernommen. Die Image-Dateien wurden vor der Aktivierung ohne Netzwerk auf erfolgreiche Modulimporte und identische SHA-256-Prüfsummen zum Host geprüft. Anschließend wurden ausschließlich die Compose-Dienste `dashboard` und `geoserver-orchestrator` mit `--no-deps --force-recreate --wait` neu erstellt. Die vorhandenen Datenvolumes und der freigegebene Höhenindex blieben erhalten. Beide neuen Container melden `healthy`; beide Readiness-Endpunkte antworten mit HTTP 200.

Aktive Images nach dem Neuaufbau:

- `vectoplan-bigdata-dashboard`: `sha256:62e523fc6fd604f91d1a211e66cd5697f1435fa8894b73d528eec98faa823200`
- `vectoplan-bigdata-geoserver-orchestrator`: `sha256:4cca4d8ee9e9aa5d59283146f80c8817ff2baa18d32911519623bbfec663e9d5`

## Prüfung

- Alle vier Scraper-Jobs: `SUCCEEDED`, Lauf: `COMPLETED`.
- Alle vier vorbereiteten Höhenraster: EPSG:25833, 2.000 × 2.000 Werte, jeweils 4.000.000 Punkte; keine fehlgeschlagenen Kacheln.
- Orchestrator: **18 Tests bestanden**, einschließlich vorhandener UTM32-Tests und drei neuer Berlin-Tests.
- Dashboard: **8 Tests bestanden**; ein vorhandener Test mit Datenbank-Setup wurde in diesem isolierten Lauf nicht ausgeführt. Der reale Veröffentlichungsweg wurde zusätzlich über die laufende API geprüft.
- Reale Stapelabfrage nach vollständigem Neuerstellen der Container: **3/3 Treffer in 262 ms**. Projektursprung `13.405° E / 52.52° N`: **35,55 m**; Südwestecke `390000.5 / 5818000.5`: **36,83 m**; Nordostecke `393999.5 / 5821999.5`: **43,72 m**. Alle Antworten stammen aus dem erhaltenen vorbereiteten Höhenindex; weiterhin vier fertige Kacheln und keine Fehler.

Betroffenes Editor-Projekt: `prj_da09805bc6e54b29816c8cd6`; Chunk-Projekt: `chk_prj_prj_da09805bc6e54b29816c8cd6_6931567e1657`; Welt: `world_spawn`. Der Ursprung wurde aus der gespeicherten globalen Referenz gelesen. Manuelle Chunk-Snapshots wurden nicht gelöscht oder überschrieben. Die Prüfung der neuen Geländeoberfläche und das Aktualisieren der Chunk-Region erfolgen im zugehörigen Editor-/Chunk-Arbeitsschritt.
