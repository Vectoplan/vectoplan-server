# API

## Start und vollständiger lokaler Daten-Reset

Normaler Start (inklusive Datenbank-Initialisierung, GeoServer, Chunk,
Library, Filecloud und nachgelagerter Chunk-Reconciliation):

```powershell
docker compose up -d --build
```

Container zu entfernen löscht die benannten PostgreSQL-/Medien-Volumes nicht.
Ein **vollständiger lokaler Server-Reset mit unwiderruflichem Datenverlust** ist:

```powershell
docker compose down --volumes --remove-orphans
docker compose up -d --build
```

Vor dem Reset kann mit `docker volume ls` geprüft werden, welche
`vectoplan-server_*`-Volumes vorhanden sind. Ohne `--volumes` bleiben Projekte,
Chunk-Welten und Filecloud-Daten absichtlich erhalten.

## Technische Dokumentation

- [Grundstücksauswahl, Grundstücksraster und WorldEdit](services/vectoplan-editor/docs/PARCEL_GRID_AND_WORLDEDIT.md)
- [Dynamische Geodaten-Overlays](services/vectoplan-chunk/docs/GEODATA_OVERLAYS.md)
- [Earth-Geländepipeline](services/vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md)
- [CAD↔Chunk-Abbildungsvertrag](services/vectoplan-core/docs/CAD_CHUNK_MAPPING.md)
- [Construction Recognition](services/vectoplan-core/docs/CONSTRUCTION_RECOGNITION.md)
- [Portal, Workspace-Reiter und Veröffentlichungen](services/vectoplan-app/README.md)
- [Projektgebundene Dateien und Berechtigungen](services/vectoplan-filecloud/README.md)

## Earth-Geländepipeline

Die vollständige Dokumentation des produktiven Weges von Webscraper und GeoServer-Orchestrator über den versionierten DGM-Cache bis zu Chunk-Service, Projektkarte und begehbarer 3D-Oberfläche liegt unter [`services/vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md`](services/vectoplan-chunk/docs/EARTH_DGM_PIPELINE.md).


http://localhost:8080/
http://localhost:8088/dashboard/list/

http://localhost:8088/
