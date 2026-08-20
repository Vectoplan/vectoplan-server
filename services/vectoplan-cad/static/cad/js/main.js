(() => {
  "use strict";

  const app = document.querySelector(".cad-app");
  const routePrefix = app.dataset.routePrefix || "/api/v1/cad";
  const svg = document.getElementById("plan-svg");
  const ns = "http://www.w3.org/2000/svg";
  const query = new URLSearchParams(window.location.search);
  const projectContext = {
    coreProjectId: query.get("core_project_id") || "",
    projectPublicId: query.get("project_public_id") || query.get("app_project_public_id") || "",
    readOnly: ["1", "true", "yes", "on"].includes((query.get("read_only") || "").toLowerCase()),
    sampleRequested: query.get("sample") === "1",
  };

  const state = {
    input: null,
    scene: null,
    bootstrap: null,
    activeSheetRef: null,
    activeViewportRef: null,
    selectedPrimitive: null,
    activeTool: "select",
    visibleLayers: new Set(),
    knownLayers: new Set(),
    drawStart: null,
    drawCurrent: null,
    drawPointerRaw: null,
    commands: [],
    redoCommands: [],
    commandSequence: 0,
    camera: null,
    baseCameraWidth: null,
    pan: null,
    touchPoints: new Map(),
    pinch: null,
    spacePressed: false,
    shiftPressed: false,
    renderScheduled: false,
    parcelSelection: null,
    projectInputLoaded: false,
    projectionLoadSequence: 0,
    lastProjectionParcelSignature: "",
    parcelReloadTimer: 0,
    libraryCatalog: null,
    libraryItems: [],
    selectedLibraryItem: null,
    selectedLibraryVariant: null,
    libraryFilter: "all",
    libraryQuery: "",
    worldSelection: null,
    sharedModelFingerprint: "",
    sharedModelPollBusy: false,
    sharedModelPollTimer: 0,
    parcelGridDrag: null,
  };

  const toolConfig = {
    select: {label: "Auswahl", hint: "Element anklicken, um seine semantischen Referenzen zu prüfen."},
    selection: {label: "WorldEdit-Auswahl", hint: "Zwei Eckpunkte aufziehen. Der Bereich wird für Räume und weitere WorldEdit-Operationen gespeichert."},
    wall: {label: "Wand", command: "create_wall", hint: "Start- und Endpunkt wählen. Umschalttaste halten: 45°-Raster."},
    opening: {label: "Öffnung", command: "create_opening", hint: "Zwei Punkte auf einer Wand wählen. Umschalttaste halten: 45°-Raster."},
    library: {label: "Library-Bauteil", command: "place_library_object", hint: "Start- und Endpunkt wählen. Umschalttaste halten: 45°-Raster."},
    room: {label: "Raum", command: "create_room", hint: "Zwei gegenüberliegende Ecken wählen. Umschalttaste halten: 45°-Raster."},
    line: {label: "Linie", command: "create_line", hint: "Zwei Punkte auf der Modellfläche wählen, um eine lokale Linie zu erzeugen."},
    dimension: {label: "Maß", command: "create_dimension", hint: "Zwei Messpunkte wählen. Die Länge wird aus den Modellkoordinaten berechnet."},
    section: {label: "Schnitt", command: "create_section_marker", hint: "Zwei Punkte wählen, um im Erdgeschoss eine Schnittmarke A–A anzulegen."},
    "parcel-grid": {label: "Grundstücksraster", hint: "Hellblaue Innenlinie ziehen, um das schräge Grenzraster je Grundstück zu verschieben."},
  };

  const renderStyleOrder = {
    slab: 5,
    roof: 8,
    room: 10,
    structure: 15,
    component: 16,
    beam: 20,
    column: 22,
    "wall-cut": 30,
    stair: 35,
    opening: 40,
    window: 42,
    door: 44,
    unresolved: 60,
    line: 70,
    dimension: 80,
    annotation: 90,
    "room-label": 92,
  };

  function svgEl(name, attrs = {}, text = null) {
    const node = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) node.setAttribute(key, String(value));
    });
    if (text !== null) node.textContent = text;
    return node;
  }

  function normalizeGridRotation(value) {
    let result = Number.isFinite(Number(value)) ? Number(value) : 0;
    while (result >= 90) result -= 180;
    while (result < -90) result += 180;
    return Math.abs(result) < 1e-8 ? 0 : result;
  }

  function normalizeParcelList(value, maximum = 64) {
    return (Array.isArray(value) ? value : []).slice(0, maximum).map((entry) => {
      const item = entry && typeof entry === "object" ? entry : {};
      const geometry = item.geometry && typeof item.geometry === "object" ? item.geometry : {};
      const parcelId = String(item.parcelId || item.parcel_id || item.id || "").trim();
      if (!parcelId || !["Polygon", "MultiPolygon"].includes(String(geometry.type || ""))) return null;
      return {
        parcelId,
        datasetId: String(item.datasetId || item.dataset_id || "flurstuecke"),
        geometry,
        properties: item.properties && typeof item.properties === "object" ? item.properties : {},
      };
    }).filter(Boolean);
  }

  function normalizeParcelSelection(value) {
    const root = value && typeof value === "object" ? value : {};
    const source = root.detail || root.selection || root.last_map_selection || root;
    const coordinate = source.projectCoordinate || source.project_coordinate || {};
    const longitude = Number(coordinate.longitude ?? coordinate.lon ?? coordinate.lng);
    const latitude = Number(coordinate.latitude ?? coordinate.lat);
    const incomingProjectId = String(source.projectPublicId || source.project_public_id || "").trim();
    const rawGridState = source.parcelGridState || source.parcel_grid_state || {};
    const rawGuides = Array.isArray(rawGridState.guides) ? rawGridState.guides : [];
    const parcelGridState = String(rawGridState.schemaVersion || rawGridState.schema_version || "") === "vectoplan-parcel-grid-state.v1"
      ? {
          schemaVersion: "vectoplan-parcel-grid-state.v1",
          mode: String(rawGridState.mode || "boundary") === "setback" ? "setback" : "boundary",
          setbackMeters: Math.max(0, Math.min(20, Number(rawGridState.setbackMeters ?? rawGridState.setback_meters) || 0)),
          influenceMeters: Math.max(1, Math.min(512, Math.round(Number(rawGridState.influenceMeters ?? rawGridState.influence_meters) || 3))),
          activeParcelId: String(rawGridState.activeParcelId || rawGridState.active_parcel_id || "") || null,
          activeGuideKey: String(rawGridState.activeGuideKey || rawGridState.active_guide_key || "") || null,
          guides: rawGuides.map((guide) => {
            const start = guide?.startLonLat || guide?.start_lon_lat || [];
            const end = guide?.endLonLat || guide?.end_lon_lat || [];
            const values = [Number(start[0]), Number(start[1]), Number(end[0]), Number(end[1])];
            const parcelId = String(guide?.parcelId || guide?.parcel_id || "");
            if (!parcelId || !values.every(Number.isFinite)) return null;
            return {
              parcelId,
              startLonLat: values.slice(0, 2),
              endLonLat: values.slice(2, 4),
              depthMeters: Math.max(1, Math.min(512, Math.round(Number(guide?.depthMeters ?? guide?.depth_meters) || 3))),
            };
          }).filter(Boolean).slice(0, 256),
        }
      : null;
    if (projectContext.projectPublicId && incomingProjectId && incomingProjectId !== projectContext.projectPublicId) return null;
    return {
      projectPublicId: projectContext.projectPublicId || incomingProjectId,
      coordinateSpace: "wgs84",
      coveragePolicy: "cell-contained",
      revision: Number.isFinite(Number(source.revision)) ? Number(source.revision) : 0,
      projectCoordinate: Number.isFinite(longitude) && Number.isFinite(latitude)
        ? {longitude, latitude}
        : null,
      gridRotationDegrees: normalizeGridRotation(source.gridRotationDegrees ?? source.grid_rotation_degrees),
      parcels: normalizeParcelList(source.parcels || source.features, 64),
      adjacentParcels: normalizeParcelList(source.adjacentParcels || source.adjacent_parcels, 128),
      parcelGridState,
    };
  }

  function parcelSelectionSignature(selection = state.parcelSelection) {
    if (!selection) return "none";
    return JSON.stringify({
      projectPublicId: selection.projectPublicId,
      revision: selection.revision,
      coordinate: selection.projectCoordinate,
      gridRotationDegrees: selection.gridRotationDegrees,
      parcelGridState: selection.parcelGridState,
      parcels: selection.parcels.map((parcel) => parcel.parcelId).sort(),
    });
  }

  function parcelPolygons(parcel) {
    const geometry = parcel?.geometry || {};
    if (geometry.type === "Polygon") return [geometry.coordinates || []];
    return geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];
  }

  function exactCoordinateFrame() {
    const frame = state.input?.coordinate_frame || state.input?.coordinateFrame;
    const origin = frame?.storageOrigin;
    const width = Number(frame?.worldWidthCells);
    const height = Number(frame?.worldHeightCells);
    const centralMeridian = Number(frame?.centralMeridianDegrees);
    const originX = Number(origin?.x);
    const originZ = Number(origin?.z);
    const cellSizeMm = Number(frame?.modelCellSizeMm || (Number(frame?.metersPerCell) * 1000));
    if (frame?.schemaVersion !== "vectoplan-earth-grid-frame.v1"
      || frame?.horizontalMapping !== "vectoplan-periodic-equirectangular"
      || !Number.isFinite(width) || width <= 0
      || !Number.isFinite(height) || height <= 0
      || !Number.isFinite(centralMeridian)
      || !Number.isFinite(originX) || !Number.isFinite(originZ)
      || !Number.isFinite(cellSizeMm) || cellSizeMm <= 0) return null;
    return {width, height, centralMeridian, originX, originZ, cellSizeMm};
  }

  function activeStoreyParameters() {
    const profile = state.input?.document?.plan_profile || {};
    const frame = state.input?.coordinate_frame || state.input?.coordinateFrame || {};
    const cellSizeMm = Number(frame.modelCellSizeMm || (Number(frame.metersPerCell) * 1000)) || 1000;
    const elevationMm = Number(profile.storey_elevation_mm);
    const storeyBaseY = Number.isFinite(elevationMm) ? Math.floor(elevationMm / cellSizeMm) : 0;
    return {
      // Storey elevation describes the supporting floor/terrain plane. CAD
      // building blocks start one voxel above it so terrain is never replaced.
      base_y: storeyBaseY + 1,
      storey_base_y: storeyBaseY,
      storey_id: String(profile.storey_id || "ground_floor"),
    };
  }

  function centeredPeriodic(value, width) {
    return ((((value + width / 2) % width) + width) % width) - width / 2;
  }

  function wgs84MetresPerDegree(latitude) {
    const radians = Number(latitude) * Math.PI / 180;
    const semiMajorAxis = 6378137;
    const eccentricitySquared = 6.69437999014e-3;
    const sinLatitude = Math.sin(radians);
    const denominator = Math.sqrt(1 - eccentricitySquared * sinLatitude * sinLatitude);
    const primeVerticalRadius = semiMajorAxis / denominator;
    const meridionalRadius = semiMajorAxis * (1 - eccentricitySquared) / (denominator ** 3);
    return {
      latitude: Math.PI / 180 * meridionalRadius,
      longitude: Math.max(1, Math.PI / 180 * primeVerticalRadius * Math.cos(radians)),
    };
  }

  function lonLatToExactWorldModelMm(longitude, latitude) {
    const frame = exactCoordinateFrame();
    const lon = Number(longitude);
    const lat = Number(latitude);
    if (!frame || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    const longitudeDelta = centeredPeriodic(lon - frame.centralMeridian, 360);
    const gridX = longitudeDelta / 360 * frame.width;
    const gridZ = lat / 180 * frame.height;
    const localX = centeredPeriodic(gridX - frame.originX, frame.width);
    const localZ = gridZ - frame.originZ;
    return [localX * frame.cellSizeMm, localZ * frame.cellSizeMm];
  }

  function lonLatToMetricWorldModelMm(longitude, latitude) {
    const selection = state.parcelSelection;
    const origin = selection?.projectCoordinate;
    const lon = Number(longitude);
    const lat = Number(latitude);
    if (!origin || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    // The immutable earth-grid frame is used only to retain the storage-origin
    // offset. Distances themselves are calculated in a local metric tangent
    // plane. Treating longitude and latitude as equally sized degrees stretches
    // east/west geometry by about 1/cos(latitude), which is ~62% in Berlin.
    const frameAnchor = lonLatToExactWorldModelMm(origin.longitude, origin.latitude) || [0, 0];
    const metresPerDegree = wgs84MetresPerDegree(origin.latitude);
    const longitudeDelta = centeredPeriodic(lon - Number(origin.longitude), 360);
    const east = longitudeDelta * metresPerDegree.longitude;
    const north = (lat - Number(origin.latitude)) * metresPerDegree.latitude;
    return [frameAnchor[0] + east * 1000, frameAnchor[1] + north * 1000];
  }

  function lonLatToModelMm(longitude, latitude) {
    const metric = lonLatToMetricWorldModelMm(longitude, latitude);
    return metric ? [metric[0], -metric[1]] : null;
  }

  function lonLatToWorldModelMm(longitude, latitude) {
    return lonLatToMetricWorldModelMm(longitude, latitude);
  }

  function parcelModelPolygons(parcel) {
    return parcelPolygons(parcel).map((polygon) => (Array.isArray(polygon) ? polygon : [])
      .map((ring) => (Array.isArray(ring) ? ring : [])
        .map((coordinate) => lonLatToModelMm(coordinate?.[0], coordinate?.[1]))
        .filter(Boolean))
      .filter((ring) => ring.length >= 3))
      .filter((polygon) => polygon.length > 0);
  }

  function parcelWorldModelPolygons(parcel) {
    return parcelPolygons(parcel).map((polygon) => (Array.isArray(polygon) ? polygon : [])
      .map((ring) => (Array.isArray(ring) ? ring : [])
        .map((coordinate) => lonLatToWorldModelMm(coordinate?.[0], coordinate?.[1]))
        .filter(Boolean))
      .filter((ring) => ring.length >= 3))
      .filter((polygon) => polygon.length > 0);
  }

  function pointInRing(point, ring) {
    let inside = false;
    let previous = ring[ring.length - 1];
    for (const current of ring) {
      if ((current[1] > point[1]) !== (previous[1] > point[1])) {
        const crossing = ((previous[0] - current[0]) * (point[1] - current[1])
          / (previous[1] - current[1])) + current[0];
        if (point[0] < crossing) inside = !inside;
      }
      previous = current;
    }
    return inside;
  }

  function pointInParcelModel(point, parcel) {
    return parcelWorldModelPolygons(parcel).some((polygon) => pointInRing(point, polygon[0])
      && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
  }

  function visibleViewportPrimitives(viewport) {
    const primitives = viewport?.primitives || [];
    const selected = state.parcelSelection?.parcels || [];
    if (!selected.length || !state.parcelSelection?.projectCoordinate) return primitives;
    return primitives.filter((primitive) => {
      const bounds = primitiveModelBounds(primitive);
      if (!bounds) return true;
      const centre = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
      return selected.some((parcel) => pointInParcelModel(centre, parcel));
    });
  }

  function parcelContextBounds() {
    const parcels = [
      ...(state.parcelSelection?.parcels || []),
      ...(state.parcelSelection?.adjacentParcels || []),
    ];
    const points = parcels.flatMap((parcel) => parcelModelPolygons(parcel).flat(2));
    if (!points.length) return null;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    };
  }

  function parcelPathData(parcel) {
    return parcelModelPolygons(parcel).map((polygon) => polygon.map((ring) => ring
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`)
      .join(" ") + " Z").join(" ")).join(" ");
  }

  function parcelGridGuideKey(parcelId, start, end) {
    // Keep this byte-for-byte compatible with the 3D editor's
    // parcelGridGuideIdentity contract so the active guide survives the
    // CAD -> app -> editor synchronization round-trip.
    const token = (point) => `${Number(point[0]).toFixed(8)}:${Number(point[1]).toFixed(8)}`;
    const endpoints = [token(start), token(end)].sort();
    return `${parcelId}:${endpoints[0]}|${endpoints[1]}`;
  }

  function sameLonLat(first, second) {
    return Array.isArray(first) && Array.isArray(second)
      && Math.abs(Number(first[0]) - Number(second[0])) < 1e-7
      && Math.abs(Number(first[1]) - Number(second[1])) < 1e-7;
  }

  function persistedGuide(parcelId, start, end) {
    return (state.parcelSelection?.parcelGridState?.guides || []).find((guide) => (
      guide.parcelId === parcelId
      && ((sameLonLat(guide.startLonLat, start) && sameLonLat(guide.endLonLat, end))
        || (sameLonLat(guide.startLonLat, end) && sameLonLat(guide.endLonLat, start)))
    )) || null;
  }

  function signedRingArea(ring) {
    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      area += current[0] * next[1] - next[0] * current[1];
    }
    return area / 2;
  }

  function renderParcelContext(defs) {
    const selection = state.parcelSelection;
    if (!selection?.projectCoordinate) return;
    const group = svgEl("g", {class: "parcel-context", "aria-label": "Flurstuecksgrenzen"});
    selection.adjacentParcels.forEach((parcel) => {
      const d = parcelPathData(parcel);
      if (d) group.append(svgEl("path", {d, class: "parcel-boundary parcel-boundary-adjacent", "fill-rule": "evenodd"}));
    });
    selection.parcels.forEach((parcel) => {
      const d = parcelPathData(parcel);
      if (!d) return;
      const patternId = `parcel-grid-${String(parcel.parcelId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const clipId = `${patternId}-clip`;
      const clip = svgEl("clipPath", {id: clipId});
      clip.append(svgEl("path", {d, "fill-rule": "evenodd", "clip-rule": "evenodd"}));
      defs.append(clip);
      const pattern = svgEl("pattern", {
        id: patternId,
        width: 1000,
        height: 1000,
        patternUnits: "userSpaceOnUse",
        patternTransform: `rotate(${-selection.gridRotationDegrees})`,
      });
      pattern.append(svgEl("path", {d: "M 0 0 H 1000 M 0 0 V 1000", class: "parcel-grid-line"}));
      defs.append(pattern);
      group.append(svgEl("path", {
        d,
        class: "parcel-grid-surface",
        fill: `url(#${patternId})`,
        "fill-rule": "evenodd",
      }));

      const rawPolygons = parcelPolygons(parcel);
      const modelPolygons = parcelModelPolygons(parcel);
      rawPolygons.forEach((rawPolygon, polygonIndex) => {
        const rawRing = Array.isArray(rawPolygon?.[0]) ? [...rawPolygon[0]] : [];
        const modelRing = Array.isArray(modelPolygons?.[polygonIndex]?.[0]) ? [...modelPolygons[polygonIndex][0]] : [];
        if (rawRing.length > 1 && sameLonLat(rawRing[0], rawRing[rawRing.length - 1])) rawRing.pop();
        if (modelRing.length > 1 && Math.hypot(modelRing[0][0] - modelRing[modelRing.length - 1][0], modelRing[0][1] - modelRing[modelRing.length - 1][1]) < 0.001) modelRing.pop();
        if (rawRing.length !== modelRing.length || modelRing.length < 3) return;
        const orientation = signedRingArea(modelRing) >= 0 ? 1 : -1;
        for (let index = 0; index < modelRing.length; index += 1) {
          const start = modelRing[index];
          const end = modelRing[(index + 1) % modelRing.length];
          const rawStart = rawRing[index];
          const rawEnd = rawRing[(index + 1) % rawRing.length];
          const dx = end[0] - start[0];
          const dy = end[1] - start[1];
          const length = Math.hypot(dx, dy);
          if (length < 1) continue;
          const inward = orientation > 0 ? [-dy / length, dx / length] : [dy / length, -dx / length];
          const stored = persistedGuide(parcel.parcelId, rawStart, rawEnd);
          const depthMeters = stored?.depthMeters || selection.parcelGridState?.influenceMeters || 3;
          const offset = depthMeters * 1000;
          const guideKey = parcelGridGuideKey(parcel.parcelId, rawStart, rawEnd);
          const stripEndStart = [start[0] + inward[0] * offset, start[1] + inward[1] * offset];
          const stripEndEnd = [end[0] + inward[0] * offset, end[1] + inward[1] * offset];
          group.append(svgEl("polygon", {
            points: [start, end, stripEndEnd, stripEndStart].map((point) => point.join(",")).join(" "),
            class: "parcel-grid-boundary-strip",
            "clip-path": `url(#${clipId})`,
          }));
          const boundaryGrid = svgEl("g", {class: "parcel-grid-boundary-cells", "clip-path": `url(#${clipId})`});
          const depthRows = Math.min(128, Math.max(1, Math.ceil(depthMeters)));
          for (let row = 0; row <= depthRows; row += 1) {
            const rowOffset = Math.min(offset, row * offset / depthRows);
            boundaryGrid.append(svgEl("line", {
              x1: start[0] + inward[0] * rowOffset,
              y1: start[1] + inward[1] * rowOffset,
              x2: end[0] + inward[0] * rowOffset,
              y2: end[1] + inward[1] * rowOffset,
              class: "parcel-grid-boundary-cell",
            }));
          }
          const segmentColumns = Math.min(256, Math.max(1, Math.ceil(length / 1000)));
          for (let column = 0; column <= segmentColumns; column += 1) {
            const along = column / segmentColumns;
            const basePoint = [start[0] + dx * along, start[1] + dy * along];
            boundaryGrid.append(svgEl("line", {
              x1: basePoint[0],
              y1: basePoint[1],
              x2: basePoint[0] + inward[0] * offset,
              y2: basePoint[1] + inward[1] * offset,
              class: "parcel-grid-boundary-cell",
            }));
          }
          group.append(boundaryGrid);
          group.append(svgEl("line", {
            x1: stripEndStart[0],
            y1: stripEndStart[1],
            x2: stripEndEnd[0],
            y2: stripEndEnd[1],
            class: `parcel-grid-guide${selection.parcelGridState?.activeGuideKey === guideKey ? " is-active" : ""}`,
            "data-parcel-grid-guide-key": guideKey,
            "data-parcel-id": parcel.parcelId,
            "data-start-lon": rawStart[0],
            "data-start-lat": rawStart[1],
            "data-end-lon": rawEnd[0],
            "data-end-lat": rawEnd[1],
            "data-inward-x": inward[0],
            "data-inward-y": inward[1],
            "data-depth-meters": depthMeters,
          }));
        }
      });
      group.append(svgEl("path", {d, class: "parcel-boundary parcel-boundary-selected", "fill-rule": "evenodd"}));
    });
    if (group.childNodes.length) svg.append(group);
  }

  function showMessage(message, timeout = 3400) {
    const box = document.getElementById("workspace-message");
    box.textContent = message;
    box.hidden = false;
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => { box.hidden = true; }, timeout);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    let data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error(`Ungültige Serverantwort (HTTP ${response.status})`);
    }
    if (!response.ok) {
      const details = Array.isArray(data.errors) ? data.errors.join(" · ") : null;
      const nestedError = data.error && typeof data.error === "object"
        ? (data.error.message || data.error.code)
        : null;
      const errorCode = typeof data.error === "string" ? data.error : null;
      throw new Error(details || data.message || nestedError || errorCode || `HTTP ${response.status}`);
    }
    return data;
  }

  function currentSceneSheet() {
    return state.scene?.sheets?.find((sheet) => sheet.sheet_ref === state.activeSheetRef) || null;
  }

  function currentViewport() {
    const sheet = currentSceneSheet();
    return sheet?.viewports?.find((viewport) => viewport.viewport_ref === state.activeViewportRef)
      || sheet?.viewports?.find((viewport) => viewport.kind === "floor_plan")
      || null;
  }

  function groundFloorViewport(sheet = currentSceneSheet()) {
    return sheet?.viewports?.find((viewport) => viewport.kind === "floor_plan")
      || sheet?.viewports?.find((viewport) => viewport.kind !== "legend")
      || null;
  }

  async function loadBootstrap() {
    state.bootstrap = await fetchJson(`${routePrefix}/bootstrap`);
  }

  async function loadLibraryCatalog() {
    const status = document.getElementById("library-status");
    try {
      const catalog = await fetchJson(`${routePrefix}/library/catalog`);
      state.libraryCatalog = catalog;
      state.libraryItems = Array.isArray(catalog.items) ? catalog.items : [];
      if (status) status.textContent = `${state.libraryItems.length} freigegebene Library-Elemente · nur diese sind platzierbar`;
      renderLibraryFilters();
      renderLibraryGrid();
      syncQuickToolButtons();
    } catch (error) {
      state.libraryCatalog = null;
      state.libraryItems = [];
      if (status) status.textContent = "Creative Library nicht erreichbar · Modelländerungen sind gesperrt";
      renderLibraryFilters();
      renderLibraryGrid();
      syncQuickToolButtons();
      console.warn("Creative Library konnte nicht geladen werden", error);
    }
  }

  function libraryFilterLabel(value) {
    return {all: "Alle", linear: "Wände & Schichten", opening: "Fenster & Türen", object: "Bauteile", room: "Räume"}[value] || value;
  }

  function renderLibraryFilters() {
    const container = document.getElementById("library-filters");
    if (!container) return;
    container.replaceChildren();
    ["all", "linear", "opening", "object", "room"].forEach((filter) => {
      const count = filter === "all" ? state.libraryItems.length : state.libraryItems.filter((item) => item.placement_kind === filter).length;
      if (!count && filter !== "all") return;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${libraryFilterLabel(filter)} ${count}`;
      button.classList.toggle("is-active", state.libraryFilter === filter);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(state.libraryFilter === filter));
      button.addEventListener("click", () => {
        state.libraryFilter = filter;
        renderLibraryFilters();
        renderLibraryGrid();
      });
      container.append(button);
    });
  }

  function visibleLibraryItems() {
    const queryText = state.libraryQuery.trim().toLowerCase();
    return state.libraryItems.filter((item) => {
      if (state.libraryFilter !== "all" && item.placement_kind !== state.libraryFilter) return false;
      if (!queryText) return true;
      return [item.label, item.description, item.family_ref, item.category, item.subcategory]
        .some((value) => String(value || "").toLowerCase().includes(queryText));
    });
  }

  function libraryIcon(item) {
    if (item.placement_kind === "room") return "R";
    if (item.placement_kind === "opening") return String(item.label || "Ö").toLowerCase().includes("fenster") ? "F" : "T";
    if (item.placement_kind === "linear") return "W";
    return String(item.label || "B").replace(/[^A-Za-zÄÖÜäöü]/g, "").slice(0, 2).toUpperCase() || "B";
  }

  function renderLibraryGrid() {
    const grid = document.getElementById("library-grid");
    if (!grid) return;
    grid.replaceChildren();
    const items = visibleLibraryItems();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = state.libraryItems.length ? "Keine passenden Library-Elemente." : "Keine Library-Elemente verfügbar.";
      grid.append(empty);
      return;
    }
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cad-library-card";
      button.classList.toggle("is-selected", state.selectedLibraryItem?.family_ref === item.family_ref);
      const icon = document.createElement("span");
      icon.className = "cad-library-card__icon";
      icon.textContent = libraryIcon(item);
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = item.label;
      const detail = document.createElement("small");
      detail.textContent = item.placement_kind === "room" ? "WorldEdit · Energiezone" : `${item.domain || "Library"} · ${(item.variants || []).length} Varianten`;
      copy.append(title, detail);
      button.append(icon, copy);
      button.title = item.description || item.label;
      button.addEventListener("click", () => selectLibraryItem(item));
      grid.append(button);
    });
  }

  function selectLibraryItem(item) {
    state.selectedLibraryItem = item;
    const variants = Array.isArray(item.variants) ? item.variants : [];
    state.selectedLibraryVariant = variants.find((variant) => variant.variant_ref === item.variant_ref || variant.is_default) || variants[0] || null;
    const tool = item.placement_kind === "room" ? "room"
      : item.placement_kind === "opening" ? "opening"
        : item.placement_kind === "linear" ? "wall"
          : "library";
    syncLibrarySelectionUi();
    renderLibraryGrid();
    selectTool(tool);
    const panel = document.getElementById("library-panel");
    if (panel) panel.hidden = true;
    showMessage(`${item.label} aus der Creative Library ausgewählt.`);
  }

  function quickToolKindForItem(item) {
    if (!item) return "";
    const text = [item.label, item.family_ref, item.category, item.subcategory].join(" ").toLowerCase();
    if (text.includes("treppe") || text.includes("stair")) return "stair";
    if (item.family_ref === "world-edit.room" || item.world_edit_tool === "room") return "room";
    if (item.placement_kind === "opening") {
      return text.includes("fenster") || text.includes("window") ? "window" : "door";
    }
    if (item.placement_kind === "linear") return "wall";
    return "";
  }

  function quickLibraryItem(kind) {
    const preferredFamily = {
      wall: "vp.hochbau.waende.mauerwerkswaende.mauerwerkswand",
      window: "vp.hochbau.oeffnungen.fenster.standardfenster",
      door: "vp.hochbau.oeffnungen.innentueren.innentuer",
      room: "world-edit.room",
      stair: "vp.hochbau.treppen_rampen.treppenlaeufe.treppenbereich",
    }[kind];
    return state.libraryItems.find((item) => item.family_ref === preferredFamily)
      || state.libraryItems.find((item) => quickToolKindForItem(item) === kind)
      || null;
  }

  function syncQuickToolButtons() {
    const selectedKind = state.activeTool === "select" ? "" : quickToolKindForItem(state.selectedLibraryItem);
    document.querySelectorAll("[data-quick-tool]").forEach((button) => {
      const kind = button.dataset.quickTool;
      const available = Boolean(quickLibraryItem(kind));
      const active = available && kind === selectedKind;
      button.disabled = !available || projectContext.readOnly;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function activateQuickTool(kind) {
    const item = quickLibraryItem(kind);
    if (!item) {
      showMessage(`${kind === "door" ? "Tür" : kind === "window" ? "Fenster" : "Bauteil"} ist noch nicht in der Creative Library verfügbar.`);
      return;
    }
    selectLibraryItem(item);
  }

  function syncLibrarySelectionUi() {
    const item = state.selectedLibraryItem;
    const variant = state.selectedLibraryVariant;
    const summary = document.getElementById("active-library-item");
    if (summary) summary.hidden = !item;
    if (!item) return;
    const kind = document.getElementById("active-library-kind");
    const label = document.getElementById("active-library-label");
    const variantLabel = document.getElementById("active-library-variant");
    if (kind) kind.textContent = item.placement_kind === "room" ? "WorldEdit" : "Creative Library";
    if (label) label.textContent = item.label;
    if (variantLabel) variantLabel.textContent = variant?.label || variant?.variant_ref || "Standard";
    const select = document.getElementById("library-variant");
    if (select) {
      select.replaceChildren();
      (item.variants || []).forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.variant_ref;
        option.textContent = entry.label || entry.variant_ref;
        option.selected = entry.variant_ref === variant?.variant_ref;
        select.append(option);
      });
    }
    const dimensions = variant?.dimensions || item.dimensions || {};
    const thickness = document.getElementById("wall-thickness");
    if (thickness) thickness.value = String(Number(dimensions.thickness_mm) || Number(dimensions.depth_mm) || 0);
    syncQuickToolButtons();
  }

  function toggleLibrary() {
    const panel = document.getElementById("library-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) document.getElementById("library-search")?.focus();
  }

  function updateConnectionStatus({coreConnected, projectConnected, projectText}) {
    const coreRow = document.getElementById("core-status-row");
    const coreText = document.getElementById("core-status-text");
    const projectRow = document.getElementById("project-status-row");
    const projectStatusText = document.getElementById("project-status-text");

    coreRow?.querySelector(".status-dot")?.classList.toggle("is-ok", coreConnected);
    coreRow?.querySelector(".status-dot")?.classList.toggle("is-warning", !coreConnected);
    projectRow?.querySelector(".status-dot")?.classList.toggle("is-ok", projectConnected);
    projectRow?.querySelector(".status-dot")?.classList.toggle("is-warning", !projectConnected);
    if (coreText) coreText.textContent = coreConnected ? "Core verbunden" : "Core nicht verbunden";
    if (projectStatusText) projectStatusText.textContent = projectText;
  }

  async function activateProjection(input, message, options = {}) {
    if (!input || !Array.isArray(input.sheets)) {
      throw new Error("Core hat keine gültige CAD-Projektion geliefert.");
    }
    state.input = input;
    state.activeSheetRef = input.sheets[0]?.sheet_ref || null;
    state.activeViewportRef = input.sheets[0]?.viewports?.find((viewport) => viewport.kind === "floor_plan")?.viewport_ref || null;
    state.selectedPrimitive = null;
    if (!options.preserveHistory) {
      state.commands = [];
      state.redoCommands = [];
      state.worldSelection = null;
    }
    if (!options.preserveCamera) {
      state.camera = null;
      state.baseCameraWidth = null;
    }
    state.visibleLayers.clear();
    state.knownLayers.clear();
    cancelDrawing(false);
    await refreshProjection();
    if (message) showMessage(message);
  }

  async function loadTestInput() {
    const input = await fetchJson(`${routePrefix}/test-input`);
    await activateProjection(input, "Musterprojekt geladen. Änderungen bleiben lokal in diesem Browser-Tab.");
    updateConnectionStatus({
      coreConnected: false,
      projectConnected: false,
      projectText: "Expliziter Musterbetrieb",
    });
  }

  async function loadProjectInput(options = {}) {
    const loadSequence = ++state.projectionLoadSequence;
    const requestedParcelSignature = parcelSelectionSignature();
    const result = await fetchJson(
      `${routePrefix}/core/projects/${encodeURIComponent(projectContext.coreProjectId)}/projection`,
      {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          projectionKey: "semantic-floor-plan-v1",
          options: {
            viewKind: "floor_plan",
            representationMode: "semantic-construction",
          },
          parcelSelection: state.parcelSelection,
        }),
      },
    );
    if (loadSequence !== state.projectionLoadSequence) return;
    const fingerprint = String(result?.snapshot?.sourceFingerprint || result?.snapshot?.etag || "");
    if (options.background && fingerprint && fingerprint === state.sharedModelFingerprint) return;
    const input = result?.snapshot?.projection;
    const statistics = result?.snapshot?.statistics || {};
    const userPlacementMode = statistics.sourceMode === "current-user-authored-cells"
      || statistics.discoveryMode === "current-user-authored-cells";
    const semanticMode = statistics.sourceMode === "semantic-construction-model";
    const userPlacementCount = Number(statistics.userPlacementCount ?? statistics.placementCount ?? 0);
    const constructionElementCount = Number(statistics.constructionElementCount ?? statistics.elementCount ?? 0);
    const projectLabel = projectContext.projectPublicId || projectContext.coreProjectId;
    const loadedMessage = userPlacementMode && userPlacementCount === 0
      ? "Keine serverseitig gesetzten Benutzerblöcke vorhanden. Systemgelände ist ausgeblendet."
      : semanticMode
        ? `${userPlacementCount} gesetzte Benutzerblöcke wurden zu ${constructionElementCount} Bauwerksobjekten zusammengefasst.`
        : userPlacementMode
        ? `${userPlacementCount} gesetzte Benutzerblöcke für Projekt ${projectLabel} geladen.`
        : `Projekt ${projectLabel} aus Chunk-Daten geladen.`;
    await activateProjection(
      input,
      options.background ? "" : loadedMessage,
      {
        preserveCamera: options.background || options.preserveCamera,
        preserveHistory: options.background || options.preserveHistory,
      },
    );
    state.sharedModelFingerprint = fingerprint;
    state.projectInputLoaded = true;
    state.lastProjectionParcelSignature = requestedParcelSignature;
    updateConnectionStatus({
      coreConnected: true,
      projectConnected: true,
      projectText: semanticMode
        ? `Projekt ${projectLabel} verbunden · ${constructionElementCount} Bauwerksobjekte aus ${userPlacementCount} Benutzerblöcken`
        : userPlacementMode
        ? `Projekt ${projectLabel} verbunden · ${userPlacementCount} Benutzerblöcke`
        : `Projekt ${projectLabel} verbunden`,
    });
    if (parcelSelectionSignature() !== requestedParcelSignature) scheduleParcelProjectionReload();
  }

  function startSharedModelPolling() {
    if (!projectContext.coreProjectId || state.sharedModelPollTimer) return;
    state.sharedModelPollTimer = window.setInterval(async () => {
      if (state.sharedModelPollBusy || document.hidden || state.drawStart) return;
      state.sharedModelPollBusy = true;
      try {
        await loadProjectInput({background: true, preserveCamera: true, preserveHistory: true});
      } catch (error) {
        console.warn("Gemeinsames CAD-/3D-Modell konnte nicht aktualisiert werden", error);
      } finally {
        state.sharedModelPollBusy = false;
      }
    }, 1500);
  }

  function scheduleParcelProjectionReload() {
    if (!projectContext.coreProjectId || !state.projectInputLoaded) return;
    window.clearTimeout(state.parcelReloadTimer);
    state.parcelReloadTimer = window.setTimeout(() => {
      if (state.lastProjectionParcelSignature === parcelSelectionSignature()) return;
      loadProjectInput().catch(handleError);
    }, 180);
  }

  async function refreshProjection() {
    const preview = await fetchJson(`${routePrefix}/preview`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(state.input),
    });
    state.input = preview.projection;
    state.scene = preview.scene;
    const viewport = groundFloorViewport();
    if (viewport) state.activeViewportRef = viewport.viewport_ref;
    syncKnownLayers();
    if (!state.camera) fitGroundFloor(false);
    renderAll();
  }

  function syncKnownLayers() {
    state.scene?.sheets?.forEach((sheet) => {
      sheet.layers?.forEach((layer) => {
        if (!state.knownLayers.has(layer.layer_ref)) {
          state.knownLayers.add(layer.layer_ref);
          state.visibleLayers.add(layer.layer_ref);
        }
      });
    });
  }

  function renderAll() {
    renderPlan();
    renderPlanSummary();
    renderInspector();
    renderCommandLog();
    syncHistoryButtons();
  }

  function renderPlanSummary() {
    const summary = document.getElementById("plan-summary");
    const viewport = currentViewport();
    if (!summary || !viewport) return;
    const primitives = visibleViewportPrimitives(viewport);
    const counts = new Map();
    let reviewCount = 0;
    primitives.forEach((primitive) => {
      const role = String(primitive.metadata?.semantic_role || primitive.source_kind || "component").toLowerCase();
      counts.set(role, (counts.get(role) || 0) + 1);
      if (role === "unknown" || (primitive.metadata?.warnings || []).length) reviewCount += 1;
    });
    const labels = {
      wall: "Wände",
      door: "Türen",
      window: "Fenster",
      opening: "Öffnungen",
      stair: "Treppen",
      slab: "Decken",
      roof: "Dächer",
      column: "Stützen",
      beam: "Träger",
      room: "Räume",
      component: "Bauteile",
    };
    summary.replaceChildren();
    const total = document.createElement("strong");
    total.textContent = `${primitives.length} Bauwerksobjekte`;
    summary.append(total);
    Object.entries(labels).forEach(([role, label]) => {
      const count = counts.get(role) || 0;
      if (!count) return;
      const chip = document.createElement("span");
      chip.textContent = `${count} ${label}`;
      summary.append(chip);
    });
    if (reviewCount) {
      const warning = document.createElement("span");
      warning.className = "is-warning";
      warning.textContent = `${reviewCount} prüfen`;
      summary.append(warning);
    }
    summary.hidden = primitives.length === 0;
  }

  function modelPointToNorthUp(point) {
    if (!Array.isArray(point) || !Number.isFinite(Number(point[0])) || !Number.isFinite(Number(point[1]))) return [0, 0];
    if (!state.parcelSelection?.projectCoordinate) return [Number(point[0]), Number(point[1])];
    const x = Number(point[0]);
    const z = Number(point[1]);
    return [x, -z];
  }

  function northUpPointToModel(point) {
    if (!state.parcelSelection?.projectCoordinate) return [Number(point[0]) || 0, Number(point[1]) || 0];
    const east = Number(point[0]) || 0;
    const north = -(Number(point[1]) || 0);
    return [east, north];
  }

  function northUpPrimitive(primitive) {
    const source = primitive?.geometry || {};
    const geometry = {...source};
    let primitiveType = primitive.primitive_type;
    if (primitiveType === "room") {
      const x = Number(source.x_mm) || 0;
      const y = Number(source.y_mm) || 0;
      const width = Number(source.width_mm) || 0;
      const depth = Number(source.depth_mm) || 0;
      const points = [[x, y], [x + width, y], [x + width, y + depth], [x, y + depth]].map(modelPointToNorthUp);
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      geometry.x_mm = Math.min(...xs);
      geometry.y_mm = Math.min(...ys);
      geometry.width_mm = Math.max(...xs) - geometry.x_mm;
      geometry.depth_mm = Math.max(...ys) - geometry.y_mm;
    } else if (primitiveType === "rect") {
      const x = Number(source.x_mm) || 0;
      const y = Number(source.y_mm) || 0;
      const width = Number(source.width_mm) || 0;
      const height = Number(source.height_mm) || 0;
      primitiveType = "polygon";
      geometry.points_mm = [
        [x, y], [x + width, y], [x + width, y + height], [x, y + height],
      ].map(modelPointToNorthUp);
    } else if (primitiveType === "polygon") {
      geometry.points_mm = (source.points_mm || []).map(modelPointToNorthUp);
    } else if (primitiveType === "thick_path") {
      geometry.path_mm = (source.path_mm || []).map(modelPointToNorthUp);
    } else if (primitiveType === "thick_segments") {
      geometry.segments_mm = (source.segments_mm || []).map((segment) => segment.map(modelPointToNorthUp));
      geometry.paths_mm = (source.paths_mm || []).map((path) => path.map(modelPointToNorthUp));
    } else if (primitiveType === "thick_arc") {
      geometry.center_mm = modelPointToNorthUp(source.center_mm || [0, 0]);
      geometry.start_angle_deg = -(Number(source.start_angle_deg) || 0);
      geometry.sweep_angle_deg = -(Number(source.sweep_angle_deg) || 0);
    } else if (["line", "dimension"].includes(primitiveType)) {
      geometry.start_mm = modelPointToNorthUp(source.start_mm || [0, 0]);
      geometry.end_mm = modelPointToNorthUp(source.end_mm || [0, 0]);
    } else if (Number.isFinite(Number(source.x_mm)) && Number.isFinite(Number(source.y_mm))) {
      [geometry.x_mm, geometry.y_mm] = modelPointToNorthUp([source.x_mm, source.y_mm]);
    }
    return {...primitive, primitive_type: primitiveType, geometry};
  }

  function northUpBounds(bounds) {
    if (!bounds) return null;
    const points = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.width, bounds.y],
      [bounds.x + bounds.width, bounds.y + bounds.height],
      [bounds.x, bounds.y + bounds.height],
    ].map(modelPointToNorthUp);
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
    };
  }

  function primitiveModelBounds(primitive) {
    const geometry = primitive?.geometry || {};
    let points = [];
    let padding = Number(geometry.thickness_mm) / 2 || 0;
    if (primitive.primitive_type === "rect") {
      return {
        x: geometry.x_mm,
        y: geometry.y_mm,
        width: geometry.width_mm,
        height: geometry.height_mm,
      };
    }
    if (primitive.primitive_type === "room") {
      return {
        x: geometry.x_mm,
        y: geometry.y_mm,
        width: geometry.width_mm,
        height: geometry.depth_mm,
      };
    }
    if (primitive.primitive_type === "polygon") points = geometry.points_mm || [];
    else if (primitive.primitive_type === "thick_path") points = geometry.path_mm || [];
    else if (primitive.primitive_type === "thick_segments") points = (geometry.segments_mm || []).flat();
    else if (primitive.primitive_type === "thick_arc") {
      const [cx, cy] = geometry.center_mm || [0, 0];
      const radius = Number(geometry.radius_mm) || 0;
      return {x: cx - radius - padding, y: cy - radius - padding, width: (radius + padding) * 2, height: (radius + padding) * 2};
    } else if (["line", "dimension"].includes(primitive.primitive_type)) {
      points = [geometry.start_mm, geometry.end_mm];
    }
    points = points.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (!points.length) return null;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    return {x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY)};
  }

  function focusedProjectionBounds(viewport) {
    const assetKind = state.input?.document?.plan_profile?.asset_kind;
    if (!["user_authored_cells", "semantic_construction_model"].includes(assetKind)) return null;
    const rectangles = visibleViewportPrimitives(viewport).map(northUpPrimitive).map(primitiveModelBounds).filter(Boolean);
    if (rectangles.length < 12) return null;

    const xCenters = rectangles
      .map((geometry) => geometry.x + geometry.width / 2)
      .sort((left, right) => left - right);
    const yCenters = rectangles
      .map((geometry) => geometry.y + geometry.height / 2)
      .sort((left, right) => left - right);
    const trimRatio = assetKind === "semantic_construction_model" ? 0.08 : 0.05;
    const trim = Math.max(1, Math.floor(rectangles.length * trimRatio));
    const minCellWidth = Math.min(...rectangles.map((geometry) => geometry.width));
    const minCellHeight = Math.min(...rectangles.map((geometry) => geometry.height));
    let minX = xCenters[trim] - minCellWidth / 2;
    let maxX = xCenters[xCenters.length - trim - 1] + minCellWidth / 2;
    let minY = yCenters[trim] - minCellHeight / 2;
    let maxY = yCenters[yCenters.length - trim - 1] + minCellHeight / 2;
    const minimumSpan = Math.max(12000, Math.max(minCellWidth, minCellHeight) * 12);
    if (maxX - minX < minimumSpan) {
      const centerX = (minX + maxX) / 2;
      minX = centerX - minimumSpan / 2;
      maxX = centerX + minimumSpan / 2;
    }
    if (maxY - minY < minimumSpan) {
      const centerY = (minY + maxY) / 2;
      minY = centerY - minimumSpan / 2;
      maxY = centerY + minimumSpan / 2;
    }

    const completeBounds = northUpBounds(viewport?.model_view_box_mm);
    const focusedWidth = maxX - minX;
    const focusedHeight = maxY - minY;
    if (completeBounds
      && completeBounds.width <= focusedWidth * 1.8
      && completeBounds.height <= focusedHeight * 1.8) {
      return null;
    }
    return {x: minX, y: minY, width: focusedWidth, height: focusedHeight};
  }

  function viewportCamera(viewport) {
    let bounds = focusedProjectionBounds(viewport) || northUpBounds(viewport?.model_view_box_mm);
    const parcelBounds = parcelContextBounds();
    if (parcelBounds && bounds) {
      const minX = Math.min(bounds.x, parcelBounds.x);
      const minY = Math.min(bounds.y, parcelBounds.y);
      const maxX = Math.max(bounds.x + bounds.width, parcelBounds.x + parcelBounds.width);
      const maxY = Math.max(bounds.y + bounds.height, parcelBounds.y + parcelBounds.height);
      bounds = {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
    } else if (parcelBounds) {
      bounds = parcelBounds;
    }
    if (!bounds) return {x: -1000, y: -1000, width: 16000, height: 12000};
    const paddedWidth = bounds.width * 1.2;
    const paddedHeight = bounds.height * 1.2;
    const aspect = Math.max(svg.clientWidth, 1) / Math.max(svg.clientHeight, 1);
    let width = paddedWidth;
    let height = paddedHeight;
    if (width / height < aspect) width = height * aspect;
    else height = width / aspect;
    return {
      x: bounds.x - (width - bounds.width) / 2,
      y: bounds.y - (height - bounds.height) / 2,
      width,
      height,
    };
  }

  function fitGroundFloor(render = true) {
    const viewport = currentViewport();
    if (!viewport) return;
    state.camera = viewportCamera(viewport);
    state.baseCameraWidth = state.camera.width;
    if (render) renderPlan();
  }

  function renderPlan() {
    svg.replaceChildren();
    const viewport = currentViewport();
    if (!viewport) return;
    if (!state.camera) fitGroundFloor(false);
    const camera = state.camera;
    svg.setAttribute("viewBox", `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
    svg.setAttribute("aria-label", "Erdgeschoss-Grundriss auf unbegrenzter Modellfläche");

    const defs = svgEl("defs");
    const minorPattern = svgEl("pattern", {id: "workspace-grid-minor", width: 500, height: 500, patternUnits: "userSpaceOnUse"});
    minorPattern.append(svgEl("path", {d: "M 500 0 L 0 0 0 500", class: "workspace-grid-minor"}));
    const majorPattern = svgEl("pattern", {id: "workspace-grid-major", width: 5000, height: 5000, patternUnits: "userSpaceOnUse"});
    majorPattern.append(svgEl("path", {d: "M 5000 0 L 0 0 0 5000", class: "workspace-grid-major"}));
    const slabPattern = svgEl("pattern", {id: "cad-slab-hatch", width: 420, height: 420, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"});
    slabPattern.append(svgEl("line", {x1: 0, y1: 0, x2: 0, y2: 420, class: "slab-hatch-line"}));
    const roofPattern = svgEl("pattern", {id: "cad-roof-hatch", width: 620, height: 620, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-45)"});
    roofPattern.append(svgEl("line", {x1: 0, y1: 0, x2: 0, y2: 620, class: "roof-hatch-line"}));
    defs.append(minorPattern, majorPattern, slabPattern, roofPattern);
    svg.append(defs);
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, class: "workspace-plane"}));
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, fill: "url(#workspace-grid-minor)"}));
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, fill: "url(#workspace-grid-major)"}));
    renderParcelContext(defs);

    const bounds = viewport.model_view_box_mm;
    if (bounds) {
      const framePoints = [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
        [bounds.x, bounds.y + bounds.height],
      ].map(modelPointToNorthUp);
      const displayBounds = northUpBounds(bounds);
      svg.append(svgEl("polygon", {points: framePoints.map((point) => point.join(",")).join(" "), class: "model-frame"}));
      svg.append(svgEl("text", {x: displayBounds.x + 120, y: displayBounds.y - 220, class: "model-frame-label"}, "ERDGESCHOSS · MODELLBEREICH"));
    }
    visibleViewportPrimitives(viewport)
      .map(northUpPrimitive)
      .sort((left, right) => (renderStyleOrder[left.style_ref] ?? 50) - (renderStyleOrder[right.style_ref] ?? 50))
      .forEach((primitive) => svg.append(renderPrimitive(primitive)));
    renderWorldSelection();
    renderDraft();
  }
  function renderPrimitive(primitive) {
    const geometry = primitive.geometry;
    let node;
    if (primitive.primitive_type === "polygon") {
      if (primitive.style_ref === "door") node = renderDoorPrimitive(primitive);
      else if (primitive.style_ref === "window") node = renderWindowPrimitive(primitive);
      else if (primitive.style_ref === "stair") node = renderStairPrimitive(primitive);
      else node = svgEl("polygon", {points: geometry.points_mm.map((point) => point.join(",")).join(" ")});
    } else if (primitive.primitive_type === "thick_path") {
      node = renderThickPathPrimitive(primitive);
    } else if (primitive.primitive_type === "thick_segments") {
      node = renderThickSegmentsPrimitive(primitive);
    } else if (primitive.primitive_type === "thick_arc") {
      node = renderThickArcPrimitive(primitive);
    } else if (primitive.primitive_type === "rect") {
      node = svgEl("rect", {x: geometry.x_mm, y: geometry.y_mm, width: geometry.width_mm, height: geometry.height_mm});
    } else if (primitive.primitive_type === "line") {
      node = renderLinePrimitive(primitive);
    } else if (primitive.primitive_type === "dimension") {
      node = renderDimensionPrimitive(primitive);
    } else if (primitive.primitive_type === "room") {
      node = renderRoomPrimitive(primitive);
    } else {
      node = renderTextPrimitive(primitive);
    }
    node.classList.add("primitive", `primitive-${primitive.style_ref || "line"}`);
    node.dataset.elementRef = primitive.primitive_ref;
    node.dataset.layer = primitive.layer_ref;
    if (primitive.metadata?.local_draft) node.classList.add("local-draft");
    if (!state.visibleLayers.has(primitive.layer_ref)) node.classList.add("layer-hidden");
    if (state.selectedPrimitive?.primitive_ref === primitive.primitive_ref) node.classList.add("is-selected");
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || state.activeTool !== "select" || state.spacePressed) return;
      if (event.pointerType !== "touch") event.stopPropagation();
      state.selectedPrimitive = primitive;
      renderPlan();
      renderInspector();
    });
    return node;
  }

  function polygonPoints(primitive) {
    const points = (primitive.geometry?.points_mm || [])
      .filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map((point) => [Number(point[0]), Number(point[1])]);
    if (points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) points.pop();
    }
    return points;
  }

  function polygonFrame(primitive) {
    const points = polygonPoints(primitive);
    if (points.length !== 4) return null;
    let longestIndex = 0;
    let longestLength = -1;
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
      if (length > longestLength) {
        longestLength = length;
        longestIndex = index;
      }
    });
    return {
      a: points[longestIndex],
      b: points[(longestIndex + 1) % 4],
      c: points[(longestIndex + 2) % 4],
      d: points[(longestIndex + 3) % 4],
      length: longestLength,
      points,
    };
  }

  function polygonNode(points, className) {
    return svgEl("polygon", {
      points: points.map((point) => point.join(",")).join(" "),
      class: className,
    });
  }

  function interpolatePoint(start, end, ratio) {
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ];
  }

  function renderDoorPrimitive(primitive) {
    const group = svgEl("g");
    const frame = polygonFrame(primitive);
    const points = polygonPoints(primitive);
    group.append(polygonNode(points, "architectural-symbol-base"));
    if (!frame || frame.length <= 0) return group;
    const side = [frame.d[0] - frame.a[0], frame.d[1] - frame.a[1]];
    const sideLength = Math.hypot(side[0], side[1]);
    const normal = sideLength > 1e-6
      ? [side[0] / sideLength, side[1] / sideLength]
      : [-(frame.b[1] - frame.a[1]) / frame.length, (frame.b[0] - frame.a[0]) / frame.length];
    const leafEnd = [frame.a[0] + normal[0] * frame.length, frame.a[1] + normal[1] * frame.length];
    const closedVector = [frame.b[0] - frame.a[0], frame.b[1] - frame.a[1]];
    const leafVector = [leafEnd[0] - frame.a[0], leafEnd[1] - frame.a[1]];
    const sweepFlag = closedVector[0] * leafVector[1] - closedVector[1] * leafVector[0] >= 0 ? 1 : 0;
    group.append(
      svgEl("line", {x1: frame.a[0], y1: frame.a[1], x2: leafEnd[0], y2: leafEnd[1], class: "door-leaf"}),
      svgEl("path", {d: `M ${frame.b[0]} ${frame.b[1]} A ${frame.length} ${frame.length} 0 0 ${sweepFlag} ${leafEnd[0]} ${leafEnd[1]}`, class: "door-swing"}),
      svgEl("circle", {cx: frame.a[0], cy: frame.a[1], r: Math.max(35, frame.length * 0.035), class: "door-hinge"}),
    );
    return group;
  }

  function renderWindowPrimitive(primitive) {
    const group = svgEl("g");
    const frame = polygonFrame(primitive);
    const points = polygonPoints(primitive);
    group.append(polygonNode(points, "architectural-symbol-base"));
    if (!frame) return group;
    const centreStart = interpolatePoint(frame.a, frame.d, 0.5);
    const centreEnd = interpolatePoint(frame.b, frame.c, 0.5);
    const side = [frame.d[0] - frame.a[0], frame.d[1] - frame.a[1]];
    const lines = [-0.22, 0.22].map((offset) => ({
      start: [centreStart[0] + side[0] * offset, centreStart[1] + side[1] * offset],
      end: [centreEnd[0] + side[0] * offset, centreEnd[1] + side[1] * offset],
    }));
    lines.forEach(({start, end}) => group.append(svgEl("line", {
      x1: start[0], y1: start[1], x2: end[0], y2: end[1], class: "window-glazing",
    })));
    return group;
  }

  function renderStairPrimitive(primitive) {
    const group = svgEl("g");
    const frame = polygonFrame(primitive);
    const points = polygonPoints(primitive);
    group.append(polygonNode(points, "architectural-symbol-base"));
    if (!frame) return group;
    for (let index = 1; index < 9; index += 1) {
      const ratio = index / 9;
      const start = interpolatePoint(frame.a, frame.b, ratio);
      const end = interpolatePoint(frame.d, frame.c, ratio);
      group.append(svgEl("line", {x1: start[0], y1: start[1], x2: end[0], y2: end[1], class: "stair-tread"}));
    }
    const startA = interpolatePoint(frame.a, frame.b, 0.16);
    const startB = interpolatePoint(frame.d, frame.c, 0.16);
    const endA = interpolatePoint(frame.a, frame.b, 0.84);
    const endB = interpolatePoint(frame.d, frame.c, 0.84);
    const arrowStart = interpolatePoint(startA, startB, 0.5);
    const arrowEnd = interpolatePoint(endA, endB, 0.5);
    const arrowLength = Math.hypot(arrowEnd[0] - arrowStart[0], arrowEnd[1] - arrowStart[1]) || 1;
    const ux = (arrowEnd[0] - arrowStart[0]) / arrowLength;
    const uy = (arrowEnd[1] - arrowStart[1]) / arrowLength;
    const arrowSize = Math.max(80, Math.min(260, frame.length * 0.08));
    group.append(
      svgEl("line", {x1: arrowStart[0], y1: arrowStart[1], x2: arrowEnd[0], y2: arrowEnd[1], class: "stair-direction"}),
      polygonNode([
        arrowEnd,
        [arrowEnd[0] - ux * arrowSize - uy * arrowSize * 0.55, arrowEnd[1] - uy * arrowSize + ux * arrowSize * 0.55],
        [arrowEnd[0] - ux * arrowSize + uy * arrowSize * 0.55, arrowEnd[1] - uy * arrowSize - ux * arrowSize * 0.55],
      ], "stair-arrow"),
    );
    return group;
  }

  function renderRoomPrimitive(primitive) {
    const geometry = primitive.geometry || {};
    const x = Number(geometry.x_mm) || 0;
    const y = Number(geometry.y_mm) || 0;
    const width = Number(geometry.width_mm) || 1;
    const depth = Number(geometry.depth_mm) || 1;
    const group = svgEl("g");
    group.append(svgEl("rect", {x, y, width, height: depth, class: "room-fill"}));
    const lines = String(primitive.text || primitive.metadata?.label || "Raum").split("\n");
    group.append(svgEl("text", {x: x + width / 2, y: y + depth / 2 - 45, class: "room-label"}, lines[0] || "Raum"));
    group.append(svgEl("text", {x: x + width / 2, y: y + depth / 2 + 155, class: "room-area"}, lines[1] || `${Number(geometry.area_m2 || 0).toFixed(2)} m²`));
    return group;
  }

  function semanticStrokePair(thickness) {
    const border = Math.max(24, thickness * 0.035);
    return {
      group: svgEl("g"),
      outlineWidth: thickness + border * 2,
      fillWidth: thickness,
    };
  }

  function semanticStrokeNode(name, attrs, className, width, linecap = "square", linejoin = "miter") {
    return svgEl(name, {
      ...attrs,
      class: className,
      "stroke-width": width,
      "stroke-linejoin": linejoin,
      "stroke-linecap": linecap,
      "stroke-miterlimit": 4,
      fill: "none",
    });
  }

  function renderThickPathPrimitive(primitive) {
    const geometry = primitive.geometry;
    const thickness = Number(geometry.thickness_mm) || 1;
    const points = (geometry.path_mm || []).map((point) => point.join(",")).join(" ");
    const pair = semanticStrokePair(thickness);
    pair.group.append(
      semanticStrokeNode("polyline", {points}, "semantic-outline", pair.outlineWidth),
      semanticStrokeNode("polyline", {points}, "semantic-fill", pair.fillWidth),
    );
    return pair.group;
  }

  function renderThickSegmentsPrimitive(primitive) {
    const geometry = primitive.geometry;
    const thickness = Number(geometry.thickness_mm) || 1;
    const pair = semanticStrokePair(thickness);
    const outlines = svgEl("g");
    const fills = svgEl("g");
    const paths = (geometry.paths_mm?.length ? geometry.paths_mm : deriveNetworkPaths(geometry.segments_mm || []))
      .slice()
      .sort((left, right) => networkPathLength(left) - networkPathLength(right));
    paths.forEach((path) => {
      const attrs = {points: path.map((point) => point.join(",")).join(" ")};
      outlines.append(semanticStrokeNode("polyline", attrs, "semantic-outline", pair.outlineWidth));
      fills.append(semanticStrokeNode("polyline", attrs, "semantic-fill", pair.fillWidth));
    });
    pair.group.append(outlines, fills);
    return pair.group;
  }

  function networkPathLength(path) {
    return path.slice(1).reduce((total, point, index) => {
      const previous = path[index];
      return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    }, 0);
  }

  function deriveNetworkPaths(segments) {
    const pointByKey = new Map();
    const neighbors = new Map();
    const pointKey = (point) => `${point[0]}:${point[1]}`;
    const edgeKey = (first, second) => [first, second].sort().join("|");
    segments.forEach(([start, end]) => {
      const startKey = pointKey(start);
      const endKey = pointKey(end);
      pointByKey.set(startKey, start);
      pointByKey.set(endKey, end);
      if (!neighbors.has(startKey)) neighbors.set(startKey, new Set());
      if (!neighbors.has(endKey)) neighbors.set(endKey, new Set());
      neighbors.get(startKey).add(endKey);
      neighbors.get(endKey).add(startKey);
    });
    const continuations = new Map();
    neighbors.forEach((neighborSet, nodeKey) => {
      const node = pointByKey.get(nodeKey);
      const remaining = new Set(neighborSet);
      const paired = new Map();
      while (remaining.size >= 2) {
        const candidates = [];
        const values = [...remaining].sort();
        values.forEach((firstKey, firstIndex) => {
          const first = pointByKey.get(firstKey);
          const firstLength = Math.hypot(first[0] - node[0], first[1] - node[1]) || 1;
          values.slice(firstIndex + 1).forEach((secondKey) => {
            const second = pointByKey.get(secondKey);
            const secondLength = Math.hypot(second[0] - node[0], second[1] - node[1]) || 1;
            const dot = ((first[0] - node[0]) * (second[0] - node[0])
              + (first[1] - node[1]) * (second[1] - node[1])) / (firstLength * secondLength);
            candidates.push({dot, firstKey, secondKey});
          });
        });
        candidates.sort((left, right) => left.dot - right.dot
          || left.firstKey.localeCompare(right.firstKey)
          || left.secondKey.localeCompare(right.secondKey));
        const best = candidates[0];
        if (!best) break;
        paired.set(best.firstKey, best.secondKey);
        paired.set(best.secondKey, best.firstKey);
        remaining.delete(best.firstKey);
        remaining.delete(best.secondKey);
      }
      continuations.set(nodeKey, paired);
    });

    const used = new Set();
    const trace = (startKey, followingKey) => {
      const path = [pointByKey.get(startKey)];
      let previousKey = startKey;
      let currentKey = followingKey;
      while (!used.has(edgeKey(previousKey, currentKey))) {
        used.add(edgeKey(previousKey, currentKey));
        path.push(pointByKey.get(currentKey));
        const nextKey = continuations.get(currentKey)?.get(previousKey);
        if (!nextKey || used.has(edgeKey(currentKey, nextKey))) break;
        previousKey = currentKey;
        currentKey = nextKey;
      }
      return path;
    };
    const paths = [];
    const starts = [];
    neighbors.forEach((neighborSet, nodeKey) => {
      neighborSet.forEach((neighborKey) => {
        if (!continuations.get(nodeKey)?.has(neighborKey)) starts.push([nodeKey, neighborKey]);
      });
    });
    starts.sort((left, right) => left.join("|").localeCompare(right.join("|"))).forEach(([startKey, followingKey]) => {
      if (!used.has(edgeKey(startKey, followingKey))) paths.push(trace(startKey, followingKey));
    });
    segments.forEach(([start, end]) => {
      const startKey = pointKey(start);
      const endKey = pointKey(end);
      if (!used.has(edgeKey(startKey, endKey))) paths.push(trace(startKey, endKey));
    });
    return paths;
  }

  function arcPath(geometry) {
    const [cx, cy] = geometry.center_mm;
    const radius = Number(geometry.radius_mm) || 1;
    const start = Number(geometry.start_angle_deg) || 0;
    const sweep = Number(geometry.sweep_angle_deg) || 0;
    if (Math.abs(sweep) >= 359.999) {
      return `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;
    }
    const radians = (start * Math.PI) / 180;
    const endRadians = ((start + sweep) * Math.PI) / 180;
    const startPoint = [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius];
    const endPoint = [cx + Math.cos(endRadians) * radius, cy + Math.sin(endRadians) * radius];
    const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
    const sweepFlag = sweep >= 0 ? 1 : 0;
    return `M ${startPoint[0]} ${startPoint[1]} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${endPoint[0]} ${endPoint[1]}`;
  }

  function renderThickArcPrimitive(primitive) {
    const geometry = primitive.geometry;
    const thickness = Number(geometry.thickness_mm) || 1;
    const pair = semanticStrokePair(thickness);
    const d = arcPath(geometry);
    pair.group.append(
      semanticStrokeNode("path", {d}, "semantic-outline", pair.outlineWidth),
      semanticStrokeNode("path", {d}, "semantic-fill", pair.fillWidth),
    );
    return pair.group;
  }

  function renderLinePrimitive(primitive) {
    const geometry = primitive.geometry;
    const line = svgEl("line", {
      x1: geometry.start_mm[0], y1: geometry.start_mm[1],
      x2: geometry.end_mm[0], y2: geometry.end_mm[1],
    });
    if (!primitive.text) return line;
    const group = svgEl("g");
    group.append(line);
    group.append(svgEl("circle", {cx: geometry.start_mm[0], cy: geometry.start_mm[1], r: 90, fill: "#fff"}));
    group.append(svgEl("circle", {cx: geometry.end_mm[0], cy: geometry.end_mm[1], r: 90, fill: "#fff"}));
    group.append(svgEl("text", {x: geometry.start_mm[0], y: geometry.start_mm[1] - 130, class: "dimension-text"}, primitive.text));
    group.append(svgEl("text", {x: geometry.end_mm[0], y: geometry.end_mm[1] - 130, class: "dimension-text"}, primitive.text));
    return group;
  }

  function renderTextPrimitive(primitive) {
    const geometry = primitive.geometry;
    const node = svgEl("text", {x: geometry.x_mm, y: geometry.y_mm});
    String(primitive.text || primitive.metadata?.label || primitive.primitive_ref).split("\n").forEach((line, index) => {
      node.append(svgEl("tspan", {x: geometry.x_mm, dy: index === 0 ? 0 : "1.25em"}, line));
    });
    return node;
  }

  function renderDimensionPrimitive(primitive) {
    const geometry = primitive.geometry;
    const [x1, y1] = geometry.start_mm;
    const [x2, y2] = geometry.end_mm;
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / length) * 105;
    const ny = ((x2 - x1) / length) * 105;
    const group = svgEl("g");
    group.append(svgEl("line", {x1, y1, x2, y2}));
    group.append(svgEl("line", {x1: x1 - nx, y1: y1 - ny, x2: x1 + nx, y2: y1 + ny}));
    group.append(svgEl("line", {x1: x2 - nx, y1: y2 - ny, x2: x2 + nx, y2: y2 + ny}));
    group.append(svgEl("text", {
      x: (x1 + x2) / 2 + nx * 1.35,
      y: (y1 + y2) / 2 + ny * 1.35,
      class: "dimension-text",
    }, primitive.text || `${length.toFixed(0)} mm`));
    return group;
  }

  function renderDraft() {
    if (!state.drawStart || !state.drawCurrent || state.drawStart.sheetRef !== state.activeSheetRef) return;
    const start = state.drawStart.model;
    const end = state.drawCurrent.model;
    const group = svgEl("g");
    if (["selection", "room"].includes(state.activeTool)) {
      const x = Math.min(start[0], end[0]);
      const y = Math.min(start[1], end[1]);
      group.append(svgEl("rect", {
        x, y,
        width: Math.abs(end[0] - start[0]),
        height: Math.abs(end[1] - start[1]),
        class: "selection-preview",
      }));
    } else {
      group.append(svgEl("line", {x1: start[0], y1: start[1], x2: end[0], y2: end[1], class: "draft-preview"}));
    }
    group.append(svgEl("circle", {cx: start[0], cy: start[1], r: 85, class: "draft-preview-point"}));
    group.append(svgEl("circle", {cx: end[0], cy: end[1], r: 85, class: "draft-preview-point"}));
    svg.append(group);
  }

  function renderWorldSelection() {
    const selection = state.worldSelection;
    if (!selection || selection.sheetRef !== state.activeSheetRef) return;
    const [startX, startY] = selection.start;
    const [endX, endY] = selection.end;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const group = svgEl("g", {class: "world-selection"});
    group.append(svgEl("rect", {x, y, width, height, class: "world-selection-preview"}));
    group.append(svgEl("text", {x: x + width / 2, y: y + height / 2, class: "world-selection-label"},
      `${(width * height / 1_000_000).toLocaleString("de-DE", {maximumFractionDigits: 2})} m²`));
    svg.append(group);
  }

  function renderInspector() {
    const empty = document.getElementById("inspector-empty");
    const inspector = document.getElementById("inspector");
    if (!empty || !inspector) return;
    const item = state.selectedPrimitive?.metadata || null;
    empty.hidden = Boolean(item);
    inspector.hidden = !item;
    document.getElementById("selection-badge").textContent = item ? "1" : "0";
    if (!item) return;
    document.getElementById("prop-label").textContent = item.label || item.element_ref;
    document.getElementById("prop-id").textContent = item.element_ref || "–";
    document.getElementById("prop-kind").textContent = item.kind || "–";
    document.getElementById("prop-kind-badge").textContent = String(item.kind || "–").slice(0, 3);
    document.getElementById("prop-layer").textContent = item.layer || "–";
    document.getElementById("prop-family").textContent = item.family_ref || "–";
    document.getElementById("prop-variant").textContent = item.variant_ref || "–";
    document.getElementById("prop-form").textContent = item.form || "–";
    document.getElementById("prop-thickness").textContent = Number.isFinite(Number(item.thickness_mm))
      ? `${Number(item.thickness_mm).toLocaleString("de-DE")} mm`
      : "–";
    document.getElementById("prop-source-cells").textContent = Number.isFinite(Number(item.source_cell_count))
      ? String(item.source_cell_count)
      : "–";
    document.getElementById("prop-source").textContent = formatSource(item.source);
    document.getElementById("prop-draft").hidden = !item.local_draft;
  }

  function formatSource(source) {
    if (!source) return "–";
    if (typeof source === "string") return source;
    if (typeof source !== "object") return String(source);
    const role = source.semanticRole ? ` · ${source.semanticRole}` : "";
    const dimensionSource = source.dimensionsSource === "library-variant-snapshot"
      ? " · VectoPlan Library"
      : source.dimensionsSource === "cell-size-fallback"
        ? " · 1-m-Fallback"
        : "";
    return `${source.kind || "Core"}${role}${dimensionSource}`;
  }

  function renderCommandLog() {
    const container = document.getElementById("command-log");
    const count = document.getElementById("command-count");
    if (!container || !count) return;
    count.textContent = String(state.commands.length);
    container.replaceChildren();
    if (!state.commands.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Noch keine Commands in diesem Browser-Tab.";
      container.append(empty);
      return;
    }
    [...state.commands].reverse().slice(0, 6).forEach((entry, reverseIndex) => {
      const item = document.createElement("div");
      item.className = "command-item";
      const index = document.createElement("span");
      index.className = "command-index";
      index.textContent = String(state.commands.length - reverseIndex);
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = commandLabel(entry.receipt.command.command);
      const meta = document.createElement("small");
      meta.textContent = "Lokaler Entwurf";
      content.append(title, meta);
      item.append(index, content);
      container.append(item);
    });
  }

  function commandLabel(command) {
    return {
      create_wall: "Wand erstellen",
      create_opening: "Fenster/Tür erstellen",
      place_library_object: "Library-Bauteil erstellen",
      create_room: "Raum erstellen",
      update_room: "Raum ändern",
      create_line: "Linie erstellen",
      create_dimension: "Bemaßung erstellen",
      create_section_marker: "Schnittmarke erstellen",
    }[command] || command;
  }

  function selectTool(tool) {
    if (!toolConfig[tool]) return;
    if (projectContext.readOnly && ["selection", "wall", "opening", "library", "room"].includes(tool)) {
      showMessage("Dieses Projekt wurde schreibgeschützt geöffnet.");
      return;
    }
    if (["wall", "opening", "library", "room"].includes(tool) && !state.selectedLibraryItem) {
      toggleLibrary();
      showMessage("Bitte zuerst ein freigegebenes Element aus der Creative Library auswählen.");
      return;
    }
    state.activeTool = tool;
    cancelDrawing(false);
    document.querySelectorAll("[data-tool]").forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    svg.classList.toggle("is-drawing", ["selection", "wall", "opening", "library", "room"].includes(tool));
    svg.classList.toggle("is-parcel-grid-editing", tool === "parcel-grid");
    const activeLabel = document.getElementById("active-tool-label");
    const toolHint = document.getElementById("tool-hint");
    if (activeLabel) activeLabel.textContent = toolConfig[tool].label;
    if (toolHint) toolHint.textContent = toolConfig[tool].hint;
    const isLibraryPlacement = ["wall", "opening", "library"].includes(tool);
    const thicknessField = document.getElementById("wall-thickness-field");
    const variantField = document.getElementById("library-variant-field");
    const roomOptions = document.getElementById("room-options");
    if (thicknessField) thicknessField.hidden = !isLibraryPlacement;
    if (variantField) variantField.hidden = !state.selectedLibraryItem || tool === "room";
    if (roomOptions) roomOptions.hidden = tool !== "room";
    const createRoom = document.querySelector('[data-action="create-room"]');
    if (createRoom) createRoom.disabled = tool !== "room" || !state.worldSelection || projectContext.readOnly;
    syncQuickToolButtons();
  }

  function cancelDrawing(render = true) {
    const hadDraft = Boolean(state.drawStart);
    state.drawStart = null;
    state.drawCurrent = null;
    state.drawPointerRaw = null;
    if (render && hadDraft) renderPlan();
  }

  function pointFromEvent(event) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return {x: transformed.x, y: transformed.y};
  }

  function publishParcelGridState() {
    const selection = state.parcelSelection;
    if (!selection) return;
    selection.revision = Math.max(0, Number(selection.revision) || 0) + 1;
    try {
      window.parent?.postMessage({
        type: "vectoplan-editor:parcel-selection-changed",
        kind: "vectoplan-editor:parcel-selection-changed",
        source: "vectoplan-cad",
        detail: {
          projectPublicId: selection.projectPublicId,
          coordinateSpace: "wgs84",
          coveragePolicy: "cell-contained",
          revision: selection.revision,
          projectCoordinate: selection.projectCoordinate,
          gridRotationDegrees: selection.gridRotationDegrees,
          parcels: selection.parcels,
          adjacentParcels: selection.adjacentParcels,
          parcelGridState: selection.parcelGridState,
        },
      }, "*");
    } catch (_error) {
      // Parent bridge is optional in standalone CAD development.
    }
  }

  function startParcelGridDrag(event) {
    if (state.activeTool !== "parcel-grid") return false;
    const target = event.target?.closest?.("[data-parcel-grid-guide-key]");
    if (!target) {
      showMessage(state.parcelSelection?.parcels?.length
        ? "Eine hellblaue Innenlinie greifen und nach innen oder außen ziehen."
        : "Bitte zuerst ein Grundstück auswählen.");
      return true;
    }
    const point = pointFromEvent(event);
    if (!point) return true;
    state.parcelGridDrag = {
      pointerId: event.pointerId,
      guideKey: String(target.dataset.parcelGridGuideKey || ""),
      parcelId: String(target.dataset.parcelId || ""),
      startLonLat: [Number(target.dataset.startLon), Number(target.dataset.startLat)],
      endLonLat: [Number(target.dataset.endLon), Number(target.dataset.endLat)],
      inward: [Number(target.dataset.inwardX), Number(target.dataset.inwardY)],
      initialDepthMeters: Number(target.dataset.depthMeters) || 3,
      startPoint: [point.x, point.y],
    };
    svg.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    return true;
  }

  function updateParcelGridDrag(event) {
    const drag = state.parcelGridDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    const point = pointFromEvent(event);
    if (!point) return true;
    const deltaMillimetres = (point.x - drag.startPoint[0]) * drag.inward[0]
      + (point.y - drag.startPoint[1]) * drag.inward[1];
    const depthMeters = Math.max(1, Math.min(512, Math.round(drag.initialDepthMeters + deltaMillimetres / 1000)));
    const selection = state.parcelSelection;
    if (!selection) return true;
    const current = selection.parcelGridState || {
      schemaVersion: "vectoplan-parcel-grid-state.v1",
      mode: "boundary",
      setbackMeters: 0,
      influenceMeters: 3,
      activeParcelId: null,
      activeGuideKey: null,
      guides: [],
    };
    const guides = (current.guides || []).filter((guide) => (
      parcelGridGuideKey(guide.parcelId, guide.startLonLat, guide.endLonLat) !== drag.guideKey
    ));
    guides.push({
      parcelId: drag.parcelId,
      startLonLat: drag.startLonLat,
      endLonLat: drag.endLonLat,
      depthMeters,
    });
    selection.parcelGridState = {
      ...current,
      schemaVersion: "vectoplan-parcel-grid-state.v1",
      influenceMeters: depthMeters,
      activeParcelId: drag.parcelId,
      activeGuideKey: drag.guideKey,
      guides: guides.slice(-256),
    };
    renderPlan();
    return true;
  }

  function finishParcelGridDrag(event) {
    const drag = state.parcelGridDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    state.parcelGridDrag = null;
    publishParcelGridState();
    showMessage("Grundstücksraster gespeichert und mit 3D synchronisiert.");
    return true;
  }

  function snappedModelPoint(point) {
    const snapEnabled = document.getElementById("snap-enabled");
    if (snapEnabled && !snapEnabled.checked) return [Math.round(point.x), Math.round(point.y)];
    const step = activeSnapStep();
    return [Math.round(point.x / step) * step, Math.round(point.y / step) * step];
  }

  function activeSnapStep() {
    const snapEnabled = document.getElementById("snap-enabled");
    if (snapEnabled && !snapEnabled.checked) return 1;
    return Math.max(1, Number(document.getElementById("snap-size")?.value) || 100);
  }

  function drawingModelPoint(point, event = null) {
    const model = snappedModelPoint(point);
    if (!state.drawStart || !(event?.shiftKey || state.shiftPressed)) return model;
    const [startX, startY] = state.drawStart.model;
    const deltaX = model[0] - startX;
    const deltaY = model[1] - startY;
    if (deltaX === 0 && deltaY === 0) return model;

    const directions = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];
    const directionIndex = ((Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) % 8) + 8) % 8;
    const [directionX, directionY] = directions[directionIndex];
    const directionScale = directionX * directionX + directionY * directionY;
    const projected = (deltaX * directionX + deltaY * directionY) / directionScale;
    const along = Math.round(projected / activeSnapStep()) * activeSnapStep();
    return [startX + directionX * along, startY + directionY * along];
  }

  function refreshDraftAngleConstraint(event = null) {
    if (!state.drawStart || !state.drawPointerRaw) return;
    state.drawCurrent = {model: drawingModelPoint(state.drawPointerRaw, event)};
    schedulePlanRender();
  }

  function schedulePlanRender() {
    if (state.renderScheduled) return;
    state.renderScheduled = true;
    window.requestAnimationFrame(() => {
      state.renderScheduled = false;
      renderPlan();
    });
  }

  function beginPan(event) {
    if (!state.camera) return;
    event.preventDefault();
    state.pan = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      camera: {...state.camera},
    };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add("is-panning");
  }

  function updatePan(event) {
    if (!state.pan || state.pan.pointerId !== event.pointerId || state.pinch) return false;
    const dx = event.clientX - state.pan.clientX;
    const dy = event.clientY - state.pan.clientY;
    const start = state.pan.camera;
    state.camera.x = start.x - dx * start.width / Math.max(svg.clientWidth, 1);
    state.camera.y = start.y - dy * start.height / Math.max(svg.clientHeight, 1);
    schedulePlanRender();
    return true;
  }

  function beginPinch() {
    const points = [...state.touchPoints.values()];
    if (!state.camera || points.length < 2) return;
    const [first, second] = points;
    const rect = svg.getBoundingClientRect();
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    const camera = {...state.camera};
    state.pan = null;
    state.pinch = {
      distance: Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)),
      camera,
      anchor: {
        x: camera.x + (centerX - rect.left) / Math.max(rect.width, 1) * camera.width,
        y: camera.y + (centerY - rect.top) / Math.max(rect.height, 1) * camera.height,
      },
      rect: {left: rect.left, top: rect.top, width: Math.max(rect.width, 1), height: Math.max(rect.height, 1)},
    };
    svg.classList.add("is-panning");
  }

  function updatePinch() {
    const points = [...state.touchPoints.values()];
    if (!state.pinch || points.length < 2) return false;
    const [first, second] = points;
    const distance = Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY));
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    const start = state.pinch.camera;
    const baseWidth = state.baseCameraWidth || start.width;
    const minWidth = Math.max(50, baseWidth * 0.0001);
    const maxWidth = baseWidth * 40;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, start.width * state.pinch.distance / distance));
    const factor = nextWidth / start.width;
    const nextHeight = start.height * factor;
    const rect = state.pinch.rect;
    state.camera.x = state.pinch.anchor.x - (centerX - rect.left) / rect.width * nextWidth;
    state.camera.y = state.pinch.anchor.y - (centerY - rect.top) / rect.height * nextHeight;
    state.camera.width = nextWidth;
    state.camera.height = nextHeight;
    schedulePlanRender();
    return true;
  }

  function endPointer(event) {
    if (event.pointerType === "touch") state.touchPoints.delete(event.pointerId);
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (finishParcelGridDrag(event)) return true;
    if (state.pinch) {
      if (state.touchPoints.size < 2) {
        state.pinch = null;
        state.pan = null;
        svg.classList.remove("is-panning");
      }
      return true;
    }
    if (!state.pan || state.pan.pointerId !== event.pointerId) return false;
    state.pan = null;
    svg.classList.remove("is-panning");
    return true;
  }

  function handlePointerMove(event) {
    if (!state.scene) return;
    if (updateParcelGridDrag(event)) return;
    if (event.pointerType === "touch" && state.touchPoints.has(event.pointerId)) {
      state.touchPoints.set(event.pointerId, {clientX: event.clientX, clientY: event.clientY});
      if (updatePinch()) return;
    }
    if (updatePan(event)) return;
    if (!state.drawStart) return;
    const point = pointFromEvent(event);
    if (!point) return;
    state.drawPointerRaw = point;
    state.drawCurrent = {model: drawingModelPoint(point, event)};
    schedulePlanRender();
  }

  function handlePointerDown(event) {
    if (!state.scene) return;
    if (event.pointerType === "touch") {
      state.touchPoints.set(event.pointerId, {clientX: event.clientX, clientY: event.clientY});
      svg.setPointerCapture?.(event.pointerId);
      if (state.touchPoints.size === 2) {
        event.preventDefault();
        beginPinch();
        return;
      }
      if (state.touchPoints.size > 2) return;
      if (state.activeTool === "select" && !event.target.closest?.(".primitive")) {
        state.selectedPrimitive = null;
        renderPlan();
        renderInspector();
        beginPan(event);
        return;
      }
    }
    if (event.button === 1 || (event.button === 0 && state.spacePressed)) {
      beginPan(event);
      return;
    }
    if (event.button !== 0) return;
    if (startParcelGridDrag(event)) return;
    if (state.activeTool === "select") {
      if (!event.target.closest?.(".primitive")) {
        state.selectedPrimitive = null;
        renderPlan();
        renderInspector();
      }
      return;
    }
    event.preventDefault();
    const point = pointFromEvent(event);
    const viewport = currentViewport();
    if (!point || !viewport) return;
    const model = drawingModelPoint(point, event);
    if (!state.drawStart) {
      state.drawStart = {sheetRef: state.activeSheetRef, viewportRef: viewport.viewport_ref, model};
      state.drawPointerRaw = point;
      state.drawCurrent = {model};
      renderPlan();
      showMessage("Startpunkt gesetzt · Umschalttaste halten: 45°.");
      return;
    }
    if (model[0] === state.drawStart.model[0] && model[1] === state.drawStart.model[1]) {
      showMessage("Start- und Endpunkt dürfen nicht identisch sein.");
      return;
    }
    const start = state.drawStart;
    cancelDrawing(false);
    if (state.activeTool === "selection") {
      state.worldSelection = {
        sheetRef: start.sheetRef,
        viewportRef: start.viewportRef,
        start: start.model,
        end: model,
      };
      const roomButton = document.querySelector('[data-action="create-room"]');
      if (roomButton) roomButton.disabled = projectContext.readOnly;
      renderPlan();
      showMessage("WorldEdit-Bereich gespeichert. Jetzt »Räume« in der Creative Library wählen.");
      return;
    }
    if (state.activeTool === "room") {
      state.worldSelection = {
        sheetRef: start.sheetRef,
        viewportRef: start.viewportRef,
        start: start.model,
        end: model,
      };
      renderPlan();
      submitRoomCommand().catch(handleError);
      return;
    }
    submitDrawCommand(start, model).catch(handleError);
  }

  function handleWheel(event) {
    if (!state.camera) return;
    event.preventDefault();
    const camera = state.camera;
    const horizontalGesture = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontalGesture) {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      camera.x += delta * camera.width / Math.max(svg.clientWidth, 1);
      schedulePlanRender();
      return;
    }

    const anchor = pointFromEvent(event);
    if (!anchor) return;
    const baseWidth = state.baseCameraWidth || camera.width;
    const minWidth = Math.max(50, baseWidth * 0.0001);
    const maxWidth = baseWidth * 40;
    const delta = Math.max(-180, Math.min(180, event.deltaY));
    const requestedWidth = camera.width * Math.exp(delta * 0.0018);
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, requestedWidth));
    const factor = nextWidth / camera.width;
    camera.x = anchor.x - (anchor.x - camera.x) * factor;
    camera.y = anchor.y - (anchor.y - camera.y) * factor;
    camera.width = nextWidth;
    camera.height *= factor;
    schedulePlanRender();
  }

  async function submitDrawCommand(start, end) {
    const config = toolConfig[state.activeTool];
    const documentData = state.input.document;
    const modelStart = northUpPointToModel(start.model);
    const modelEnd = northUpPointToModel(end);
    state.commandSequence += 1;
    const payload = {
      contract_version: "cad-command/0.2",
      command: config.command,
      document_ref: documentData.document_ref,
      sheet_ref: start.sheetRef,
      viewport_ref: start.viewportRef,
      base_revision_ref: documentData.source_revision_ref,
      client_command_id: `local_${Date.now().toString(36)}_${state.commandSequence}`,
      geometry: {start_mm: modelStart, end_mm: modelEnd},
      parameters: activeStoreyParameters(),
      user_context: {
        source: "vectoplan-cad-browser",
        mode: "core_bridge_prepared",
        core_project_id: projectContext.coreProjectId,
        project_public_id: projectContext.projectPublicId,
      },
    };
    if (["create_wall", "create_opening", "place_library_object"].includes(config.command)) {
      const item = state.selectedLibraryItem;
      const variant = state.selectedLibraryVariant;
      if (!item || !variant) throw new Error("Kein gültiges Creative-Library-Element ausgewählt.");
      const dimensions = variant.dimensions || item.dimensions || {};
      payload.family_ref = item.family_ref;
      payload.variant_ref = variant.variant_ref;
      payload.parameters.thickness_mm = Number(dimensions.thickness_mm)
        || Number(dimensions.depth_mm)
        || Number(document.getElementById("wall-thickness")?.value)
        || 100;
      payload.parameters.width_mm = Number(dimensions.width_mm) || Math.hypot(modelEnd[0] - modelStart[0], modelEnd[1] - modelStart[1]);
      payload.parameters.height_mm = Number(dimensions.height_mm) || 1000;
      payload.parameters.depth_mm = Number(dimensions.depth_mm) || payload.parameters.thickness_mm;
    }
    if (config.command === "create_section_marker") payload.parameters.label = "A–A";
    const receipt = await fetchJson(`${routePrefix}/commands`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    publishModelMutation(receipt);
    if (receipt.accepted) {
      state.selectedPrimitive = null;
      await loadProjectInput({preserveCamera: true});
      showMessage(`${config.label} gespeichert; 2D und 3D verwenden dasselbe Modell.`);
      return;
    }
    const sheet = state.input.sheets.find((item) => item.sheet_ref === start.sheetRef);
    sheet.elements.push(receipt.preview_element);
    state.commands.push({receipt, sheetRef: start.sheetRef, element: receipt.preview_element});
    state.redoCommands = [];
    state.selectedPrimitive = null;
    await refreshProjection();
    showMessage(`${config.label} angelegt · Modelländerung für Core und 3D vorbereitet.`);
  }

  async function submitRoomCommand() {
    const selection = state.worldSelection;
    const item = state.selectedLibraryItem;
    const variant = state.selectedLibraryVariant;
    if (!selection) throw new Error("Kein Raum- oder Treppenbereich gezeichnet.");
    if (!item || item.placement_kind !== "room" || !variant) throw new Error("Bitte Raum oder Treppe auswählen.");
    const documentData = state.input.document;
    const modelStart = northUpPointToModel(selection.start);
    const modelEnd = northUpPointToModel(selection.end);
    state.commandSequence += 1;
    const quickKind = quickToolKindForItem(item);
    const isStair = quickKind === "stair";
    const dimensions = variant.dimensions || item.dimensions || {};
    const payload = {
      contract_version: "cad-command/0.2",
      command: "create_room",
      document_ref: documentData.document_ref,
      sheet_ref: selection.sheetRef,
      viewport_ref: selection.viewportRef,
      base_revision_ref: documentData.source_revision_ref,
      client_command_id: `room_${Date.now().toString(36)}_${state.commandSequence}`,
      geometry: {start_mm: modelStart, end_mm: modelEnd},
      family_ref: item.family_ref,
      variant_ref: variant.variant_ref,
      parameters: {
        ...activeStoreyParameters(),
        room_type: isStair ? "stair" : "sonstige",
        label: isStair ? (item.label || "Treppe") : "Raum",
        height_mm: Number(dimensions.height_mm) || 3000,
      },
      user_context: {
        source: "vectoplan-cad-worldedit",
        mode: "core_bridge_prepared",
        core_project_id: projectContext.coreProjectId,
        project_public_id: projectContext.projectPublicId,
      },
    };
    const receipt = await fetchJson(`${routePrefix}/commands`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    publishModelMutation(receipt);
    if (receipt.accepted) {
      state.selectedPrimitive = null;
      state.worldSelection = null;
      await loadProjectInput({preserveCamera: true});
      selectTool("select");
      showMessage(`${isStair ? "Treppenbereich" : "Raum"} gespeichert; 2D und 3D verwenden dasselbe Modell.`);
      return;
    }
    const sheet = state.input.sheets.find((entry) => entry.sheet_ref === selection.sheetRef);
    sheet.elements.push(receipt.preview_element);
    state.commands.push({receipt, sheetRef: selection.sheetRef, element: receipt.preview_element});
    state.redoCommands = [];
    state.selectedPrimitive = null;
    state.worldSelection = null;
    await refreshProjection();
    selectTool("select");
    showMessage(`${isStair ? "Treppenbereich" : "Raum"} angelegt · Modelländerung für Core und 3D vorbereitet.`);
  }

  function publishModelMutation(receipt) {
    const detail = {
      contract_version: "vectoplan-cad-model-event/0.1",
      core_project_id: projectContext.coreProjectId,
      project_public_id: projectContext.projectPublicId,
      command: receipt.command,
      mutation_intent: receipt.mutation_intent,
      preview_element: receipt.preview_element,
    };
    window.dispatchEvent(new CustomEvent("vectoplan-cad:model-command", {detail}));
    if (window.parent === window) return;
    let targetOrigin = window.location.origin;
    try {
      if (document.referrer) targetOrigin = new URL(document.referrer).origin;
    } catch (_error) {}
    window.parent.postMessage({
      type: "vectoplan-cad:model-command",
      kind: "vectoplan-cad:model-command",
      source: "vectoplan-cad",
      detail,
    }, targetOrigin);
  }

  async function undo() {
    const entry = state.commands.pop();
    if (!entry) return;
    const sheet = state.input.sheets.find((item) => item.sheet_ref === entry.sheetRef);
    sheet.elements = sheet.elements.filter((element) => element.element_ref !== entry.element.element_ref);
    state.redoCommands.push(entry);
    state.selectedPrimitive = null;
    await refreshProjection();
    showMessage(`${commandLabel(entry.receipt.command.command)} rückgängig gemacht.`);
  }

  async function redo() {
    const entry = state.redoCommands.pop();
    if (!entry) return;
    const sheet = state.input.sheets.find((item) => item.sheet_ref === entry.sheetRef);
    sheet.elements.push(entry.element);
    state.commands.push(entry);
    state.selectedPrimitive = null;
    await refreshProjection();
    showMessage(`${commandLabel(entry.receipt.command.command)} wiederhergestellt.`);
  }

  function syncHistoryButtons() {
    document.querySelector('[data-action="undo"]').disabled = state.commands.length === 0;
    document.querySelector('[data-action="redo"]').disabled = state.redoCommands.length === 0;
  }

  function isEditableTarget(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  }

  function syncPanelButtons() {
    const inspectorOpen = app.classList.contains("is-right-open");
    const compactLayout = window.matchMedia("(max-width: 1020px)").matches;
    const rightPanel = document.getElementById("right-panel");
    const backdrop = document.querySelector(".panel-backdrop");
    const toggle = document.querySelector('[data-action="toggle-inspector"]');
    if (!toggle || !rightPanel || !backdrop) return;
    toggle.setAttribute("aria-expanded", String(inspectorOpen));
    rightPanel.inert = compactLayout && !inspectorOpen;
    if (compactLayout) rightPanel.setAttribute("aria-hidden", String(!inspectorOpen));
    else rightPanel.removeAttribute("aria-hidden");
    backdrop.tabIndex = inspectorOpen ? 0 : -1;
  }

  function closePanels() {
    app.classList.remove("is-right-open");
    syncPanelButtons();
  }

  function toggleInspector() {
    app.classList.toggle("is-right-open");
    syncPanelButtons();
  }
  function handleResize() {
    if (window.innerWidth > 1020) closePanels();
    if (!state.camera) return;
    const centerY = state.camera.y + state.camera.height / 2;
    const aspect = Math.max(svg.clientWidth, 1) / Math.max(svg.clientHeight, 1);
    state.camera.height = state.camera.width / aspect;
    state.camera.y = centerY - state.camera.height / 2;
    renderPlan();
  }

  function bindEvents() {
    svg.addEventListener("pointermove", handlePointerMove);
    svg.addEventListener("pointerdown", handlePointerDown);
    svg.addEventListener("pointerup", endPointer);
    svg.addEventListener("pointercancel", endPointer);
    svg.addEventListener("wheel", handleWheel, {passive: false});
    svg.addEventListener("auxclick", (event) => {
      if (event.button === 1) event.preventDefault();
    });
    svg.addEventListener("contextmenu", (event) => {
      if (!state.drawStart) return;
      event.preventDefault();
      cancelDrawing();
    });
    document.querySelector('[data-action="toggle-inspector"]')?.addEventListener("click", toggleInspector);
    document.querySelectorAll('[data-action="close-panels"]').forEach((button) => button.addEventListener("click", closePanels));
    syncPanelButtons();
    document.querySelector('[data-action="undo"]').addEventListener("click", () => undo().catch(handleError));
    document.querySelector('[data-action="redo"]').addEventListener("click", () => redo().catch(handleError));
    document.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => selectTool(button.dataset.tool));
    });
    document.querySelectorAll("[data-quick-tool]").forEach((button) => {
      button.addEventListener("click", () => activateQuickTool(button.dataset.quickTool));
    });
    document.querySelectorAll('[data-action="toggle-library"]').forEach((button) => {
      button.addEventListener("click", toggleLibrary);
    });
    document.getElementById("library-search")?.addEventListener("input", (event) => {
      state.libraryQuery = event.target.value;
      renderLibraryGrid();
    });
    document.getElementById("library-variant")?.addEventListener("change", (event) => {
      state.selectedLibraryVariant = state.selectedLibraryItem?.variants?.find((entry) => entry.variant_ref === event.target.value) || null;
      syncLibrarySelectionUi();
      renderLibraryGrid();
    });
    document.querySelector('[data-action="create-room"]')?.addEventListener("click", () => submitRoomCommand().catch(handleError));
    window.addEventListener("resize", handleResize);
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const data = event.data && typeof event.data === "object" ? event.data : {};
      if (String(data.type || data.kind || "") !== "vectoplan-app:parcel-selection-sync") return;
      const selection = normalizeParcelSelection(data.detail || data);
      if (!selection) return;
      const previousSignature = parcelSelectionSignature();
      state.parcelSelection = selection;
      state.camera = null;
      if (state.scene) renderPlan();
      if (previousSignature !== parcelSelectionSignature()) scheduleParcelProjectionReload();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Shift" && !isEditableTarget(event.target)) {
        state.shiftPressed = true;
        refreshDraftAngleConstraint(event);
      }
      if (event.code === "Space" && !isEditableTarget(event.target)) {
        event.preventDefault();
        state.spacePressed = true;
        svg.classList.add("is-pan-ready");
      }
      if (event.key === "Escape") {
        cancelDrawing();
        closePanels();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo().catch(handleError);
        else undo().catch(handleError);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo().catch(handleError);
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.key === "Shift") {
        state.shiftPressed = false;
        refreshDraftAngleConstraint(event);
      }
      if (event.code === "Space") {
        state.spacePressed = false;
        svg.classList.remove("is-pan-ready");
      }
    });
    window.addEventListener("blur", () => {
      state.spacePressed = false;
      state.shiftPressed = false;
      state.pan = null;
      state.pinch = null;
      state.touchPoints.clear();
      svg.classList.remove("is-pan-ready", "is-panning");
    });
  }

  function handleError(error) {
    console.error(error);
    showMessage(`Fehler: ${error.message}`, 6000);
  }

  async function init() {
    bindEvents();
    try {
      window.parent?.postMessage({
        type: "vectoplan-cad:parcel-selection-request",
        kind: "vectoplan-cad:parcel-selection-request",
        source: "vectoplan-cad",
        detail: {projectPublicId: projectContext.projectPublicId},
      }, "*");
    } catch (_error) {}
    selectTool("select");
    await loadBootstrap();
    await loadLibraryCatalog();
    if (projectContext.coreProjectId) {
      await loadProjectInput();
      startSharedModelPolling();
      return;
    }
    if (projectContext.sampleRequested && state.bootstrap?.mock_mode) {
      await loadTestInput();
      return;
    }
    throw new Error("Kein Core-Projekt übergeben. Öffne CAD über ein VectoPlan-Projekt oder nutze ?sample=1 für das Muster.");
  }

  init().catch(handleError);
})();
