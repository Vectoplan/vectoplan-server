# API

## Start und vollständiger lokaler Daten-Reset

Der vollständige Root-Start startet zuerst den Geo-Stack aus
`../vectoplan-bigdata` und danach Chunk, Library, Filecloud, OpenLayers und die
nachgelagerte Chunk-Reconciliation aus diesem Repository:

```powershell
python ..\..\start.py
```

Beim manuellen Start muss BigData-Geo zuerst bereit sein. Der Server-Stack
enthält GeoServer und GeoServer-Orchestrator nicht mehr selbst:

```powershell
docker compose -p vectoplan-bigdata -f ..\vectoplan-bigdata\docker-compose.yml up -d --build geoserver-orchestrator
docker compose up -d --build
```

Container zu entfernen löscht die benannten PostgreSQL-/Medien-Volumes nicht.
Ein **vollständiger lokaler Server-Reset mit unwiderruflichem Datenverlust** ist:

```powershell
docker compose down --volumes --remove-orphans
docker compose -p vectoplan-bigdata -f ..\vectoplan-bigdata\docker-compose.yml down --volumes
docker compose up -d --build
```

Vor dem Reset kann mit `docker volume ls` geprüft werden, welche
`vectoplan-server_*`-Volumes vorhanden sind. Ohne `--volumes` bleiben Projekte,
Chunk-Welten und Filecloud-Daten absichtlich erhalten.

## Technische Dokumentation

Die aktuelle System-, Service-, Betriebs- und Migrationsdokumentation liegt in
[`../vectoplan-bigdata/doku`](../vectoplan-bigdata/doku/README.md).

- [Grundstücksauswahl, Grundstücksraster und WorldEdit](services/vectoplan-editor/docs/PARCEL_GRID_AND_WORLDEDIT.md)
- [Parametrische Dächer und Polygonbereiche in CAD und WorldEdit](services/vectoplan-editor/docs/PARAMETRIC_ROOF_AND_POLYGON_AREAS.md)
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
