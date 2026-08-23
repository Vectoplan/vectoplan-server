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
    roomDraftPoints: [],
    roomSubmissionPending: false,
    roofDraftPoints: [],
    roofSubmissionPending: false,
    openingHostPreview: null,
    roomLabelEditPrimitive: null,
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
    cursorPoint: null,
    lastPointerModel: null,
    drawSessionId: 0,
    drawCommandQueue: Promise.resolve(),
    pendingDrawSegments: new Map(),
    building: null,
    buildingStorageKey: "",
    loadedProjectionStoreyId: "",
    elementEdits: new Map(),
    localCopies: [],
    hiddenElementRefs: new Set(),
    clipboard: null,
    editSequence: 0,
    pointGeometryOverrides: new Map(),
    pointEditMode: false,
    pointDrag: null,
    snapTarget: null,
    planOverview: false,
    planOverviewPreviousCamera: null,
    planRules: null,
    planPhase: "design",
    planContent: "overview",
    planViewSelection: "all",
  };

  const buildingTypes = new Set([
    "residential", "apartment", "industrial", "office", "public",
    "bridge", "tunnel", "infrastructure", "landscape", "other",
  ]);

  const fallbackPlanRules = {
    contract_version: "cad-plan-rules/0.1",
    content_order: ["floor_plans", "elevations", "sections", "title_block", "site_plan"],
    content_labels: {
      floor_plans: "Grundrisse", elevations: "Ansichten", sections: "Schnitte",
      title_block: "Plankopf", site_plan: "Lageplan",
    },
    phases: {
      design: {label: "Entwurfsplan", summary: "Entwurfsdarstellungen mit Hauptmaßen.", dimensioning: "exterior"},
      permit: {label: "Eingabeplan", summary: "Genehmigungsrelevante Darstellungen mit Haupt- und Öffnungsmaßen.", dimensioning: "exterior_and_openings"},
      execution: {label: "Ausführungsplan", summary: "Vollständige Außen-, Innen- und Öffnungsbemaßung.", dimensioning: "complete"},
    },
    profiles: {
      residential: {label: "Wohngebäude", profile: "building", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
      apartment: {label: "Mehrfamilienhaus", profile: "building", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
      industrial: {label: "Industriegebäude", profile: "building", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
      office: {label: "Bürogebäude", profile: "building", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
      public: {label: "Öffentliches Gebäude", profile: "building", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
      bridge: {label: "Brücke", profile: "bridge", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"], aliases: {floor_plans: "Draufsicht", elevations: "Längsansichten", sections: "Regelquerschnitte", site_plan: "Übersichtslageplan"}},
      tunnel: {label: "Tunnel", profile: "tunnel", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"], aliases: {floor_plans: "Trassierungsgrundriss", elevations: "Längsschnitt", sections: "Tunnelquerschnitte"}},
      infrastructure: {label: "Infrastrukturbauwerk", profile: "infrastructure", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
      landscape: {label: "Freianlage", profile: "landscape", required: ["floor_plans", "sections", "title_block", "site_plan"]},
      other: {label: "Sonstiges Bauwerk", profile: "generic", required: ["floor_plans", "elevations", "sections", "title_block", "site_plan"]},
    },
  };

  const toolConfig = {
    select: {label: "Auswahl", hint: "Element anklicken, um seine semantischen Referenzen zu prüfen."},
    selection: {label: "WorldEdit-Auswahl", hint: "Zwei Eckpunkte aufziehen. Der Bereich wird für Räume und weitere WorldEdit-Operationen gespeichert."},
    wall: {label: "Wand", command: "create_wall", hint: "Punkte nacheinander setzen. Die Wandkette läuft weiter, bis ESC gedrückt wird. Umschalt: 45°."},
    opening: {label: "Öffnung", command: "create_opening", hint: "Maus über eine Wand führen und klicken. Fenster und Türen werden ausschließlich wandgebunden eingesetzt."},
    library: {label: "Library-Bauteil", command: "place_library_object", hint: "Start- und Endpunkt wählen. Umschalttaste halten: 45°-Raster."},
    room: {label: "Raum", command: "create_room", hint: "Raumkontur Punkt für Punkt zeichnen. Ab drei Punkten den ersten Punkt anklicken oder ESC drücken, um den Raum zu schließen."},
    roof: {label: "Dach", command: "create_roof", hint: "Dachfläche Punkt für Punkt zeichnen. Ersten Punkt erneut anklicken oder ESC drücken; Dachhaut, Sparren und Pfetten werden parametrisch berechnet."},
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

  function cloneValue(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
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
      // Boundary cells belong to the selected parcel when their centre is
      // inside. Requiring all four corners made rotated walls and openings
      // disappear along parcel edges.
      coveragePolicy: "cell-center",
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
    const activeStorey = state.building?.storeys?.find((storey) => storey.id === state.building.activeStoreyId) || null;
    const elevationMm = Number(activeStorey?.elevationMm ?? profile.storey_elevation_mm);
    const storeyBaseY = Number.isFinite(elevationMm) ? Math.floor(elevationMm / cellSizeMm) : 0;
    return {
      // Storey elevation describes the supporting floor/terrain plane. CAD
      // building blocks start one voxel above it so terrain is never replaced.
      base_y: storeyBaseY + 1,
      storey_base_y: storeyBaseY,
      storey_id: String(activeStorey?.id || profile.storey_id || "ground_floor"),
      storey_name: String(activeStorey?.name || profile.storey_name || "Erdgeschoss"),
      storey_height_mm: Math.max(100, Number(activeStorey?.heightMm || profile.storey_height_mm) || defaultStoreyHeightMm(activeStorey)),
      building_type: String(state.building?.buildingType || "residential"),
      roof_type: String(state.building?.roofType || "gable"),
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

  function metricEarthGridDisplayFrame() {
    const frame = exactCoordinateFrame();
    const origin = state.parcelSelection?.projectCoordinate;
    if (!frame || !origin) return null;
    const anchor = lonLatToExactWorldModelMm(origin.longitude, origin.latitude);
    if (!anchor) return null;
    const metresPerDegree = wgs84MetresPerDegree(origin.latitude);
    const gridMmPerDegreeLongitude = frame.width / 360 * frame.cellSizeMm;
    const gridMmPerDegreeLatitude = frame.height / 180 * frame.cellSizeMm;
    const scaleX = metresPerDegree.longitude * 1000 / gridMmPerDegreeLongitude;
    const scaleZ = metresPerDegree.latitude * 1000 / gridMmPerDegreeLatitude;
    if (![scaleX, scaleZ].every((value) => Number.isFinite(value) && value > 0)) return null;
    return {anchorX: anchor[0], anchorZ: anchor[1], scaleX, scaleZ};
  }

  function worldModelPointToMetricDisplay(point) {
    const x = Number(point?.[0]);
    const z = Number(point?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return [0, 0];
    const display = metricEarthGridDisplayFrame();
    if (!display) return [x, z];
    return [
      display.anchorX + (x - display.anchorX) * display.scaleX,
      display.anchorZ + (z - display.anchorZ) * display.scaleZ,
    ];
  }

  function metricDisplayPointToWorldModel(point) {
    const east = Number(point?.[0]);
    const north = Number(point?.[1]);
    if (!Number.isFinite(east) || !Number.isFinite(north)) return [0, 0];
    const display = metricEarthGridDisplayFrame();
    if (!display) return [east, north];
    return [
      display.anchorX + (east - display.anchorX) / display.scaleX,
      display.anchorZ + (north - display.anchorZ) / display.scaleZ,
    ];
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
    // First align with the exact chunk/3D Earth grid, then apply the same local
    // WGS84 metric display correction as every construction primitive. This
    // keeps parcel and model coincident without the equirectangular east/west
    // stretching visible at Berlin's latitude.
    const exact = lonLatToExactWorldModelMm(longitude, latitude);
    if (exact) return modelPointToNorthUp(exact);
    const legacyMetric = lonLatToMetricWorldModelMm(longitude, latitude);
    return legacyMetric ? [legacyMetric[0], -legacyMetric[1]] : null;
  }

  function lonLatToWorldModelMm(longitude, latitude) {
    return lonLatToExactWorldModelMm(longitude, latitude)
      || lonLatToMetricWorldModelMm(longitude, latitude);
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
    // The Core projection is already masked against the selected parcels.
    // A second client-side centre-point test incorrectly removed complete
    // semantic walls, doors and slabs that cross a parcel boundary.
    const activeStoreyId = state.building?.activeStoreyId || state.loadedProjectionStoreyId;
    const localCopies = state.localCopies
      .filter((entry) => entry.viewportRef === viewport?.viewport_ref)
      .map((entry) => entry.primitive);
    return [...(viewport?.primitives || []), ...localCopies].filter((primitive) => {
      if (state.hiddenElementRefs.has(primitive.primitive_ref)) return false;
      const primitiveStoreyId = String(
        primitive.metadata?.storey_id
        || primitive.metadata?.storeyId
        || primitive.metadata?.parameters?.storey_id
        || "",
      );
      if (primitiveStoreyId) return !activeStoreyId || primitiveStoreyId === activeStoreyId;
      return !activeStoreyId || activeStoreyId === state.loadedProjectionStoreyId;
    });
  }

  function primitiveWithPointGeometry(primitive) {
    const geometry = state.pointGeometryOverrides.get(primitive?.primitive_ref);
    return geometry ? {...primitive, geometry: cloneValue(geometry)} : primitive;
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

  function buildingDraftStorageKey(input = state.input) {
    const projectRef = projectContext.coreProjectId
      || projectContext.projectPublicId
      || input?.document?.project_ref
      || "sample";
    return `vectoplan-cad-building.v3:${projectRef}`;
  }

  const defaultStoreyHeightsMm = Object.freeze({
    ground: 2770,
    upper: 2645,
    basement: 2530,
    attic: 1250,
  });

  function buildingStoreyType(storey = {}) {
    const descriptor = `${storey.id || ""} ${storey.name || ""}`.toLowerCase();
    if (/dach|attic/.test(descriptor)) return "attic";
    if (/keller|basement/.test(descriptor) || Number(storey.elevationMm) < 0) return "basement";
    if (/ober|upper/.test(descriptor)) return "upper";
    if (/ground|erdgeschoss/.test(descriptor) || Math.abs(Number(storey.elevationMm) || 0) < 1) return "ground";
    return "upper";
  }

  function defaultStoreyHeightMm(storey = {}) {
    return defaultStoreyHeightsMm[buildingStoreyType(storey)] || defaultStoreyHeightsMm.upper;
  }

  function normalizeStoreyHeightMm(value, storey = {}) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 100 && Math.round(numeric) !== 3000) return Math.round(numeric);
    return defaultStoreyHeightMm(storey);
  }

  function formatStoreyHeightMeters(storey) {
    const separator = storey?.heightDecimalSeparator === "." ? "." : ",";
    const fixed = (Math.max(100, Number(storey?.heightMm) || defaultStoreyHeightMm(storey)) / 1000).toFixed(3);
    const [whole, rawFraction] = fixed.split(".");
    let fraction = rawFraction;
    while (fraction.length > 2 && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
    return `${whole}${separator}${fraction}`;
  }

  function parseStoreyHeightMeters(value) {
    const normalized = String(value || "").trim().replace(/\s+/g, "");
    if (!/^\d+(?:[.,]\d{1,3})?$/.test(normalized)) return null;
    const meters = Number(normalized.replace(",", "."));
    if (!Number.isFinite(meters) || meters < 0.1 || meters > 100) return null;
    return Math.round(meters * 1000);
  }

  function defaultBuildingDraft(input) {
    const profile = input?.document?.plan_profile || {};
    const projectedBuilding = input?.building && typeof input.building === "object" ? input.building : {};
    const storeyId = String(profile.storey_id || "ground_floor");
    const elevationMm = Number(profile.storey_elevation_mm);
    const assetKind = String(profile.asset_kind || "").toLowerCase();
    const explicitStoreyName = String(profile.storey_name || "").trim();
    const inferredName = explicitStoreyName
      || (storeyId.includes("basement") || storeyId.includes("keller") ? "1. Kellergeschoss"
        : storeyId.includes("attic") || storeyId.includes("dach") ? "Dachgeschoss"
        : storeyId.includes("upper") || storeyId.includes("storey-02") ? "1. Obergeschoss"
          : "Erdgeschoss");
    const projectedStoreys = (Array.isArray(projectedBuilding.storeys) ? projectedBuilding.storeys : [])
      .map((storey) => {
        const projectedStorey = {
          id: String(storey.storey_id || storey.storeyId || ""),
          name: String(storey.name || storey.storey_id || "Geschoss"),
          elevationMm: Number(storey.elevation_mm ?? storey.elevationMm) || 0,
          source: String(storey.source || "projection"),
          heightDecimalSeparator: storey.heightDecimalSeparator === "." ? "." : ",",
        };
        projectedStorey.heightMm = defaultStoreyHeightMm(projectedStorey);
        return projectedStorey;
      })
      .filter((storey) => storey.id);
    return {
      contractVersion: "vectoplan-building-draft/0.1",
      buildingType: buildingTypes.has(projectedBuilding.building_type)
        ? projectedBuilding.building_type
        : assetKind.includes("industrie") ? "industrial" : assetKind.includes("wohn") ? "residential" : "residential",
      roofType: ["flat", "gable", "hipped", "pent", "mansard", "other"].includes(projectedBuilding.roof_type)
        ? projectedBuilding.roof_type
        : String(profile.roof_type || "gable"),
      activeStoreyId: storeyId,
      storeys: projectedStoreys.length ? projectedStoreys : [{
        id: storeyId,
        name: inferredName,
        elevationMm: Number.isFinite(elevationMm) ? elevationMm : 0,
        heightMm: defaultStoreyHeightMm({id: storeyId, name: inferredName, elevationMm}),
        heightDecimalSeparator: ",",
        source: "projection",
      }],
    };
  }

  function normalizeBuildingDraft(value, input) {
    const fallback = defaultBuildingDraft(input);
    const source = value && typeof value === "object" ? value : {};
    const storeys = (Array.isArray(source.storeys) ? source.storeys : fallback.storeys)
      .map((entry, index) => {
        const id = String(entry?.id || entry?.storeyId || `storey_${index + 1}`).trim();
        const elevationMm = Number(entry?.elevationMm ?? entry?.elevation_mm);
        const heightMm = Number(entry?.heightMm ?? entry?.height_mm);
        if (!id) return null;
        const storey = {
          id,
          name: String(entry?.name || `Geschoss ${index + 1}`),
          elevationMm: Number.isFinite(elevationMm) ? elevationMm : index * 3000,
          heightDecimalSeparator: entry?.heightDecimalSeparator === "." ? "." : ",",
          source: String(entry?.source || "local"),
        };
        storey.heightMm = normalizeStoreyHeightMm(heightMm, storey);
        return storey;
      })
      .filter(Boolean);
    const projectionStorey = fallback.storeys[0];
    if (!storeys.some((storey) => storey.id === projectionStorey.id)) storeys.push(projectionStorey);
    const activeStoreyId = storeys.some((storey) => storey.id === source.activeStoreyId)
      ? source.activeStoreyId
      : projectionStorey.id;
    return {
      contractVersion: "vectoplan-building-draft/0.1",
      buildingType: buildingTypes.has(source.buildingType) ? source.buildingType : fallback.buildingType,
      roofType: ["flat", "gable", "hipped", "pent", "mansard", "other"].includes(source.roofType) ? source.roofType : fallback.roofType,
      activeStoreyId,
      storeys,
    };
  }

  function loadBuildingDraft(input) {
    const key = buildingDraftStorageKey(input);
    const profile = input?.document?.plan_profile || {};
    state.loadedProjectionStoreyId = String(profile.storey_id || "ground_floor");
    if (state.building && state.buildingStorageKey === key) {
      state.building = normalizeBuildingDraft(state.building, input);
      renderBuildingPanel();
      return;
    }
    let stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(key) || "null");
    } catch (_error) {}
    state.buildingStorageKey = key;
    state.building = normalizeBuildingDraft(stored, input);
    renderBuildingPanel();
  }

  function activeBuildingStorey() {
    return state.building?.storeys?.find((storey) => storey.id === state.building.activeStoreyId) || null;
  }

  function recalculateStoreyElevations() {
    const storeys = state.building?.storeys || [];
    if (!storeys.length) return;
    const ground = storeys.find((storey) => Math.abs(storey.elevationMm) < 1)
      || [...storeys].sort((left, right) => Math.abs(left.elevationMm) - Math.abs(right.elevationMm))[0];
    ground.elevationMm = 0;
    let nextElevation = ground.heightMm;
    storeys
      .filter((storey) => storey !== ground && storey.elevationMm >= 0)
      .sort((left, right) => left.elevationMm - right.elevationMm)
      .forEach((storey) => {
        storey.elevationMm = nextElevation;
        nextElevation += storey.heightMm;
      });
    let lowerElevation = 0;
    storeys
      .filter((storey) => storey !== ground && storey.elevationMm < 0)
      .sort((left, right) => right.elevationMm - left.elevationMm)
      .forEach((storey) => {
        lowerElevation -= storey.heightMm;
        storey.elevationMm = lowerElevation;
      });
  }

  function publishBuildingDraft() {
    if (!state.building) return;
    try {
      window.localStorage.setItem(state.buildingStorageKey, JSON.stringify(state.building));
    } catch (_error) {}
    const detail = {
      contract_version: "vectoplan-building-draft/0.1",
      core_project_id: projectContext.coreProjectId,
      project_public_id: projectContext.projectPublicId,
      building_type: state.building.buildingType,
      roof_type: state.building.roofType,
      active_storey_id: state.building.activeStoreyId,
      storeys: state.building.storeys.map((storey) => ({
        storey_id: storey.id,
        name: storey.name,
        elevation_mm: storey.elevationMm,
        raw_height_mm: storey.heightMm,
      })),
    };
    window.dispatchEvent(new CustomEvent("vectoplan-cad:building-structure", {detail}));
    if (window.parent !== window) window.parent.postMessage({
      type: "vectoplan-cad:building-structure",
      kind: "vectoplan-cad:building-structure",
      source: "vectoplan-cad",
      detail,
    }, "*");
  }

  function buildingStoreyKind(storey) {
    return {
      ground: "Erdgeschoss",
      upper: "Obergeschoss",
      basement: "Kellergeschoss",
      attic: "Dachgeschoss",
    }[buildingStoreyType(storey)];
  }

  function renderBuildingPanel() {
    const building = state.building;
    const list = document.getElementById("building-storeys");
    if (!building || !list) return;
    const active = activeBuildingStorey() || building.storeys[0];
    document.getElementById("current-storey-kind").textContent = buildingStoreyKind(active);
    document.getElementById("current-storey-name").textContent = active.name;
    document.getElementById("current-storey-height").textContent = `${formatStoreyHeightMeters(active)} m`;
    const buildingType = document.getElementById("building-type");
    const roofType = document.getElementById("roof-type");
    if (buildingType) buildingType.value = building.buildingType;
    if (roofType) roofType.value = building.roofType;
    list.replaceChildren();
    [...building.storeys].sort((left, right) => right.elevationMm - left.elevationMm).forEach((storey) => {
      const row = document.createElement("div");
      row.className = "building-storey";
      row.classList.toggle("is-active", storey.id === building.activeStoreyId);
      const select = document.createElement("button");
      select.type = "button";
      select.className = "building-storey__select";
      select.textContent = storey.id === building.activeStoreyId ? "●" : "○";
      select.title = `${storey.name} anzeigen`;
      select.addEventListener("click", () => selectBuildingStorey(storey.id));
      const name = document.createElement("input");
      name.type = "text";
      name.className = "building-storey__name";
      name.value = storey.name;
      name.setAttribute("aria-label", "Geschossname");
      name.addEventListener("change", () => {
        storey.name = name.value.trim() || storey.name;
        publishBuildingDraft();
        renderBuildingPanel();
      });
      const heightWrap = document.createElement("label");
      heightWrap.className = "building-storey__height";
      const height = document.createElement("input");
      height.type = "text";
      height.inputMode = "decimal";
      height.autocomplete = "off";
      height.value = formatStoreyHeightMeters(storey);
      height.setAttribute("aria-label", `Rohhöhe ${storey.name} in Metern`);
      height.addEventListener("change", () => {
        const parsedHeightMm = parseStoreyHeightMeters(height.value);
        if (parsedHeightMm === null) {
          height.value = formatStoreyHeightMeters(storey);
          showMessage("Bitte die Geschosshöhe in Metern eingeben, zum Beispiel 2,77 oder 2.77.");
          return;
        }
        storey.heightDecimalSeparator = height.value.includes(".") ? "." : height.value.includes(",") ? "," : storey.heightDecimalSeparator;
        storey.heightMm = parsedHeightMm;
        recalculateStoreyElevations();
        publishBuildingDraft();
        renderBuildingPanel();
      });
      heightWrap.append(height, Object.assign(document.createElement("small"), {textContent: "m"}));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "building-storey__remove";
      remove.textContent = "×";
      remove.title = `${storey.name} entfernen`;
      remove.disabled = building.storeys.length <= 1;
      remove.addEventListener("click", () => removeBuildingStorey(storey.id));
      row.append(select, name, heightWrap, remove);
      list.append(row);
    });
    syncPlanWorkspacePanel();
  }

  function selectBuildingStorey(storeyId) {
    if (!state.building?.storeys.some((storey) => storey.id === storeyId)) return;
    state.building.activeStoreyId = storeyId;
    state.selectedPrimitive = null;
    publishBuildingDraft();
    renderAll();
    renderBuildingPanel();
    const active = activeBuildingStorey();
    if (projectContext.coreProjectId && active?.source === "core-construction-model") {
      loadProjectInput({storeyId, preserveCamera: true, preserveHistory: true, preserveViewState: true}).catch(handleError);
    }
    showMessage(`${active?.name || "Geschoss"} ist jetzt das aktive Konstruktionsgeschoss.`);
  }

  function addBuildingStorey(kind) {
    const building = state.building;
    if (!building) return;
    const isBasement = kind === "basement";
    const isAttic = kind === "attic";
    const related = building.storeys.filter((storey) => buildingStoreyType(storey) === kind);
    const number = related.length + 1;
    const idBase = isBasement ? "basement" : isAttic ? "attic" : "upper_floor";
    let id = `${idBase}_${number}`;
    let suffix = number;
    while (building.storeys.some((storey) => storey.id === id)) id = `${idBase}_${++suffix}`;
    const heightMm = defaultStoreyHeightsMm[isBasement ? "basement" : isAttic ? "attic" : "upper"];
    const elevationMm = isBasement
      ? Math.min(...building.storeys.map((storey) => storey.elevationMm), 0) - heightMm
      : Math.max(...building.storeys.map((storey) => storey.elevationMm + storey.heightMm), 0);
    building.storeys.push({
      id,
      name: isBasement ? `${number}. Kellergeschoss` : isAttic ? (number === 1 ? "Dachgeschoss" : `${number}. Dachgeschoss`) : `${number}. Obergeschoss`,
      elevationMm,
      heightMm,
      heightDecimalSeparator: ",",
      source: "local",
    });
    recalculateStoreyElevations();
    building.activeStoreyId = id;
    state.selectedPrimitive = null;
    publishBuildingDraft();
    renderAll();
    renderBuildingPanel();
    showMessage(`${activeBuildingStorey().name} hinzugefügt und aktiviert.`);
  }

  function removeBuildingStorey(storeyId) {
    const building = state.building;
    if (!building || building.storeys.length <= 1) return;
    const removed = building.storeys.find((storey) => storey.id === storeyId);
    building.storeys = building.storeys.filter((storey) => storey.id !== storeyId);
    recalculateStoreyElevations();
    if (building.activeStoreyId === storeyId) {
      building.activeStoreyId = [...building.storeys].sort((left, right) => Math.abs(left.elevationMm) - Math.abs(right.elevationMm))[0].id;
    }
    publishBuildingDraft();
    renderAll();
    renderBuildingPanel();
    showMessage(`${removed?.name || "Geschoss"} entfernt.`);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    let data;
    try {
      data = await response.json();
    } catch (_error) {
      const error = new Error(`Ungültige Serverantwort (HTTP ${response.status})`);
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const details = Array.isArray(data.errors) ? data.errors.join(" · ") : null;
      const nestedError = data.error && typeof data.error === "object"
        ? (data.error.message || data.error.code)
        : null;
      const errorCode = typeof data.error === "string" ? data.error : null;
      const error = new Error(details || data.message || nestedError || errorCode || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = errorCode || "";
      throw error;
    }
    return data;
  }

  function isRetryableCommandError(error) {
    const status = Number(error?.status) || 0;
    return status === 0 || [408, 425, 429, 500, 502, 503, 504].includes(status);
  }

  async function dispatchCadCommandRequest(payload) {
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await fetchJson(`${routePrefix}/commands`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastError = error;
        if (!isRetryableCommandError(error) || attempt === 4) throw error;
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(1200, 150 * (2 ** attempt))));
      }
    }
    throw lastError;
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

  async function loadPlanRules() {
    try {
      const rules = await fetchJson(`${routePrefix}/plan-rules`);
      state.planRules = rules?.contract_version === "cad-plan-rules/0.1" ? rules : fallbackPlanRules;
    } catch (error) {
      state.planRules = fallbackPlanRules;
      console.warn("Planregeln konnten nicht geladen werden; lokale Regeln werden verwendet", error);
    }
    syncPlanWorkspacePanel();
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

  function toggleBuildingPanel() {
    const panel = document.getElementById("building-panel");
    const body = document.getElementById("building-panel-body");
    const toggle = document.querySelector('[data-action="toggle-building"]');
    if (!panel || !body || !toggle) return;
    const expanded = body.hidden;
    body.hidden = !expanded;
    panel.classList.toggle("is-expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
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
    if (!options.preserveViewState) {
      state.planOverview = false;
      state.planOverviewPreviousCamera = null;
      state.pointEditMode = false;
      state.pointDrag = null;
    }
    syncPlanOverviewButton();
    state.activeSheetRef = input.sheets[0]?.sheet_ref || null;
    state.activeViewportRef = input.sheets[0]?.viewports?.find((viewport) => viewport.kind === "floor_plan")?.viewport_ref || null;
    state.selectedPrimitive = null;
    if (!options.preserveHistory) {
      state.commands = [];
      state.redoCommands = [];
      state.worldSelection = null;
      state.elementEdits.clear();
      state.localCopies = [];
      state.hiddenElementRefs.clear();
      state.clipboard = null;
    }
    if (!options.preserveCamera) {
      state.camera = null;
      state.baseCameraWidth = null;
    }
    state.visibleLayers.clear();
    state.knownLayers.clear();
    cancelDrawing(false);
    loadBuildingDraft(input);
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
    const activeStorey = activeBuildingStorey();
    const requestedStoreyId = String(options.storeyId
      || (activeStorey?.source === "core-construction-model" ? activeStorey.id : ""));
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
            ...(requestedStoreyId ? {storeyId: requestedStoreyId} : {}),
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
        preserveViewState: options.background || options.preserveViewState,
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
      loadProjectInput({preserveCamera: true, preserveHistory: true, preserveViewState: true}).catch(handleError);
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
    renderInspector();
    renderCommandLog();
    syncHistoryButtons();
    syncEditToolButtons();
  }

  function modelPointToNorthUp(point) {
    if (!Array.isArray(point) || !Number.isFinite(Number(point[0])) || !Number.isFinite(Number(point[1]))) return [0, 0];
    if (!state.parcelSelection?.projectCoordinate) return [Number(point[0]), Number(point[1])];
    const [east, north] = worldModelPointToMetricDisplay(point);
    return [east, -north];
  }

  function northUpPointToModel(point) {
    if (!state.parcelSelection?.projectCoordinate) return [Number(point[0]) || 0, Number(point[1]) || 0];
    const east = Number(point[0]) || 0;
    const north = -(Number(point[1]) || 0);
    return metricDisplayPointToWorldModel([east, north]);
  }

  function normalizedPolygonPoints(points) {
    const normalized = (points || [])
      .filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map((point) => [Number(point[0]), Number(point[1])]);
    if (normalized.length > 1 && Math.hypot(
      normalized[0][0] - normalized.at(-1)[0],
      normalized[0][1] - normalized.at(-1)[1],
    ) < 0.5) normalized.pop();
    return normalized;
  }

  function polygonAreaAndCentroid(points) {
    const ring = normalizedPolygonPoints(points);
    if (ring.length < 3) return {areaMm2: 0, centroid: ring[0] || [0, 0]};
    let twiceArea = 0;
    let weightedX = 0;
    let weightedY = 0;
    ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      const cross = point[0] * next[1] - next[0] * point[1];
      twiceArea += cross;
      weightedX += (point[0] + next[0]) * cross;
      weightedY += (point[1] + next[1]) * cross;
    });
    if (Math.abs(twiceArea) < 1e-6) {
      return {
        areaMm2: 0,
        centroid: [
          ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
          ring.reduce((sum, point) => sum + point[1], 0) / ring.length,
        ],
      };
    }
    return {
      areaMm2: Math.abs(twiceArea) / 2,
      centroid: [weightedX / (3 * twiceArea), weightedY / (3 * twiceArea)],
    };
  }

  function northUpPrimitive(primitive) {
    const source = primitive?.geometry || {};
    const geometry = {...source};
    let primitiveType = primitive.primitive_type;
    if (primitiveType === "room") {
      if (normalizedPolygonPoints(source.points_mm).length >= 3) {
        geometry.points_mm = normalizedPolygonPoints(source.points_mm).map(modelPointToNorthUp);
        geometry.label_point_mm = Array.isArray(source.label_point_mm)
          ? modelPointToNorthUp(source.label_point_mm)
          : polygonAreaAndCentroid(geometry.points_mm).centroid;
      } else {
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
      }
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
      if (normalizedPolygonPoints(geometry.points_mm).length >= 3) {
        points = normalizedPolygonPoints(geometry.points_mm);
      } else {
      return {
        x: geometry.x_mm,
        y: geometry.y_mm,
        width: geometry.width_mm,
        height: geometry.depth_mm,
      };
      }
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

  function cameraForBounds(bounds, paddingFactor = 1.2) {
    if (!bounds) return {x: -1000, y: -1000, width: 16000, height: 12000};
    const paddedWidth = Math.max(1, bounds.width) * paddingFactor;
    const paddedHeight = Math.max(1, bounds.height) * paddingFactor;
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

  function planOverviewBounds(viewport = currentViewport()) {
    const bounds = visibleViewportPrimitives(viewport)
      .map((primitive) => northUpPrimitive(primitiveWithPointGeometry(primitive)))
      .map((primitive) => {
        const primitiveBounds = primitiveModelBounds(primitive);
        if (!primitiveBounds) return null;
        const edit = state.elementEdits.get(primitive.primitive_ref) || {};
        const translateX = Number(edit.translateX) || 0;
        const translateY = Number(edit.translateY) || 0;
        const scaleX = Math.abs(Number.isFinite(Number(edit.scaleX)) ? Number(edit.scaleX) : 1);
        const scaleY = Math.abs(Number.isFinite(Number(edit.scaleY)) ? Number(edit.scaleY) : 1);
        const rotation = Math.abs((Number(edit.rotation) || 0) % 180);
        const swapsAxes = rotation > 45 && rotation < 135;
        const width = primitiveBounds.width * (swapsAxes ? scaleY : scaleX);
        const height = primitiveBounds.height * (swapsAxes ? scaleX : scaleY);
        const centreX = primitiveBounds.x + primitiveBounds.width / 2 + translateX;
        const centreY = primitiveBounds.y + primitiveBounds.height / 2 + translateY;
        return {x: centreX - width / 2, y: centreY - height / 2, width, height};
      })
      .filter(Boolean);
    if (!bounds.length) return northUpBounds(viewport?.model_view_box_mm);
    const minX = Math.min(...bounds.map((entry) => entry.x));
    const minY = Math.min(...bounds.map((entry) => entry.y));
    const maxX = Math.max(...bounds.map((entry) => entry.x + entry.width));
    const maxY = Math.max(...bounds.map((entry) => entry.y + entry.height));
    return {x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY)};
  }

  function planSheetBounds() {
    return {x: 0, y: 0, width: 42000, height: 29700};
  }

  function activePlanRules() {
    return state.planRules || fallbackPlanRules;
  }

  function activePlanProfile() {
    const rules = activePlanRules();
    return rules.profiles?.[state.building?.buildingType] || rules.profiles?.other || fallbackPlanRules.profiles.other;
  }

  function planContentLabel(content) {
    const rules = activePlanRules();
    const profile = activePlanProfile();
    return profile.aliases?.[content] || rules.content_labels?.[content] || content;
  }

  function planViewOptions(content = state.planContent) {
    if (content === "floor_plans") {
      return (state.building?.storeys || []).map((storey) => ({value: storey.id, label: storey.name}));
    }
    if (content === "elevations") return [
      {value: "north", label: "Ansicht Nord"}, {value: "east", label: "Ansicht Ost"},
      {value: "south", label: "Ansicht Süd"}, {value: "west", label: "Ansicht West"},
    ];
    if (content === "sections") return [{value: "section-a", label: "Schnitt A–A"}, {value: "section-b", label: "Schnitt B–B"}];
    if (content === "site_plan") return [{value: "site", label: "Lageplan mit Grundstück"}];
    if (content === "title_block") return [{value: "title", label: "Projekt-Plankopf"}];
    return [{value: "all", label: "Alle Planteile"}];
  }

  function syncPlanWorkspacePanel() {
    const panel = document.getElementById("plan-workspace-panel");
    if (!panel) return;
    panel.hidden = !state.planOverview;
    const phaseSelect = document.getElementById("plan-phase");
    const contentSelect = document.getElementById("plan-content");
    if (phaseSelect) phaseSelect.value = state.planPhase;
    if (contentSelect) state.planContent = contentSelect.value = state.planContent;
    const viewSelect = document.getElementById("plan-view-selection");
    const options = planViewOptions();
    if (viewSelect) {
      viewSelect.replaceChildren();
      options.forEach((option) => {
        const node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        viewSelect.append(node);
      });
      if (!options.some((option) => option.value === state.planViewSelection)) state.planViewSelection = options[0]?.value || "all";
      viewSelect.value = state.planViewSelection;
    }
    const profile = activePlanProfile();
    const profileLabel = document.getElementById("plan-building-profile");
    if (profileLabel) profileLabel.textContent = profile.label;
    const chips = document.getElementById("plan-required-content");
    if (chips) {
      chips.replaceChildren();
      (profile.required || []).forEach((content) => {
        const chip = document.createElement("span");
        chip.textContent = planContentLabel(content);
        chips.append(chip);
      });
    }
    const summary = document.getElementById("plan-rule-summary");
    const phase = activePlanRules().phases?.[state.planPhase];
    if (summary) summary.textContent = phase?.summary || "";
  }

  function planOverviewCamera() {
    return cameraForBounds(planSheetBounds(), 1.06);
  }

  function syncPlanOverviewButton() {
    const button = document.querySelector('[data-view-action="plan-overview"]');
    if (!button) return;
    button.classList.toggle("is-active", state.planOverview);
    button.setAttribute("aria-pressed", String(state.planOverview));
    button.title = state.planOverview ? "Zur normalen Ansicht zurück" : "Gesamten Plan anzeigen";
    app.classList.toggle("is-plan-overview", state.planOverview);
    syncPlanWorkspacePanel();
  }

  function togglePlanOverview() {
    if (!state.planOverview) {
      state.planOverviewPreviousCamera = state.camera ? {...state.camera} : null;
      state.planOverview = true;
      state.pointEditMode = false;
      state.pointDrag = null;
      selectTool("select");
      state.camera = planOverviewCamera();
      showMessage("Planansicht aktiv · Planart und Planteil können rechts ausgewählt werden.");
    } else {
      state.planOverview = false;
      state.camera = state.planOverviewPreviousCamera || viewportCamera(currentViewport());
      state.planOverviewPreviousCamera = null;
      showMessage("Normale CAD-Ansicht wiederhergestellt.");
    }
    syncPlanOverviewButton();
    renderPlan();
    syncEditToolButtons();
  }

  function planTile(group, rect, title, subtitle = "") {
    group.append(
      svgEl("rect", {x: rect.x, y: rect.y, width: rect.width, height: rect.height, class: "plan-tile"}),
      svgEl("text", {x: rect.x + 380, y: rect.y + 590, class: "plan-tile-title"}, title.toUpperCase()),
    );
    if (subtitle) group.append(svgEl("text", {x: rect.x + 380, y: rect.y + 940, class: "plan-tile-subtitle"}, subtitle));
    return {x: rect.x + 450, y: rect.y + 1200, width: rect.width - 900, height: rect.height - 1650};
  }

  function formatPlanDimension(valueMm) {
    return `${(Math.max(0, Number(valueMm) || 0) / 1000).toFixed(2).replace(".", ",")} m`;
  }

  function appendExteriorDimensions(group, bounds) {
    if (!bounds) return;
    const offset = Math.max(700, Math.min(bounds.width, bounds.height) * 0.08);
    const tick = Math.max(110, offset * 0.18);
    const topY = bounds.y - offset;
    const leftX = bounds.x - offset;
    group.append(
      svgEl("line", {x1: bounds.x, y1: bounds.y, x2: bounds.x, y2: topY - tick, class: "plan-dimension-witness"}),
      svgEl("line", {x1: bounds.x + bounds.width, y1: bounds.y, x2: bounds.x + bounds.width, y2: topY - tick, class: "plan-dimension-witness"}),
      svgEl("line", {x1: bounds.x, y1: topY, x2: bounds.x + bounds.width, y2: topY, class: "plan-dimension-line"}),
      svgEl("line", {x1: bounds.x, y1: topY - tick, x2: bounds.x, y2: topY + tick, class: "plan-dimension-line"}),
      svgEl("line", {x1: bounds.x + bounds.width, y1: topY - tick, x2: bounds.x + bounds.width, y2: topY + tick, class: "plan-dimension-line"}),
      svgEl("text", {x: bounds.x + bounds.width / 2, y: topY - tick * 0.65, class: "plan-dimension-text"}, formatPlanDimension(bounds.width)),
      svgEl("line", {x1: bounds.x, y1: bounds.y, x2: leftX - tick, y2: bounds.y, class: "plan-dimension-witness"}),
      svgEl("line", {x1: bounds.x, y1: bounds.y + bounds.height, x2: leftX - tick, y2: bounds.y + bounds.height, class: "plan-dimension-witness"}),
      svgEl("line", {x1: leftX, y1: bounds.y, x2: leftX, y2: bounds.y + bounds.height, class: "plan-dimension-line"}),
      svgEl("line", {x1: leftX - tick, y1: bounds.y, x2: leftX + tick, y2: bounds.y, class: "plan-dimension-line"}),
      svgEl("line", {x1: leftX - tick, y1: bounds.y + bounds.height, x2: leftX + tick, y2: bounds.y + bounds.height, class: "plan-dimension-line"}),
      svgEl("text", {x: leftX - tick * 0.65, y: bounds.y + bounds.height / 2, class: "plan-dimension-text", transform: `rotate(-90 ${leftX - tick * 0.65} ${bounds.y + bounds.height / 2})`}, formatPlanDimension(bounds.height)),
    );
  }

  function renderPlanFloorPlan(group, rect) {
    const viewport = currentViewport();
    const bounds = planOverviewBounds(viewport);
    if (!bounds) {
      group.append(svgEl("text", {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, class: "plan-placeholder"}, "Kein Grundriss vorhanden"));
      return;
    }
    const dimensionPad = Math.max(1100, Math.max(bounds.width, bounds.height) * 0.13);
    const total = {x: bounds.x - dimensionPad, y: bounds.y - dimensionPad, width: bounds.width + dimensionPad * 1.35, height: bounds.height + dimensionPad * 1.35};
    const scale = Math.min(rect.width / Math.max(total.width, 1), rect.height / Math.max(total.height, 1));
    const offsetX = rect.x + (rect.width - total.width * scale) / 2;
    const offsetY = rect.y + (rect.height - total.height * scale) / 2;
    const layer = svgEl("g", {transform: `translate(${offsetX} ${offsetY}) scale(${scale}) translate(${-total.x} ${-total.y})`, "pointer-events": "none"});
    visibleViewportPrimitives(viewport)
      .map((primitive) => northUpPrimitive(primitiveWithPointGeometry(primitive)))
      .filter((primitive) => state.visibleLayers.has(primitive.layer_ref))
      .sort((left, right) => (renderStyleOrder[left.style_ref] ?? 50) - (renderStyleOrder[right.style_ref] ?? 50))
      .forEach((primitive) => layer.append(renderPrimitive(primitive)));
    appendExteriorDimensions(layer, bounds);
    group.append(layer);
  }

  function renderPlanSitePlan(group, rect) {
    const rings = (state.parcelSelection?.parcels || []).flatMap((parcel) => parcelModelPolygons(parcel).flatMap((polygon) => polygon));
    const buildingBounds = planOverviewBounds();
    const points = rings.flat();
    if (buildingBounds) points.push([buildingBounds.x, buildingBounds.y], [buildingBounds.x + buildingBounds.width, buildingBounds.y + buildingBounds.height]);
    if (!points.length) {
      group.append(svgEl("text", {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, class: "plan-placeholder"}, "Grundstück noch nicht gewählt"));
      return;
    }
    const minX = Math.min(...points.map((point) => point[0]));
    const maxX = Math.max(...points.map((point) => point[0]));
    const minY = Math.min(...points.map((point) => point[1]));
    const maxY = Math.max(...points.map((point) => point[1]));
    const scale = Math.min(rect.width / Math.max(maxX - minX, 1), rect.height / Math.max(maxY - minY, 1)) * 0.86;
    const tx = rect.x + rect.width / 2 - (minX + maxX) / 2 * scale;
    const ty = rect.y + rect.height / 2 - (minY + maxY) / 2 * scale;
    const layer = svgEl("g", {transform: `translate(${tx} ${ty}) scale(${scale})`, "pointer-events": "none"});
    rings.forEach((ring) => layer.append(svgEl("polygon", {points: ring.map((point) => point.join(",")).join(" "), class: "plan-symbol-line"})));
    if (buildingBounds) layer.append(svgEl("rect", {x: buildingBounds.x, y: buildingBounds.y, width: buildingBounds.width, height: buildingBounds.height, class: "plan-symbol-accent"}));
    group.append(layer, svgEl("text", {x: rect.x + rect.width - 580, y: rect.y + 620, class: "plan-north-arrow"}, "N↑"));
  }

  function renderBuildingSchematic(group, rect, kind = "elevation") {
    const profile = activePlanProfile().profile;
    const x = rect.x + rect.width * 0.08;
    const y = rect.y + rect.height * 0.82;
    const width = rect.width * 0.84;
    const height = rect.height * 0.62;
    if (profile === "bridge") {
      group.append(svgEl("line", {x1: x, y1: y - height * 0.5, x2: x + width, y2: y - height * 0.5, class: "plan-symbol-accent"}));
      [0.2, 0.5, 0.8].forEach((ratio) => group.append(svgEl("path", {d: `M ${x + width * ratio - 260} ${y} L ${x + width * ratio} ${y - height * 0.5} L ${x + width * ratio + 260} ${y}`, class: "plan-symbol-line"})));
      group.append(svgEl("line", {x1: x, y1: y, x2: x + width, y2: y, class: "plan-symbol-line"}));
      return;
    }
    if (profile === "tunnel") {
      group.append(svgEl("path", {d: `M ${x + width * 0.2} ${y} A ${width * 0.3} ${height * 0.75} 0 0 1 ${x + width * 0.8} ${y}`, class: "plan-symbol-accent"}));
      group.append(svgEl("line", {x1: x + width * 0.15, y1: y, x2: x + width * 0.85, y2: y, class: "plan-symbol-line"}));
      return;
    }
    if (profile === "landscape") {
      [0, 0.18, 0.35, 0.5].forEach((ratio, index) => group.append(svgEl("path", {d: `M ${x} ${y - ratio * height} Q ${x + width * 0.35} ${y - (ratio + 0.15) * height} ${x + width * 0.6} ${y - (ratio + 0.04 * index) * height} T ${x + width} ${y - (ratio + 0.1) * height}`, class: index === 0 ? "plan-symbol-accent" : "plan-symbol-line"})));
      return;
    }
    const storeys = [...(state.building?.storeys || [])].filter((storey) => storey.elevationMm >= 0).sort((a, b) => a.elevationMm - b.elevationMm);
    const count = Math.max(1, storeys.length);
    const wallTop = y - height * 0.72;
    group.append(svgEl("rect", {x, y: wallTop, width, height: y - wallTop, class: "plan-symbol-fill"}));
    for (let index = 1; index < count; index += 1) {
      const lineY = y - (y - wallTop) * index / count;
      group.append(svgEl("line", {x1: x, y1: lineY, x2: x + width, y2: lineY, class: "plan-symbol-line"}));
    }
    const roof = state.building?.roofType || "gable";
    if (roof === "flat") group.append(svgEl("line", {x1: x - 180, y1: wallTop, x2: x + width + 180, y2: wallTop, class: "plan-symbol-accent"}));
    else if (roof === "pent") group.append(svgEl("path", {d: `M ${x - 180} ${wallTop} L ${x + width + 180} ${wallTop - height * 0.22}`, class: "plan-symbol-accent"}));
    else group.append(svgEl("path", {d: `M ${x - 180} ${wallTop} L ${x + width / 2} ${wallTop - height * 0.28} L ${x + width + 180} ${wallTop}`, class: "plan-symbol-accent"}));
    if (kind === "section") {
      group.append(svgEl("line", {x1: x + width * 0.18, y1: wallTop, x2: x + width * 0.18, y2: y, class: "plan-symbol-accent"}));
    }
  }

  function renderPlanTitleBlock(group, rect) {
    const phase = activePlanRules().phases?.[state.planPhase];
    const projectName = state.input?.document?.project_ref || projectContext.projectPublicId || "VECTOPLAN Projekt";
    const rows = [
      ["PROJEKT", projectName],
      ["PLAN", `${phase?.label || "Plan"} · ${planContentLabel(state.planContent === "overview" ? "floor_plans" : state.planContent)}`],
      ["BAUWERK", activePlanProfile().label],
      ["MASSSTAB", state.planContent === "site_plan" ? "1:500" : "1:100"],
    ];
    const rowHeight = rect.height / rows.length;
    rows.forEach(([label, value], index) => {
      const rowY = rect.y + index * rowHeight;
      group.append(
        svgEl("rect", {x: rect.x, y: rowY, width: rect.width, height: rowHeight, class: "plan-title-row"}),
        svgEl("text", {x: rect.x + 260, y: rowY + rowHeight * 0.34, class: "plan-title-label"}, label),
        svgEl("text", {x: rect.x + 260, y: rowY + rowHeight * 0.76, class: "plan-title-value"}, value),
      );
    });
  }

  function renderPlanContent(group, content, rect) {
    if (content === "floor_plans") renderPlanFloorPlan(group, rect);
    else if (content === "site_plan") renderPlanSitePlan(group, rect);
    else if (content === "elevations") renderBuildingSchematic(group, rect, "elevation");
    else if (content === "sections") renderBuildingSchematic(group, rect, "section");
    else if (content === "title_block") renderPlanTitleBlock(group, rect);
  }

  function renderPlanWorkspace() {
    const camera = state.camera;
    const sheet = planSheetBounds();
    svg.append(
      svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, class: "workspace-plane"}),
      svgEl("rect", {x: sheet.x + 350, y: sheet.y + 350, width: sheet.width - 700, height: sheet.height - 700, class: "plan-sheet"}),
      svgEl("rect", {x: 750, y: 750, width: 40500, height: 28200, class: "plan-sheet-frame"}),
    );
    const group = svgEl("g", {class: "plan-workspace-sheet"});
    const phase = activePlanRules().phases?.[state.planPhase];
    group.append(
      svgEl("text", {x: 1250, y: 1550, class: "plan-sheet-heading"}, `${phase?.label || "PLAN"} · ${activePlanProfile().label}`),
      svgEl("text", {x: 1250, y: 2050, class: "plan-sheet-meta"}, `VECTOPLAN CAD · ${activeBuildingStorey()?.name || "Aktives Geschoss"} · automatische Außenbemaßung`),
    );
    if (state.planContent === "overview") {
      const tiles = [
        ["floor_plans", {x: 1200, y: 2450, width: 25200, height: 15100}],
        ["site_plan", {x: 27000, y: 2450, width: 13200, height: 7100}],
        ["elevations", {x: 27000, y: 9950, width: 13200, height: 7600}],
        ["sections", {x: 1200, y: 17950, width: 25200, height: 9000}],
        ["title_block", {x: 27000, y: 17950, width: 13200, height: 9000}],
      ];
      tiles.forEach(([content, tileRect]) => {
        const contentRect = planTile(group, tileRect, planContentLabel(content), content === "floor_plans" ? (activeBuildingStorey()?.name || "") : "");
        renderPlanContent(group, content, contentRect);
      });
    } else {
      const tileRect = {x: 1200, y: 2450, width: 39000, height: 24500};
      const selectedOption = planViewOptions().find((option) => option.value === state.planViewSelection);
      const contentRect = planTile(group, tileRect, planContentLabel(state.planContent), selectedOption?.label || "");
      renderPlanContent(group, state.planContent, contentRect);
    }
    svg.append(group);
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
    return cameraForBounds(bounds, 1.2);
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
    const activeStorey = activeBuildingStorey();
    svg.setAttribute("aria-label", `${activeStorey?.name || "Erdgeschoss"}-Grundriss auf unbegrenzter Modellfläche`);

    const defs = svgEl("defs");
    const slabPattern = svgEl("pattern", {id: "cad-slab-hatch", width: 420, height: 420, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"});
    slabPattern.append(svgEl("line", {x1: 0, y1: 0, x2: 0, y2: 420, class: "slab-hatch-line"}));
    const roofPattern = svgEl("pattern", {id: "cad-roof-hatch", width: 620, height: 620, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-45)"});
    roofPattern.append(svgEl("line", {x1: 0, y1: 0, x2: 0, y2: 620, class: "roof-hatch-line"}));
    const wallDraftPattern = svgEl("pattern", {id: "cad-wall-draft-hatch", width: 90, height: 90, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"});
    wallDraftPattern.append(svgEl("line", {x1: 0, y1: 0, x2: 0, y2: 90, class: "draft-wall-hatch-line"}));
    defs.append(slabPattern, roofPattern, wallDraftPattern);
    svg.append(defs);
    if (state.planOverview) {
      renderPlanWorkspace();
      return;
    }
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, class: "workspace-plane"}));
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
      svg.append(svgEl("text", {x: displayBounds.x + 120, y: displayBounds.y - 220, class: "model-frame-label"}, `${(activeStorey?.name || "Erdgeschoss").toUpperCase()} · MODELLBEREICH`));
    }
    visibleViewportPrimitives(viewport)
      .map((primitive) => northUpPrimitive(primitiveWithPointGeometry(primitive)))
      .sort((left, right) => (renderStyleOrder[left.style_ref] ?? 50) - (renderStyleOrder[right.style_ref] ?? 50))
      .forEach((primitive) => svg.append(renderPrimitive(primitive)));
    renderWorldSelection();
    renderPointModifyHandles();
    renderPendingDrawSegments();
    renderDraft();
    renderCrosshair();
  }

  function primitiveEditTransform(primitive) {
    const edit = state.elementEdits.get(primitive.primitive_ref);
    if (!edit) return "";
    const bounds = primitiveModelBounds(primitive);
    if (!bounds) return "";
    const centreX = bounds.x + bounds.width / 2;
    const centreY = bounds.y + bounds.height / 2;
    const translateX = Number(edit.translateX) || 0;
    const translateY = Number(edit.translateY) || 0;
    const rotation = Number(edit.rotation) || 0;
    const scaleX = Number.isFinite(Number(edit.scaleX)) ? Number(edit.scaleX) : 1;
    const scaleY = Number.isFinite(Number(edit.scaleY)) ? Number(edit.scaleY) : 1;
    const skewX = Number(edit.skewX) || 0;
    return `translate(${translateX} ${translateY}) translate(${centreX} ${centreY}) rotate(${rotation}) skewX(${skewX}) scale(${scaleX} ${scaleY}) translate(${-centreX} ${-centreY})`;
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
    const visual = node;
    node = svgEl("g");
    node.append(visual);
    node.classList.add("primitive", `primitive-${primitive.style_ref || "line"}`);
    node.dataset.elementRef = primitive.primitive_ref;
    node.dataset.layer = primitive.layer_ref;
    if (primitive.metadata?.local_draft) node.classList.add("local-draft");
    if (!state.visibleLayers.has(primitive.layer_ref)) node.classList.add("layer-hidden");
    if (state.selectedPrimitive?.primitive_ref === primitive.primitive_ref) node.classList.add("is-selected");
    const transform = primitiveEditTransform(primitive);
    if (transform) node.setAttribute("transform", transform);
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || state.activeTool !== "select" || state.spacePressed) return;
      if (event.pointerType !== "touch") event.stopPropagation();
      state.selectedPrimitive = primitive;
      renderPlan();
      renderInspector();
      syncEditToolButtons();
    });
    if (primitive.primitive_type === "room") {
      node.classList.add("room-is-editable");
      node.addEventListener("dblclick", (event) => {
        if (projectContext.readOnly) return;
        event.preventDefault();
        event.stopPropagation();
        openRoomLabelEditor(primitive);
      });
    }
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
    const group = svgEl("g");
    const polygon = normalizedPolygonPoints(geometry.points_mm);
    let labelPoint;
    if (polygon.length >= 3) {
      group.append(polygonNode(polygon, "room-fill"));
      labelPoint = Array.isArray(geometry.label_point_mm)
        ? geometry.label_point_mm
        : polygonAreaAndCentroid(polygon).centroid;
    } else {
      const x = Number(geometry.x_mm) || 0;
      const y = Number(geometry.y_mm) || 0;
      const width = Number(geometry.width_mm) || 1;
      const depth = Number(geometry.depth_mm) || 1;
      group.append(svgEl("rect", {x, y, width, height: depth, class: "room-fill"}));
      labelPoint = [x + width / 2, y + depth / 2];
    }
    const lines = String(primitive.text || primitive.metadata?.label || "Raum").split("\n");
    group.append(svgEl("text", {
      x: labelPoint[0], y: labelPoint[1] - 45, class: "room-label room-label-editable",
      title: "Doppelklick zum Umbenennen",
    }, lines[0] || "Raum"));
    group.append(svgEl("text", {x: labelPoint[0], y: labelPoint[1] + 155, class: "room-area"}, lines[1] || `${Number(geometry.area_m2 || 0).toFixed(2)} m²`));
    return group;
  }

  function semanticStrokePair(thickness) {
    const border = Math.max(8, thickness * 0.012);
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

  function activeWallThicknessMm() {
    const dimensions = state.selectedLibraryVariant?.dimensions || state.selectedLibraryItem?.dimensions || {};
    return Number(dimensions.thickness_mm)
      || Number(dimensions.depth_mm)
      || Number(document.getElementById("wall-thickness")?.value)
      || 240;
  }

  function wallEdgeGeometry(start, end, thickness) {
    const deltaX = end[0] - start[0];
    const deltaY = end[1] - start[1];
    const length = Math.hypot(deltaX, deltaY);
    if (length <= 0) return null;
    // Die gezeichnete Linie ist eine Wandkante. Der Wandkörper liegt immer
    // links von der Zeichenrichtung: nach rechts = Außenkante, nach links = Innenkante.
    const offset = [deltaY / length * thickness, -deltaX / length * thickness];
    return {
      referenceStart: [...start],
      referenceEnd: [...end],
      centreStart: [start[0] + offset[0] / 2, start[1] + offset[1] / 2],
      centreEnd: [end[0] + offset[0] / 2, end[1] + offset[1] / 2],
      bodyPoints: [
        [...start],
        [...end],
        [end[0] + offset[0], end[1] + offset[1]],
        [start[0] + offset[0], start[1] + offset[1]],
      ],
      referenceRole: deltaX >= 0 ? "outside" : "inside",
    };
  }

  function appendWallPreview(group, start, end, thickness, pending = false) {
    const edge = wallEdgeGeometry(start, end, thickness);
    if (edge) {
      group.append(svgEl("polygon", {
        points: edge.bodyPoints.map((point) => point.join(",")).join(" "),
        class: pending ? "draft-wall-preview pending-draw-preview" : "draft-wall-preview",
      }));
      group.append(svgEl("line", {
        x1: start[0], y1: start[1], x2: end[0], y2: end[1],
        class: pending ? "draft-wall-reference pending-draw-preview" : "draft-wall-reference",
        "data-reference-role": edge.referenceRole,
      }));
    }
  }

  function renderPendingDrawSegments() {
    state.pendingDrawSegments.forEach((segment) => {
      if (segment.sheetRef !== state.activeSheetRef) return;
      const group = svgEl("g", {"data-pending-command": segment.id});
      if (segment.tool === "wall") appendWallPreview(group, segment.start, segment.end, segment.thicknessMm, true);
      else group.append(svgEl("line", {
        x1: segment.start[0], y1: segment.start[1], x2: segment.end[0], y2: segment.end[1],
        class: "draft-preview pending-draw-preview",
      }));
      svg.append(group);
    });
  }

  function renderDraft() {
    if (state.activeTool === "opening") {
      const host = state.openingHostPreview;
      const placement = openingPlacement(host);
      if (!host || !placement) return;
      const primitive = {
        primitive_type: "polygon",
        style_ref: quickToolKindForItem(state.selectedLibraryItem) === "window" ? "window" : "door",
        geometry: {points_mm: placement.points},
      };
      const group = svgEl("g", {class: "opening-host-preview", "data-host-wall-ref": host.primitiveRef});
      group.append(primitive.style_ref === "window" ? renderWindowPrimitive(primitive) : renderDoorPrimitive(primitive));
      svg.append(group);
      return;
    }
    if (!state.drawStart || !state.drawCurrent || state.drawStart.sheetRef !== state.activeSheetRef) return;
    const start = state.drawStart.model;
    const end = state.drawCurrent.model;
    const group = svgEl("g");
    if (["room", "roof"].includes(state.activeTool)) {
      const isRoof = state.activeTool === "roof";
      const draftPoints = isRoof ? state.roofDraftPoints : state.roomDraftPoints;
      const points = [...draftPoints, end];
      if (points.length >= 3) {
        group.append(polygonNode(points, isRoof ? "roof-draft-fill" : "room-draft-fill"));
        const calculation = polygonAreaAndCentroid(points);
        group.append(svgEl("text", {
          x: calculation.centroid[0], y: calculation.centroid[1], class: isRoof ? "roof-draft-area" : "room-draft-area",
        }, `${isRoof ? "Dach · " : ""}${(calculation.areaMm2 / 1_000_000).toFixed(2)} m²`));
      }
      if (points.length >= 2) group.append(svgEl("polyline", {
        points: points.map((point) => point.join(",")).join(" "), class: isRoof ? "roof-draft-boundary" : "room-draft-boundary",
      }));
      draftPoints.forEach((point, index) => group.append(svgEl("circle", {
        cx: point[0], cy: point[1], r: state.camera.width / Math.max(svg.clientWidth, 1) * (index === 0 ? 5.2 : 3.2),
        class: `draft-preview-point${index === 0 ? ` ${isRoof ? "roof-start-point" : "room-start-point"}` : ""}${index === 0 && state.snapTarget?.kind === "area-close" ? " is-close-target" : ""}`,
      })));
    } else if (state.activeTool === "selection") {
      const x = Math.min(start[0], end[0]);
      const y = Math.min(start[1], end[1]);
      group.append(svgEl("rect", {
        x, y,
        width: Math.abs(end[0] - start[0]),
        height: Math.abs(end[1] - start[1]),
        class: "selection-preview",
      }));
    } else if (state.activeTool === "wall") {
      appendWallPreview(group, start, end, activeWallThicknessMm());
    } else {
      group.append(svgEl("line", {x1: start[0], y1: start[1], x2: end[0], y2: end[1], class: "draft-preview"}));
    }
    const draftPointRadius = state.camera.width / Math.max(svg.clientWidth, 1) * 3.2;
    if (!["room", "roof"].includes(state.activeTool)) group.append(svgEl("circle", {cx: start[0], cy: start[1], r: draftPointRadius, class: "draft-preview-point"}));
    group.append(svgEl("circle", {cx: end[0], cy: end[1], r: draftPointRadius, class: "draft-preview-point"}));
    svg.append(group);
  }

  function renderCrosshair() {
    if (!state.cursorPoint || !state.camera || state.pan || state.pinch) return;
    const {x, y} = state.cursorPoint;
    const camera = state.camera;
    const pixel = camera.width / Math.max(svg.clientWidth, 1);
    const group = svgEl("g", {class: "cad-crosshair"});
    group.append(
      svgEl("line", {x1: camera.x, y1: y, x2: camera.x + camera.width, y2: y, class: "cad-crosshair-horizontal"}),
      svgEl("line", {x1: x, y1: camera.y, x2: x, y2: camera.y + camera.height, class: "cad-crosshair-vertical"}),
      svgEl("circle", {cx: x, cy: y, r: Math.max(2, pixel * (state.snapTarget ? 3.2 : 4.2)), class: `cad-crosshair-center${state.snapTarget ? " is-snapped" : ""}`}),
    );
    svg.append(group);
  }

  function editablePointDescriptors(primitive) {
    const geometry = primitive?.geometry || {};
    const descriptor = (kind, sourcePoint, detail = {}) => ({
      kind,
      sourcePoint: [Number(sourcePoint?.[0]) || 0, Number(sourcePoint?.[1]) || 0],
      ...detail,
    });
    if (primitive?.primitive_type === "polygon"
      || (primitive?.primitive_type === "room" && normalizedPolygonPoints(geometry.points_mm).length >= 3)) {
      return (geometry.points_mm || []).map((point, index) => descriptor("points", point, {index}));
    }
    if (primitive?.primitive_type === "thick_path") {
      return (geometry.path_mm || []).map((point, index) => descriptor("path", point, {index}));
    }
    if (primitive?.primitive_type === "thick_segments") {
      return (geometry.segments_mm || []).flatMap((segment, segmentIndex) => (segment || []).map((point, pointIndex) => (
        descriptor("segment", point, {segmentIndex, pointIndex})
      )));
    }
    if (["line", "dimension"].includes(primitive?.primitive_type)) {
      return [
        descriptor("endpoint", geometry.start_mm, {field: "start_mm"}),
        descriptor("endpoint", geometry.end_mm, {field: "end_mm"}),
      ];
    }
    if (["rect", "room"].includes(primitive?.primitive_type)) {
      const x = Number(geometry.x_mm) || 0;
      const y = Number(geometry.y_mm) || 0;
      const width = Number(geometry.width_mm) || 0;
      const height = Number(primitive.primitive_type === "room" ? geometry.depth_mm : geometry.height_mm) || 0;
      return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
        .map((point, index) => descriptor("rectangle", point, {index}));
    }
    if (primitive?.primitive_type === "thick_arc") {
      return [descriptor("endpoint", geometry.center_mm, {field: "center_mm"})];
    }
    if (Number.isFinite(Number(geometry.x_mm)) && Number.isFinite(Number(geometry.y_mm))) {
      return [descriptor("xy", [geometry.x_mm, geometry.y_mm])];
    }
    return [];
  }

  function applyPointDescriptor(geometry, primitiveType, descriptor, sourcePoint) {
    const next = cloneValue(geometry || {});
    if (descriptor.kind === "points") next.points_mm[descriptor.index] = sourcePoint;
    else if (descriptor.kind === "path") next.path_mm[descriptor.index] = sourcePoint;
    else if (descriptor.kind === "segment") next.segments_mm[descriptor.segmentIndex][descriptor.pointIndex] = sourcePoint;
    else if (descriptor.kind === "endpoint") next[descriptor.field] = sourcePoint;
    else if (descriptor.kind === "xy") [next.x_mm, next.y_mm] = sourcePoint;
    else if (descriptor.kind === "rectangle") {
      const x = Number(next.x_mm) || 0;
      const y = Number(next.y_mm) || 0;
      const width = Number(next.width_mm) || 0;
      const heightField = primitiveType === "room" ? "depth_mm" : "height_mm";
      const height = Number(next[heightField]) || 0;
      const corners = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
      const opposite = corners[(descriptor.index + 2) % 4];
      next.x_mm = Math.min(sourcePoint[0], opposite[0]);
      next.y_mm = Math.min(sourcePoint[1], opposite[1]);
      next.width_mm = Math.max(1, Math.abs(sourcePoint[0] - opposite[0]));
      next[heightField] = Math.max(1, Math.abs(sourcePoint[1] - opposite[1]));
    }
    return next;
  }

  function unapplyPrimitiveEditPoint(point, primitive) {
    const edit = state.elementEdits.get(primitive?.primitive_ref) || {};
    const bounds = primitiveModelBounds(northUpPrimitive(primitive));
    if (!bounds) return [point.x, point.y];
    const centreX = bounds.x + bounds.width / 2;
    const centreY = bounds.y + bounds.height / 2;
    const translateX = Number(edit.translateX) || 0;
    const translateY = Number(edit.translateY) || 0;
    const rotation = -(Number(edit.rotation) || 0) * Math.PI / 180;
    const skew = Math.tan((Number(edit.skewX) || 0) * Math.PI / 180);
    const scaleX = Number.isFinite(Number(edit.scaleX)) && Math.abs(Number(edit.scaleX)) > 1e-8 ? Number(edit.scaleX) : 1;
    const scaleY = Number.isFinite(Number(edit.scaleY)) && Math.abs(Number(edit.scaleY)) > 1e-8 ? Number(edit.scaleY) : 1;
    let x = point.x - translateX - centreX;
    let y = point.y - translateY - centreY;
    const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
    const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
    x = rotatedX - skew * rotatedY;
    y = rotatedY;
    return [x / scaleX + centreX, y / scaleY + centreY];
  }

  function beginPointModification(event, descriptor) {
    const primitive = selectedSourcePrimitive();
    if (!primitive || projectContext.readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    state.pointDrag = {
      pointerId: event.pointerId,
      primitiveRef: primitive.primitive_ref,
      primitiveType: primitive.primitive_type,
      descriptor: cloneValue(descriptor),
      before: editSnapshot(),
    };
    svg.setPointerCapture?.(event.pointerId);
    renderPlan();
  }

  function updatePointModification(event) {
    const drag = state.pointDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    const rawPoint = pointFromEvent(event);
    const primitive = sourcePrimitiveForRef(drag.primitiveRef);
    if (!rawPoint || !primitive) return true;
    const untransformed = unapplyPrimitiveEditPoint(rawPoint, primitiveWithPointGeometry(primitive));
    const snapped = snappedModelPoint({x: untransformed[0], y: untransformed[1]});
    const sourcePoint = northUpPointToModel(snapped);
    const currentGeometry = state.pointGeometryOverrides.get(drag.primitiveRef) || primitive.geometry;
    const nextGeometry = applyPointDescriptor(currentGeometry, drag.primitiveType, drag.descriptor, sourcePoint);
    state.pointGeometryOverrides.set(drag.primitiveRef, nextGeometry);
    state.selectedPrimitive = northUpPrimitive({...primitive, geometry: nextGeometry});
    state.cursorPoint = {x: snapped[0], y: snapped[1]};
    state.lastPointerModel = state.cursorPoint;
    renderPlan();
    return true;
  }

  function finishPointModification(event) {
    const drag = state.pointDrag;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    const after = editSnapshot();
    state.pointDrag = null;
    if (JSON.stringify(drag.before.pointGeometryOverrides) !== JSON.stringify(after.pointGeometryOverrides)) {
      const primitive = sourcePrimitiveForRef(drag.primitiveRef);
      const isRoof = primitive?.source_kind === "roof" || primitive?.style_ref === "roof";
      const persistentRoof = isRoof
        ? persistentRoofTarget(roofElementForRef(drag.primitiveRef)?.element)
        : null;
      const historyEntry = persistentRoof ? null : {
        kind: "local-edit",
        receipt: {command: {command: "modify_point"}},
        before: drag.before,
        after,
      };
      if (historyEntry) {
        state.commands.push(historyEntry);
        state.redoCommands = [];
      }
      if (isRoof) {
        showMessage("Dachkontur geändert · Dachhaut und Tragwerk werden neu berechnet …");
        recalculateRoofPrimitive(drag.primitiveRef).then((calculation) => {
          if (historyEntry) historyEntry.after = editSnapshot();
          showMessage(`Dach neu berechnet: ${calculation.summary?.face_count || 0} Flächen, ${calculation.summary?.rafter_count || 0} Sparren und ${calculation.summary?.purlin_count || 0} Pfetten.`);
        }).catch(handleError);
      } else {
        showMessage("Geometriepunkt modifiziert · die Änderung kann rückgängig gemacht werden.");
      }
    }
    renderAll();
    return true;
  }

  function renderPointModifyHandles() {
    if (!state.pointEditMode || state.planOverview || !state.selectedPrimitive || !state.camera) return;
    const primitive = selectedSourcePrimitive();
    if (!primitive) return;
    const descriptors = editablePointDescriptors(primitive);
    if (!descriptors.length) return;
    const pixel = state.camera.width / Math.max(svg.clientWidth, 1);
    const group = svgEl("g", {class: "point-modify-handles"});
    const displayPrimitive = northUpPrimitive(primitive);
    const transform = primitiveEditTransform(displayPrimitive);
    if (transform) group.setAttribute("transform", transform);
    descriptors.forEach((entry, index) => {
      const point = modelPointToNorthUp(entry.sourcePoint);
      const handle = svgEl("circle", {
        cx: point[0], cy: point[1], r: Math.max(40, pixel * 6),
        class: `point-modify-handle${state.pointDrag?.descriptor?.kind === entry.kind && state.pointDrag?.descriptor?.index === entry.index ? " is-dragging" : ""}`,
        "data-point-index": index,
      });
      handle.addEventListener("pointerdown", (event) => beginPointModification(event, entry));
      group.append(handle);
    });
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
    syncRoofOptionsPanel();
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
      create_roof: "Dach erstellen",
      update_roof: "Dach ändern",
      create_line: "Linie erstellen",
      create_dimension: "Bemaßung erstellen",
      create_section_marker: "Schnittmarke erstellen",
      cut_selection: "Auswahl ausschneiden",
      paste_selection: "Auswahl einfügen",
      rotate_selection: "Auswahl drehen",
      mirror_selection: "Auswahl spiegeln",
      distort_selection: "Auswahl verzerren",
      modify_point: "Punkt modifizieren",
    }[command] || command;
  }

  function sourcePrimitiveForRef(primitiveRef) {
    const viewport = currentViewport();
    return viewport?.primitives?.find((primitive) => primitive.primitive_ref === primitiveRef)
      || state.localCopies.find((entry) => entry.primitive.primitive_ref === primitiveRef)?.primitive
      || null;
  }

  function selectedSourcePrimitive() {
    const primitive = sourcePrimitiveForRef(state.selectedPrimitive?.primitive_ref);
    return primitive ? primitiveWithPointGeometry(primitive) : null;
  }

  function setRoofInputValue(id, value) {
    const input = document.getElementById(id);
    if (!input || value === undefined || value === null) return;
    input.value = String(value);
  }

  function populateRoofInputs(primitive) {
    const calculation = primitive?.metadata?.roof_calculation || {};
    const request = primitive?.metadata?.roof_request || calculation.normalized_request || {};
    const parameters = request.parameters || {};
    const overhang = parameters.overhang_mm || {};
    const structure = parameters.structure || {};
    setRoofInputValue("roof-tool-type", request.roof_type || calculation.roof_type);
    setRoofInputValue("roof-pitch", parameters.pitch_deg);
    setRoofInputValue("roof-eaves-height", parameters.eaves_height_mm);
    if (Number.isFinite(Number(parameters.ridge_direction))) {
      setRoofInputValue("roof-ridge-direction", "degrees");
      setRoofInputValue("roof-ridge-degrees", parameters.ridge_direction);
    } else {
      setRoofInputValue("roof-ridge-direction", parameters.ridge_direction || "auto");
    }
    setRoofInputValue("roof-skin-thickness", parameters.roof_skin_thickness_mm);
    setRoofInputValue("roof-skin-material", parameters.roof_skin_material);
    if (typeof overhang === "number") {
      ["roof-overhang", "roof-overhang-north", "roof-overhang-east", "roof-overhang-south", "roof-overhang-west"]
        .forEach((id) => setRoofInputValue(id, overhang));
    } else {
      setRoofInputValue("roof-overhang", overhang.default_mm);
      setRoofInputValue("roof-overhang-north", overhang.north_mm);
      setRoofInputValue("roof-overhang-east", overhang.east_mm);
      setRoofInputValue("roof-overhang-south", overhang.south_mm);
      setRoofInputValue("roof-overhang-west", overhang.west_mm);
      setRoofInputValue("roof-edge-overhangs", Array.isArray(overhang.edges_mm) ? overhang.edges_mm.join(" ") : "");
    }
    setRoofInputValue("roof-rafter-width", structure.rafter?.width_mm);
    setRoofInputValue("roof-rafter-height", structure.rafter?.height_mm);
    setRoofInputValue("roof-rafter-spacing", structure.rafter?.spacing_mm);
    setRoofInputValue("roof-purlin-width", structure.purlin?.width_mm);
    setRoofInputValue("roof-purlin-height", structure.purlin?.height_mm);
    setRoofInputValue("roof-purlin-spacing", structure.purlin?.maximum_spacing_mm || structure.purlin?.spacing_mm);
    setRoofInputValue("roof-plateau-ratio", parameters.plateau_width_ratio);
    setRoofInputValue("roof-mansard-break", parameters.mansard_break_ratio);
    setRoofInputValue("roof-mansard-lower-pitch", parameters.mansard_lower_pitch_deg);
    setRoofInputValue("roof-mansard-upper-pitch", parameters.mansard_upper_pitch_deg);
    setRoofInputValue("roof-hip-end-ratio", parameters.hip_end_ratio);
    setRoofInputValue("roof-barrel-rise", parameters.barrel_rise_mm);
    setRoofInputValue("roof-barrel-segments", parameters.barrel_segment_count);
    setRoofInputValue("roof-sawtooth-count", parameters.sawtooth_count);
    setRoofInputValue("roof-sawtooth-pitch", parameters.sawtooth_pitch_deg);
  }

  function syncRoofOptionsPanel() {
    const panel = document.getElementById("roof-options");
    if (!panel) return;
    const selected = selectedSourcePrimitive();
    const selectedRoof = selected && (selected.source_kind === "roof" || selected.style_ref === "roof") ? selected : null;
    panel.hidden = state.activeTool !== "roof" && !selectedRoof;
    const finish = panel.querySelector('[data-action="finish-roof"]');
    if (finish) finish.hidden = Boolean(selectedRoof && state.activeTool !== "roof");
    if (selectedRoof) populateRoofInputs(selectedRoof);
  }

  function editSnapshot() {
    return {
      localCopies: cloneValue(state.localCopies),
      elementEdits: cloneValue([...state.elementEdits.entries()]),
      pointGeometryOverrides: cloneValue([...state.pointGeometryOverrides.entries()]),
      hiddenElementRefs: [...state.hiddenElementRefs],
      selectedRef: state.selectedPrimitive?.primitive_ref || "",
      roofElements: state.input?.sheets?.flatMap((sheet) => (sheet.elements || [])
        .filter((element) => element.kind === "roof")
        .map((element) => ({sheetRef: sheet.sheet_ref, element: cloneValue(element)}))) || [],
    };
  }

  function restoreEditSnapshot(snapshot) {
    state.localCopies = cloneValue(snapshot.localCopies || []);
    state.elementEdits = new Map(cloneValue(snapshot.elementEdits || []));
    state.pointGeometryOverrides = new Map(cloneValue(snapshot.pointGeometryOverrides || []));
    state.hiddenElementRefs = new Set(snapshot.hiddenElementRefs || []);
    if (Array.isArray(snapshot.roofElements)) {
      const byRef = new Map(snapshot.roofElements.map((entry) => [entry.element?.element_ref, entry]));
      state.input?.sheets?.forEach((sheet) => {
        sheet.elements = (sheet.elements || []).map((element) => {
          const saved = byRef.get(element.element_ref);
          return saved?.sheetRef === sheet.sheet_ref ? cloneValue(saved.element) : element;
        });
      });
    }
    const source = sourcePrimitiveForRef(snapshot.selectedRef);
    state.selectedPrimitive = source ? northUpPrimitive(primitiveWithPointGeometry(source)) : null;
    renderAll();
    syncEditToolButtons();
    if (Array.isArray(snapshot.roofElements) && snapshot.roofElements.length) {
      refreshProjection().then(() => {
        const restored = sourcePrimitiveForRef(snapshot.selectedRef);
        state.selectedPrimitive = restored ? northUpPrimitive(primitiveWithPointGeometry(restored)) : null;
        renderAll();
      }).catch(handleError);
    }
  }

  function commitLocalEdit(commandName, mutate) {
    const before = editSnapshot();
    mutate();
    const after = editSnapshot();
    state.commands.push({
      kind: "local-edit",
      receipt: {command: {command: commandName}},
      before,
      after,
    });
    state.redoCommands = [];
    renderAll();
    syncEditToolButtons();
  }

  function copySelectedPrimitive({cut = false} = {}) {
    const primitive = selectedSourcePrimitive();
    if (!primitive) {
      showMessage("Bitte zuerst ein Bauwerksobjekt auswählen.");
      return;
    }
    state.clipboard = {
      contractVersion: "cad-clipboard/0.1",
      primitive: cloneValue(primitive),
      edit: cloneValue(state.elementEdits.get(primitive.primitive_ref) || {}),
      sourceStoreyId: state.building?.activeStoreyId || state.loadedProjectionStoreyId,
    };
    if (cut) {
      commitLocalEdit("cut_selection", () => {
        state.hiddenElementRefs.add(primitive.primitive_ref);
        state.selectedPrimitive = null;
      });
      showMessage("Auswahl ausgeschnitten · Einfügen platziert sie am Fadenkreuz.");
    } else {
      syncEditToolButtons();
      showMessage("Auswahl kopiert · Einfügen platziert eine 2D-Kopie am Fadenkreuz.");
    }
  }

  function pasteClipboard() {
    if (!state.clipboard) {
      showMessage("Die CAD-Zwischenablage ist leer.");
      return;
    }
    const primitive = cloneValue(state.clipboard.primitive);
    state.editSequence += 1;
    const originalRef = primitive.primitive_ref;
    primitive.primitive_ref = `cad_copy_${Date.now().toString(36)}_${state.editSequence}`;
    primitive.metadata = {
      ...(primitive.metadata || {}),
      element_ref: primitive.primitive_ref,
      copied_from: originalRef,
      local_draft: true,
      storey_id: state.building?.activeStoreyId || state.loadedProjectionStoreyId,
    };
    const displayPrimitive = northUpPrimitive(primitive);
    const bounds = primitiveModelBounds(displayPrimitive);
    const target = state.lastPointerModel || state.cursorPoint || {
      x: state.camera.x + state.camera.width / 2,
      y: state.camera.y + state.camera.height / 2,
    };
    const clipboardEdit = cloneValue(state.clipboard.edit || {});
    const translateX = Number(clipboardEdit.translateX) || 0;
    const translateY = Number(clipboardEdit.translateY) || 0;
    const centreX = bounds ? bounds.x + bounds.width / 2 + translateX : target.x;
    const centreY = bounds ? bounds.y + bounds.height / 2 + translateY : target.y;
    const nextEdit = {
      ...clipboardEdit,
      translateX: translateX + target.x - centreX,
      translateY: translateY + target.y - centreY,
    };
    commitLocalEdit("paste_selection", () => {
      state.localCopies.push({primitive, viewportRef: state.activeViewportRef});
      state.elementEdits.set(primitive.primitive_ref, nextEdit);
      state.selectedPrimitive = displayPrimitive;
    });
    showMessage("Kopie am Fadenkreuz eingefügt · als 2D-CAD-Entwurf markiert.");
  }

  function transformSelected(commandName, transform) {
    const primitive = selectedSourcePrimitive();
    if (!primitive) {
      showMessage("Bitte zuerst ein Bauwerksobjekt auswählen.");
      return;
    }
    commitLocalEdit(commandName, () => {
      const current = {
        translateX: 0,
        translateY: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        ...(state.elementEdits.get(primitive.primitive_ref) || {}),
      };
      state.elementEdits.set(primitive.primitive_ref, transform(current));
    });
  }

  function openDistortPanel() {
    const primitive = selectedSourcePrimitive();
    if (!primitive) {
      showMessage("Bitte zuerst ein Bauwerksobjekt auswählen.");
      return;
    }
    const edit = state.elementEdits.get(primitive.primitive_ref) || {};
    document.getElementById("distort-scale-x").value = String(Number(edit.scaleX) || 1);
    document.getElementById("distort-scale-y").value = String(Number(edit.scaleY) || 1);
    document.getElementById("distort-skew-x").value = String(Number(edit.skewX) || 0);
    document.getElementById("distort-panel").hidden = false;
  }

  function applyDistort() {
    const scaleX = Math.max(0.1, Math.min(10, Number(document.getElementById("distort-scale-x")?.value) || 1));
    const scaleY = Math.max(0.1, Math.min(10, Number(document.getElementById("distort-scale-y")?.value) || 1));
    const skewX = Math.max(-75, Math.min(75, Number(document.getElementById("distort-skew-x")?.value) || 0));
    transformSelected("distort_selection", (edit) => ({...edit, scaleX, scaleY, skewX}));
    document.getElementById("distort-panel").hidden = true;
    showMessage("Auswahl verzerrt.");
  }

  function handleEditAction(action, event = null) {
    if (projectContext.readOnly) {
      showMessage("Dieses Projekt wurde schreibgeschützt geöffnet.");
      return;
    }
    if (action === "modify-point") {
      const primitive = selectedSourcePrimitive();
      if (!primitive || !editablePointDescriptors(primitive).length) {
        showMessage("Bitte zuerst ein Objekt mit bearbeitbaren Geometriepunkten auswählen.");
        return;
      }
      state.pointEditMode = !state.pointEditMode;
      state.pointDrag = null;
      selectTool("select");
      renderPlan();
      syncEditToolButtons();
      showMessage(state.pointEditMode
        ? "Punktmodifikation aktiv · einen blauen Griff ziehen. ESC beendet."
        : "Punktmodifikation beendet.");
    } else if (action === "copy") copySelectedPrimitive();
    else if (action === "cut") copySelectedPrimitive({cut: true});
    else if (action === "paste") pasteClipboard();
    else if (action === "rotate") {
      transformSelected("rotate_selection", (edit) => ({...edit, rotation: (Number(edit.rotation) || 0) + 90}));
      showMessage("Auswahl um 90° gedreht.");
    } else if (action === "mirror") {
      const vertical = Boolean(event?.shiftKey);
      transformSelected("mirror_selection", (edit) => vertical
        ? {...edit, scaleY: -(Number(edit.scaleY) || 1)}
        : {...edit, scaleX: -(Number(edit.scaleX) || 1)});
      showMessage(vertical ? "Auswahl vertikal gespiegelt." : "Auswahl horizontal gespiegelt.");
    } else if (action === "distort") openDistortPanel();
  }

  function syncEditToolButtons() {
    const hasSelection = Boolean(selectedSourcePrimitive()) && !projectContext.readOnly;
    document.querySelectorAll("[data-edit-action]").forEach((button) => {
      const action = button.dataset.editAction;
      const pointSupported = action !== "modify-point" || editablePointDescriptors(selectedSourcePrimitive()).length > 0;
      button.disabled = action === "paste" ? !state.clipboard || projectContext.readOnly : !hasSelection || !pointSupported;
      if (action === "modify-point") {
        button.classList.toggle("is-active", state.pointEditMode && !button.disabled);
        button.setAttribute("aria-pressed", String(state.pointEditMode && !button.disabled));
      }
    });
    syncPlanOverviewButton();
  }

  function selectTool(tool) {
    if (!toolConfig[tool]) return;
    if (projectContext.readOnly && ["selection", "wall", "opening", "library", "room", "roof"].includes(tool)) {
      showMessage("Dieses Projekt wurde schreibgeschützt geöffnet.");
      return;
    }
    if (["wall", "opening", "library", "room"].includes(tool) && !state.selectedLibraryItem) {
      toggleLibrary();
      showMessage("Bitte zuerst ein freigegebenes Element aus der Creative Library auswählen.");
      return;
    }
    state.activeTool = tool;
    if (tool !== "select") {
      state.pointEditMode = false;
      state.pointDrag = null;
    }
    cancelDrawing(false, true);
    document.querySelectorAll("[data-tool]").forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    svg.classList.toggle("is-drawing", ["selection", "wall", "opening", "library", "room", "roof"].includes(tool));
    svg.classList.toggle("is-parcel-grid-editing", tool === "parcel-grid");
    const activeLabel = document.getElementById("active-tool-label");
    const toolHint = document.getElementById("tool-hint");
    if (activeLabel) activeLabel.textContent = toolConfig[tool].label;
    if (toolHint) toolHint.textContent = toolConfig[tool].hint;
    const isLibraryPlacement = ["wall", "opening", "library"].includes(tool);
    const thicknessField = document.getElementById("wall-thickness-field");
    const variantField = document.getElementById("library-variant-field");
    const roomOptions = document.getElementById("room-options");
    const roofOptions = document.getElementById("roof-options");
    if (thicknessField) thicknessField.hidden = !isLibraryPlacement;
    if (variantField) variantField.hidden = !state.selectedLibraryItem || tool === "room";
    if (roomOptions) roomOptions.hidden = tool !== "room";
    if (roofOptions) syncRoofOptionsPanel();
    const createRoom = document.querySelector('[data-action="create-room"]');
    if (createRoom) createRoom.disabled = tool !== "room" || !state.worldSelection || projectContext.readOnly;
    syncQuickToolButtons();
  }

  function cancelDrawing(render = true, invalidateSession = false) {
    const hadDraft = Boolean(state.drawStart || state.roomDraftPoints.length || state.roofDraftPoints.length || state.openingHostPreview);
    state.drawStart = null;
    state.drawCurrent = null;
    state.drawPointerRaw = null;
    state.roomDraftPoints = [];
    state.roofDraftPoints = [];
    state.openingHostPreview = null;
    if (invalidateSession) state.drawSessionId += 1;
    if (render && hadDraft) renderPlan();
  }

  function completeRoomDrawing() {
    if (state.roomSubmissionPending) return false;
    if (state.roomDraftPoints.length < 3) {
      showMessage(state.roomDraftPoints.length
        ? "Der Raum benötigt mindestens drei Punkte. Die Kontur bleibt erhalten."
        : "Raumwerkzeug aktiv · mindestens drei Punkte setzen, danach den ersten Punkt anklicken oder ESC drücken.");
      return false;
    }
    const viewportRef = state.drawStart?.viewportRef || state.activeViewportRef;
    const points = state.roomDraftPoints.map((point) => [...point]);
    state.roomSubmissionPending = true;
    showMessage("Raum wird übernommen …");
    submitRoomCommand({
      sheetRef: state.activeSheetRef,
      viewportRef,
      points,
    }).catch(handleError).finally(() => {
      state.roomSubmissionPending = false;
      renderPlan();
    });
    return true;
  }

  function completeRoofDrawing() {
    if (state.roofSubmissionPending) return false;
    if (state.roofDraftPoints.length < 3) {
      showMessage(state.roofDraftPoints.length
        ? "Die Dachfläche benötigt mindestens drei Punkte. Die Kontur bleibt erhalten."
        : "Dachwerkzeug aktiv · mindestens drei Punkte setzen, danach den ersten Punkt anklicken oder ESC drücken.");
      return false;
    }
    const viewportRef = state.drawStart?.viewportRef || state.activeViewportRef;
    const points = state.roofDraftPoints.map((point) => [...point]);
    state.roofSubmissionPending = true;
    showMessage("Dachhaut, Sparren und Pfetten werden berechnet …");
    submitRoofCommand({
      sheetRef: state.activeSheetRef,
      viewportRef,
      points,
    }).catch(handleError).finally(() => {
      state.roofSubmissionPending = false;
      renderPlan();
    });
    return true;
  }

  function handleAreaEscape(event) {
    if (event.key !== "Escape" || !["room", "roof"].includes(state.activeTool)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.repeat || state.roomSubmissionPending || state.roofSubmissionPending) return true;
    if (state.activeTool === "roof") completeRoofDrawing();
    else completeRoomDrawing();
    return true;
  }

  function suppressAreaEscapeKeyup(event) {
    if (event.key !== "Escape" || !["room", "roof"].includes(state.activeTool)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
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
          coveragePolicy: "cell-center",
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

  function applyPrimitiveEditPoint(point, primitive) {
    const edit = state.elementEdits.get(primitive?.primitive_ref) || {};
    const bounds = primitiveModelBounds(primitive);
    if (!bounds) return [Number(point[0]) || 0, Number(point[1]) || 0];
    const centreX = bounds.x + bounds.width / 2;
    const centreY = bounds.y + bounds.height / 2;
    const scaleX = Number.isFinite(Number(edit.scaleX)) ? Number(edit.scaleX) : 1;
    const scaleY = Number.isFinite(Number(edit.scaleY)) ? Number(edit.scaleY) : 1;
    const skew = Math.tan((Number(edit.skewX) || 0) * Math.PI / 180);
    const rotation = (Number(edit.rotation) || 0) * Math.PI / 180;
    let x = (Number(point[0]) - centreX) * scaleX;
    let y = (Number(point[1]) - centreY) * scaleY;
    x += skew * y;
    const rotatedX = x * Math.cos(rotation) - y * Math.sin(rotation);
    const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
    return [
      rotatedX + centreX + (Number(edit.translateX) || 0),
      rotatedY + centreY + (Number(edit.translateY) || 0),
    ];
  }

  function wallPathBoundaryCorners(path, thicknessMm) {
    const sourcePoints = (Array.isArray(path) ? path : [])
      .filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map((point) => [Number(point[0]), Number(point[1])]);
    const points = sourcePoints.filter((point, index) => {
      if (index === 0 || index === sourcePoints.length - 1) return true;
      const previous = sourcePoints[index - 1];
      const next = sourcePoints[index + 1];
      const incoming = [point[0] - previous[0], point[1] - previous[1]];
      const outgoing = [next[0] - point[0], next[1] - point[1]];
      const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
      const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
      const scale = Math.max(1, Math.hypot(...incoming) * Math.hypot(...outgoing));
      return Math.abs(cross) / scale > 1e-6 || dot <= 0;
    });
    if (points.length < 2) return [];
    const half = Math.max(0.5, Number(thicknessMm) / 2 || 0.5);
    const direction = (start, end) => {
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const length = Math.hypot(dx, dy);
      return length > 1e-8 ? [dx / length, dy / length] : null;
    };
    const normal = (vector) => [-vector[1], vector[0]];
    const corners = [];
    points.forEach((point, index) => {
      const incoming = index > 0 ? direction(points[index - 1], point) : null;
      const outgoing = index < points.length - 1 ? direction(point, points[index + 1]) : null;
      const first = incoming || outgoing;
      const second = outgoing || incoming;
      if (!first || !second) return;
      const firstNormal = normal(first);
      const secondNormal = normal(second);
      let miter = [firstNormal[0] + secondNormal[0], firstNormal[1] + secondNormal[1]];
      const miterLength = Math.hypot(miter[0], miter[1]);
      if (miterLength < 1e-8) miter = secondNormal;
      else miter = [miter[0] / miterLength, miter[1] / miterLength];
      const denominator = Math.abs(miter[0] * secondNormal[0] + miter[1] * secondNormal[1]);
      const offset = Math.min(half * 6, half / Math.max(denominator, 0.18));
      let capExtension = [0, 0];
      if (index === 0 && outgoing) capExtension = [-outgoing[0] * half, -outgoing[1] * half];
      else if (index === points.length - 1 && incoming) capExtension = [incoming[0] * half, incoming[1] * half];
      const boundaryPoint = [point[0] + capExtension[0], point[1] + capExtension[1]];
      corners.push(
        [boundaryPoint[0] + miter[0] * offset, boundaryPoint[1] + miter[1] * offset],
        [boundaryPoint[0] - miter[0] * offset, boundaryPoint[1] - miter[1] * offset],
      );
    });
    const unique = [];
    corners.forEach((corner) => {
      if (!unique.some((entry) => Math.hypot(entry[0] - corner[0], entry[1] - corner[1]) < 0.5)) unique.push(corner);
    });
    return unique;
  }

  function isWallSnapPrimitive(primitive) {
    return primitive?.style_ref === "wall-cut"
      || ["thick_path", "thick_segments"].includes(primitive?.primitive_type);
  }

  function wallPathBoundaryPolygon(path, thicknessMm) {
    const corners = wallPathBoundaryCorners(path, thicknessMm);
    if (corners.length < 4 || corners.length % 2 !== 0) return [];
    const firstSide = [];
    const secondSide = [];
    for (let index = 0; index < corners.length; index += 2) {
      firstSide.push(corners[index]);
      secondSide.push(corners[index + 1]);
    }
    return [...firstSide, ...secondSide.reverse()];
  }

  function wallPrimitiveBoundaryPolygons(primitive) {
    if (!isWallSnapPrimitive(primitive)) return [];
    const geometry = primitive?.geometry || {};
    let polygons = [];
    if (primitive.primitive_type === "polygon") {
      polygons = [geometry.points_mm || []];
    } else if (primitive.primitive_type === "thick_path") {
      polygons = [wallPathBoundaryPolygon(geometry.path_mm, geometry.thickness_mm)];
    } else if (primitive.primitive_type === "thick_segments") {
      const paths = geometry.paths_mm?.length ? geometry.paths_mm : deriveNetworkPaths(geometry.segments_mm || []);
      polygons = paths.map((path) => wallPathBoundaryPolygon(path, geometry.thickness_mm));
    }
    return polygons
      .map((ring) => (ring || []).map((point) => applyPrimitiveEditPoint(point, primitive)))
      .map((ring) => {
        if (ring.length > 2 && Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 0.5) {
          return ring.slice(0, -1);
        }
        return ring;
      })
      .filter((ring) => ring.length >= 3);
  }

  function wallHostSegments(viewport = currentViewport()) {
    if (!viewport) return [];
    const result = [];
    const addPath = (primitive, path, thicknessMm) => {
      const points = normalizedPolygonPoints(path).map((point) => applyPrimitiveEditPoint(point, primitive));
      points.slice(1).forEach((end, index) => {
        const start = points[index];
        const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
        if (length > 1) result.push({
          primitiveRef: primitive.primitive_ref,
          sourcePrimitive: primitive,
          start,
          end,
          length,
          thicknessMm: Math.max(20, Number(thicknessMm) || 120),
        });
      });
    };
    visibleViewportPrimitives(viewport).forEach((sourcePrimitive) => {
      if (!state.visibleLayers.has(sourcePrimitive.layer_ref)) return;
      const primitive = northUpPrimitive(primitiveWithPointGeometry(sourcePrimitive));
      if (!isWallSnapPrimitive(primitive)) return;
      const geometry = primitive.geometry || {};
      if (primitive.primitive_type === "polygon") {
        const frame = polygonFrame(primitive);
        if (!frame) return;
        const start = interpolatePoint(frame.a, frame.d, 0.5);
        const end = interpolatePoint(frame.b, frame.c, 0.5);
        const thickness = Math.hypot(frame.d[0] - frame.a[0], frame.d[1] - frame.a[1]);
        addPath(primitive, [start, end], thickness);
      } else if (primitive.primitive_type === "thick_path") {
        addPath(primitive, geometry.path_mm || [], geometry.thickness_mm);
      } else if (primitive.primitive_type === "thick_segments") {
        (geometry.segments_mm || []).forEach((segment) => addPath(primitive, segment, geometry.thickness_mm));
      }
    });
    return result;
  }

  function segmentProjection(point, segment) {
    const deltaX = segment.end[0] - segment.start[0];
    const deltaY = segment.end[1] - segment.start[1];
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const ratio = lengthSquared <= 1e-9 ? 0 : Math.max(0, Math.min(1,
      ((point.x - segment.start[0]) * deltaX + (point.y - segment.start[1]) * deltaY) / lengthSquared,
    ));
    const centre = [segment.start[0] + deltaX * ratio, segment.start[1] + deltaY * ratio];
    return {
      ...segment,
      ratio,
      centre,
      distance: Math.hypot(point.x - centre[0], point.y - centre[1]),
      unit: segment.length > 1e-9 ? [deltaX / segment.length, deltaY / segment.length] : [1, 0],
    };
  }

  function wallHostCandidate(point) {
    if (!point || !state.camera) return null;
    const pixelTolerance = state.camera.width / Math.max(svg.clientWidth, 1) * 10;
    return wallHostSegments()
      .map((segment) => segmentProjection(point, segment))
      .filter((candidate) => candidate.distance <= candidate.thicknessMm / 2 + pixelTolerance)
      .sort((left, right) => left.distance - right.distance)[0] || null;
  }

  function openingPlacement(host) {
    if (!host) return null;
    const dimensions = state.selectedLibraryVariant?.dimensions || state.selectedLibraryItem?.dimensions || {};
    const widthMm = Math.max(100, Number(dimensions.width_mm) || 1000);
    const halfWidth = widthMm / 2;
    const halfDepth = host.thicknessMm / 2;
    const normal = [-host.unit[1], host.unit[0]];
    const start = [host.centre[0] - host.unit[0] * halfWidth, host.centre[1] - host.unit[1] * halfWidth];
    const end = [host.centre[0] + host.unit[0] * halfWidth, host.centre[1] + host.unit[1] * halfWidth];
    return {
      start,
      end,
      points: [
        [start[0] + normal[0] * halfDepth, start[1] + normal[1] * halfDepth],
        [end[0] + normal[0] * halfDepth, end[1] + normal[1] * halfDepth],
        [end[0] - normal[0] * halfDepth, end[1] - normal[1] * halfDepth],
        [start[0] - normal[0] * halfDepth, start[1] - normal[1] * halfDepth],
      ],
      widthMm,
    };
  }

  function pointToSegmentDistance(point, start, end) {
    const deltaX = end[0] - start[0];
    const deltaY = end[1] - start[1];
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    if (lengthSquared <= 1e-9) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    const projection = Math.max(0, Math.min(1,
      ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / lengthSquared,
    ));
    return Math.hypot(
      point[0] - (start[0] + projection * deltaX),
      point[1] - (start[1] + projection * deltaY),
    );
  }

  function pointStrictlyInsideWallPolygon(point, ring) {
    for (let index = 0; index < ring.length; index += 1) {
      if (pointToSegmentDistance(point, ring[index], ring[(index + 1) % ring.length]) < 0.75) return false;
    }
    return pointInRing(point, ring);
  }

  function finiteSegmentIntersection(first, second) {
    const p = first.start;
    const q = second.start;
    const r = [first.end[0] - p[0], first.end[1] - p[1]];
    const s = [second.end[0] - q[0], second.end[1] - q[1]];
    const cross = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(cross) < 1e-9) return null;
    const qMinusP = [q[0] - p[0], q[1] - p[1]];
    const firstFactor = (qMinusP[0] * s[1] - qMinusP[1] * s[0]) / cross;
    const secondFactor = (qMinusP[0] * r[1] - qMinusP[1] * r[0]) / cross;
    if (firstFactor < -1e-7 || firstFactor > 1 + 1e-7 || secondFactor < -1e-7 || secondFactor > 1 + 1e-7) return null;
    return [p[0] + firstFactor * r[0], p[1] + firstFactor * r[1]];
  }

  function wallObjectSnapAnchors(viewport, pointer, tolerance) {
    const boundaries = [];
    visibleViewportPrimitives(viewport).forEach((sourcePrimitive) => {
      if (!state.visibleLayers.has(sourcePrimitive.layer_ref)) return;
      const primitive = northUpPrimitive(primitiveWithPointGeometry(sourcePrimitive));
      if (!isWallSnapPrimitive(primitive)) return;
      wallPrimitiveBoundaryPolygons(primitive).forEach((points, polygonIndex) => {
        const boundaryRef = `${primitive.primitive_ref}:${polygonIndex}`;
        const segments = points.map((start, index) => ({
          start,
          end: points[(index + 1) % points.length],
          primitiveRef: primitive.primitive_ref,
          boundaryRef,
        }));
        boundaries.push({points, segments, primitiveRef: primitive.primitive_ref});
      });
    });

    const candidates = [];
    const addCandidate = (point, kind, primitiveRefs) => {
      if (Math.hypot(point[0] - pointer.x, point[1] - pointer.y) > tolerance) return;
      const existing = candidates.find((entry) => Math.hypot(entry.point[0] - point[0], entry.point[1] - point[1]) < 0.5);
      const descriptor = {point, kind, primitiveRef: [...new Set(primitiveRefs)].join("+")};
      if (!existing) candidates.push(descriptor);
      else if (kind === "wall-edge-intersection") Object.assign(existing, descriptor);
    };

    boundaries.forEach((boundary) => {
      boundary.points.forEach((point) => addCandidate(point, "wall-edge-corner", [boundary.primitiveRef]));
    });

    const nearbySegments = boundaries.flatMap((boundary) => boundary.segments).filter((segment) => (
      pointer.x >= Math.min(segment.start[0], segment.end[0]) - tolerance
      && pointer.x <= Math.max(segment.start[0], segment.end[0]) + tolerance
      && pointer.y >= Math.min(segment.start[1], segment.end[1]) - tolerance
      && pointer.y <= Math.max(segment.start[1], segment.end[1]) + tolerance
    ));
    for (let firstIndex = 0; firstIndex < nearbySegments.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nearbySegments.length; secondIndex += 1) {
        const first = nearbySegments[firstIndex];
        const second = nearbySegments[secondIndex];
        if (first.boundaryRef === second.boundaryRef) continue;
        const intersection = finiteSegmentIntersection(first, second);
        if (intersection) addCandidate(intersection, "wall-edge-intersection", [first.primitiveRef, second.primitiveRef]);
      }
    }

    return candidates.filter((candidate) => !boundaries.some((boundary) => (
      pointStrictlyInsideWallPolygon(candidate.point, boundary.points)
    )));
  }

  function primitiveObjectSnapAnchors(primitive) {
    const geometry = primitive?.geometry || {};
    if (["annotation", "room-label"].includes(primitive?.style_ref) || primitive?.primitive_type === "dimension") return [];
    if (primitive?.primitive_type === "thick_path") {
      return wallPathBoundaryCorners(geometry.path_mm, geometry.thickness_mm)
        .map((point) => ({point, kind: "wall-edge-corner"}));
    }
    if (primitive?.primitive_type === "thick_segments") {
      const paths = geometry.paths_mm?.length ? geometry.paths_mm : deriveNetworkPaths(geometry.segments_mm || []);
      const anchors = paths.flatMap((path) => wallPathBoundaryCorners(path, geometry.thickness_mm));
      const unique = [];
      anchors.forEach((point) => {
        if (!unique.some((entry) => Math.hypot(entry.point[0] - point[0], entry.point[1] - point[1]) < 0.5)) {
          unique.push({point, kind: "wall-edge-corner"});
        }
      });
      return unique;
    }
    return editablePointDescriptors(primitive).map((descriptor) => ({point: descriptor.sourcePoint, kind: descriptor.kind}));
  }

  function primitiveSnapPriority(primitive) {
    const primitiveType = String(primitive?.primitive_type || "");
    const styleRef = String(primitive?.style_ref || "");
    if (["thick_path", "thick_segments"].includes(primitiveType) || styleRef === "wall-cut") return 0;
    if (["door", "window", "opening"].includes(styleRef)) return 1;
    if (["beam", "column", "structure", "stair"].includes(styleRef)) return 2;
    if (["room", "slab", "roof", "room-label", "annotation"].includes(styleRef)) return 4;
    return 3;
  }

  function objectSnapCandidate(point) {
    const viewport = currentViewport();
    if (!viewport || !state.camera) return null;
    const areaDrawing = ["room", "roof"].includes(state.activeTool);
    const tolerance = state.camera.width / Math.max(svg.clientWidth, 1) * (areaDrawing ? 18 : 14);
    let closest = null;
    const consider = (descriptor, priority = 0) => {
      const anchor = descriptor.point;
      const distance = Math.hypot(anchor[0] - point.x, anchor[1] - point.y);
      if (distance <= tolerance && (
        !closest
        || priority < closest.priority
        || (priority === closest.priority && distance < closest.distance)
      )) {
        closest = {
          point: anchor,
          distance,
          priority,
          primitiveRef: descriptor.primitiveRef,
          kind: descriptor.kind,
        };
      }
    };
    wallObjectSnapAnchors(viewport, point, tolerance).forEach((descriptor) => consider(descriptor, 0));
    if (areaDrawing) return closest;
    visibleViewportPrimitives(viewport).forEach((sourcePrimitive) => {
      if (!state.visibleLayers.has(sourcePrimitive.layer_ref)) return;
      const primitive = northUpPrimitive(primitiveWithPointGeometry(sourcePrimitive));
      if (isWallSnapPrimitive(primitive)) return;
      const priority = primitiveSnapPriority(primitive);
      primitiveObjectSnapAnchors(primitive).forEach((descriptor) => {
        const anchor = applyPrimitiveEditPoint(descriptor.point, primitive);
        consider({...descriptor, point: anchor, primitiveRef: primitive.primitive_ref}, priority);
      });
    });
    return closest;
  }

  function objectSnapEnabled() {
    const control = document.getElementById("object-snap-enabled");
    return control ? control.checked : true;
  }

  function gridSnapEnabled() {
    const control = document.getElementById("snap-enabled");
    return Boolean(control?.checked);
  }

  function areaCloseSnapPoint(point) {
    if (!["room", "roof"].includes(state.activeTool) || !state.camera) return null;
    const draftPoints = state.activeTool === "roof" ? state.roofDraftPoints : state.roomDraftPoints;
    if (draftPoints.length < 3) return null;
    const firstPoint = draftPoints[0];
    const tolerance = state.camera.width / Math.max(svg.clientWidth, 1) * 16;
    return Math.hypot(point.x - firstPoint[0], point.y - firstPoint[1]) <= tolerance
      ? [...firstPoint]
      : null;
  }

  function snappedModelPoint(point) {
    const areaClosePoint = areaCloseSnapPoint(point);
    if (areaClosePoint) {
      state.snapTarget = {point: areaClosePoint, kind: "area-close"};
      return areaClosePoint;
    }
    const objectSnap = objectSnapEnabled() ? objectSnapCandidate(point) : null;
    if (objectSnap) {
      state.snapTarget = objectSnap;
      return [...objectSnap.point];
    }
    state.snapTarget = null;
    if (!gridSnapEnabled()) return [Math.round(point.x), Math.round(point.y)];
    const step = activeSnapStep();
    return [Math.round(point.x / step) * step, Math.round(point.y / step) * step];
  }

  function activeSnapStep() {
    if (!gridSnapEnabled()) return 1;
    return Math.max(1, Number(document.getElementById("snap-size")?.value) || 100);
  }

  function drawingModelPoint(point, event = null) {
    const model = snappedModelPoint(point);
    if (state.snapTarget?.kind === "area-close") return model;
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
    state.snapTarget = null;
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
    if (finishPointModification(event)) return true;
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
    if (updatePointModification(event)) return;
    if (updateParcelGridDrag(event)) return;
    if (event.pointerType === "touch" && state.touchPoints.has(event.pointerId)) {
      state.touchPoints.set(event.pointerId, {clientX: event.clientX, clientY: event.clientY});
      if (updatePinch()) return;
    }
    if (updatePan(event)) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (state.activeTool === "opening") {
      state.openingHostPreview = wallHostCandidate(point);
      const cursor = state.openingHostPreview?.centre || [point.x, point.y];
      state.snapTarget = state.openingHostPreview
        ? {point: cursor, kind: "wall-host", primitiveRef: state.openingHostPreview.primitiveRef}
        : null;
      state.cursorPoint = {x: cursor[0], y: cursor[1]};
      state.lastPointerModel = state.cursorPoint;
      schedulePlanRender();
      return;
    }
    const snapped = state.activeTool === "room" ? drawingModelPoint(point, event) : snappedModelPoint(point);
    state.cursorPoint = {x: snapped[0], y: snapped[1]};
    state.lastPointerModel = state.cursorPoint;
    if (!state.drawStart) {
      schedulePlanRender();
      return;
    }
    state.drawPointerRaw = point;
    state.drawCurrent = {model: state.activeTool === "room" ? snapped : drawingModelPoint(point, event)};
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
        syncEditToolButtons();
      }
      return;
    }
    event.preventDefault();
    const point = pointFromEvent(event);
    const viewport = currentViewport();
    if (!point || !viewport) return;
    if (state.activeTool === "opening") {
      const host = wallHostCandidate(point);
      const placement = openingPlacement(host);
      if (!host || !placement) {
        showMessage("Fenster und Türen können ausschließlich innerhalb einer vorhandenen Wand platziert werden.");
        return;
      }
      const start = {sheetRef: state.activeSheetRef, viewportRef: viewport.viewport_ref, model: placement.start};
      enqueueDrawCommand(start, placement.end, {
        tool: "opening",
        host,
        libraryItem: cloneValue(state.selectedLibraryItem),
        libraryVariant: cloneValue(state.selectedLibraryVariant),
        storeyParameters: cloneValue(activeStoreyParameters()),
      });
      showMessage("Wand erkannt · Öffnung wird mit der Wandstärke eingesetzt.");
      return;
    }
    const model = drawingModelPoint(point, event);
    if (["room", "roof"].includes(state.activeTool)) {
      const isRoof = state.activeTool === "roof";
      const draftPoints = isRoof ? state.roofDraftPoints : state.roomDraftPoints;
      if (isRoof ? state.roofSubmissionPending : state.roomSubmissionPending) {
        showMessage(isRoof ? "Das Dach wird gerade berechnet …" : "Der Raum wird gerade übernommen …");
        return;
      }
      if (draftPoints.length >= 3 && state.snapTarget?.kind === "area-close") {
        state.drawCurrent = {model: [...draftPoints[0]]};
        renderPlan();
        if (isRoof) completeRoofDrawing();
        else completeRoomDrawing();
        return;
      }
      const previous = draftPoints.at(-1);
      if (previous && Math.hypot(previous[0] - model[0], previous[1] - model[1]) < 0.5) {
        showMessage(`Der nächste ${isRoof ? "Dach" : "Raum"}punkt muss vom vorherigen Punkt abweichen.`);
        return;
      }
      if (!draftPoints.length) state.drawSessionId += 1;
      draftPoints.push([...model]);
      state.drawStart = {sheetRef: state.activeSheetRef, viewportRef: viewport.viewport_ref, model: [...model]};
      state.drawPointerRaw = point;
      state.drawCurrent = {model: [...model]};
      renderPlan();
      const noun = isRoof ? "Dachpunkt" : "Raumpunkt";
      showMessage(draftPoints.length >= 3
        ? `${draftPoints.length}. ${noun} gesetzt · ersten Punkt anklicken oder ESC drücken, um die Fläche zu schließen.`
        : `${draftPoints.length}. ${noun} gesetzt · mindestens ${3 - draftPoints.length} weitere${draftPoints.length === 2 ? "n" : ""} Punkt${draftPoints.length === 2 ? "" : "e"} setzen.`);
      return;
    }
    if (!state.drawStart) {
      state.drawSessionId += 1;
      state.drawStart = {sheetRef: state.activeSheetRef, viewportRef: viewport.viewport_ref, model};
      state.drawPointerRaw = point;
      state.drawCurrent = {model};
      renderPlan();
      showMessage(state.activeTool === "wall"
        ? "Wandstart gesetzt · weitere Punkte setzen · ESC beendet."
        : "Startpunkt gesetzt · Umschalttaste halten: 45°.");
      return;
    }
    if (model[0] === state.drawStart.model[0] && model[1] === state.drawStart.model[1]) {
      showMessage("Start- und Endpunkt dürfen nicht identisch sein.");
      return;
    }
    const start = state.drawStart;
    const tool = state.activeTool;
    const drawSessionId = state.drawSessionId;
    const continuousWall = tool === "wall";
    if (continuousWall) {
      state.drawStart = {sheetRef: start.sheetRef, viewportRef: start.viewportRef, model};
      state.drawPointerRaw = point;
      state.drawCurrent = {model};
      renderPlan();
    } else {
      cancelDrawing(false);
    }
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
    enqueueDrawCommand(start, model, {
      tool,
      continuousWall,
      drawSessionId,
      libraryItem: cloneValue(state.selectedLibraryItem),
      libraryVariant: cloneValue(state.selectedLibraryVariant),
      storeyParameters: cloneValue(activeStoreyParameters()),
    });
  }

  function handleWheel(event) {
    if (!state.camera) return;
    event.preventDefault();
    const camera = state.camera;
    const horizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY);
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

  function enqueueDrawCommand(start, end, options = {}) {
    const pendingId = `pending_${Date.now().toString(36)}_${++state.commandSequence}`;
    state.pendingDrawSegments.set(pendingId, {
      id: pendingId,
      sheetRef: start.sheetRef,
      tool: options.tool || state.activeTool,
      start: [...start.model],
      end: [...end],
      thicknessMm: Number(options.host?.thicknessMm) || activeWallThicknessMm(),
    });
    renderPlan();
    state.drawCommandQueue = state.drawCommandQueue
      .then(() => submitDrawCommand(start, end, {...options, pendingId}))
      .catch(handleError)
      .finally(() => {
        state.pendingDrawSegments.delete(pendingId);
        renderPlan();
      });
  }

  async function submitDrawCommand(start, end, options = {}) {
    const commandTool = options.tool || state.activeTool;
    const config = toolConfig[commandTool];
    const documentData = state.input.document;
    const modelStart = northUpPointToModel(start.model);
    const modelEnd = northUpPointToModel(end);
    const payload = {
      contract_version: "cad-command/0.2",
      command: config.command,
      document_ref: documentData.document_ref,
      sheet_ref: start.sheetRef,
      viewport_ref: start.viewportRef,
      base_revision_ref: documentData.source_revision_ref,
      client_command_id: options.pendingId || `local_${Date.now().toString(36)}_${++state.commandSequence}`,
      geometry: {start_mm: modelStart, end_mm: modelEnd},
      parameters: options.storeyParameters || activeStoreyParameters(),
      user_context: {
        source: "vectoplan-cad-browser",
        mode: "core_bridge_prepared",
        core_project_id: projectContext.coreProjectId,
        project_public_id: projectContext.projectPublicId,
      },
    };
    if (["create_wall", "create_opening", "place_library_object"].includes(config.command)) {
      const item = options.libraryItem || state.selectedLibraryItem;
      const variant = options.libraryVariant || state.selectedLibraryVariant;
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
      if (config.command === "create_opening") {
        const host = options.host;
        if (!host?.primitiveRef) throw new Error("Fenster und Türen benötigen eine vorhandene Wand als Host.");
        payload.parameters.host_wall_ref = host.primitiveRef;
        payload.parameters.host_wall_thickness_mm = host.thicknessMm;
        payload.parameters.placement_mode = "wall_hosted";
        payload.parameters.thickness_mm = host.thicknessMm;
        payload.parameters.depth_mm = host.thicknessMm;
        payload.parameters.width_mm = Math.hypot(modelEnd[0] - modelStart[0], modelEnd[1] - modelStart[1]);
      }
      if (config.command === "create_wall") {
        const edge = wallEdgeGeometry(start.model, end, payload.parameters.thickness_mm);
        if (edge) {
          payload.geometry = {
            start_mm: northUpPointToModel(edge.centreStart),
            end_mm: northUpPointToModel(edge.centreEnd),
            reference_start_mm: modelStart,
            reference_end_mm: modelEnd,
          };
          payload.parameters.reference_line = "wall_edge";
          payload.parameters.reference_edge = edge.referenceRole;
          payload.parameters.wall_body_side = "left";
        }
      }
    }
    if (config.command === "create_section_marker") payload.parameters.label = "A–A";
    const receipt = await dispatchCadCommandRequest(payload);
    publishModelMutation(receipt);
    const sheet = state.input.sheets.find((item) => item.sheet_ref === start.sheetRef);
    if (sheet && receipt.preview_element) sheet.elements.push(receipt.preview_element);
    if (!receipt.accepted) {
      state.commands.push({receipt, sheetRef: start.sheetRef, element: receipt.preview_element});
      state.redoCommands = [];
    }
    state.selectedPrimitive = null;
    await refreshProjection();
    showMessage(receipt.accepted
      ? options.continuousWall
        ? "Wandsegment gespeichert · direkt weiterzeichnen · ESC beendet."
        : `${config.label} gespeichert; 2D und 3D verwenden dasselbe Modell.`
      : options.continuousWall
        ? "Wandsegment lokal angelegt · direkt weiterzeichnen · ESC beendet."
        : `${config.label} angelegt · Modelländerung für Core und 3D vorbereitet.`);
  }

  async function submitRoomCommand(roomDraft = null) {
    const selection = roomDraft || state.worldSelection;
    const item = state.selectedLibraryItem;
    const variant = state.selectedLibraryVariant;
    if (!selection) throw new Error("Keine Raumkontur gezeichnet.");
    if (!item || item.placement_kind !== "room" || !variant) throw new Error("Bitte Raum oder Treppe auswählen.");
    const documentData = state.input.document;
    const displayPoints = normalizedPolygonPoints(selection.points).length >= 3
      ? normalizedPolygonPoints(selection.points)
      : [
        selection.start,
        [selection.end[0], selection.start[1]],
        selection.end,
        [selection.start[0], selection.end[1]],
      ];
    if (displayPoints.length < 3 || polygonAreaAndCentroid(displayPoints).areaMm2 < 1) {
      throw new Error("Die Raumkontur benötigt mindestens drei Punkte und eine geschlossene Fläche.");
    }
    const modelPoints = displayPoints.map(northUpPointToModel);
    const modelStart = modelPoints[0];
    const modelEnd = modelPoints.at(-1);
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
      geometry: {start_mm: modelStart, end_mm: modelEnd, points_mm: modelPoints},
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
    const receipt = await dispatchCadCommandRequest(payload);
    publishModelMutation(receipt);
    if (receipt.accepted) {
      state.selectedPrimitive = null;
      state.worldSelection = null;
      await loadProjectInput({preserveCamera: true, preserveHistory: true, preserveViewState: true});
      selectTool("room");
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
    selectTool("room");
    showMessage(`${isStair ? "Treppenbereich" : "Raum"} angelegt · Modelländerung für Core und 3D vorbereitet.`);
  }

  function roofInputNumber(id, fallback, minimum, maximum, integer = false) {
    const input = document.getElementById(id);
    const parsed = Number(String(input?.value ?? fallback).trim().replace(",", "."));
    const value = Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
    return integer ? Math.round(value) : value;
  }

  function roofRequestForPoints(modelPoints) {
    const edgeOverhangs = String(document.getElementById("roof-edge-overhangs")?.value || "")
      .split(/[;,\s]+/)
      .map((value) => Number(value.replace(",", ".")))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const overhang = {
      default_mm: roofInputNumber("roof-overhang", 500, 0, 5000),
      north_mm: roofInputNumber("roof-overhang-north", 500, 0, 5000),
      east_mm: roofInputNumber("roof-overhang-east", 500, 0, 5000),
      south_mm: roofInputNumber("roof-overhang-south", 500, 0, 5000),
      west_mm: roofInputNumber("roof-overhang-west", 500, 0, 5000),
      ...(edgeOverhangs.length ? {edges_mm: edgeOverhangs} : {}),
    };
    const ridgeValue = String(document.getElementById("roof-ridge-direction")?.value || "auto");
    const ridgeDegrees = roofInputNumber("roof-ridge-degrees", 0, -360, 360);
    return {
      contract_version: "cad-roof-calculation-request/0.1",
      roof_type: String(document.getElementById("roof-tool-type")?.value || state.building?.roofType || "gable"),
      footprint: {outer_ring_mm: modelPoints},
      parameters: {
        pitch_deg: roofInputNumber("roof-pitch", 35, 0, 80),
        eaves_height_mm: roofInputNumber("roof-eaves-height", 6000, -100000, 100000),
        ridge_direction: ridgeValue === "degrees" ? ridgeDegrees : ridgeValue,
        overhang_mm: overhang,
        roof_skin_thickness_mm: roofInputNumber("roof-skin-thickness", 180, 1, 2000),
        roof_skin_material: String(document.getElementById("roof-skin-material")?.value || "generic-roof-build-up"),
        plateau_width_ratio: roofInputNumber("roof-plateau-ratio", 0.25, 0.05, 0.8),
        mansard_break_ratio: roofInputNumber("roof-mansard-break", 0.38, 0.1, 0.8),
        mansard_lower_pitch_deg: roofInputNumber("roof-mansard-lower-pitch", 70, 10, 85),
        mansard_upper_pitch_deg: roofInputNumber("roof-mansard-upper-pitch", 28, 1, 70),
        hip_end_ratio: roofInputNumber("roof-hip-end-ratio", 0.5, 0.1, 1),
        barrel_rise_mm: roofInputNumber("roof-barrel-rise", 3000, 100, 30000),
        barrel_segment_count: roofInputNumber("roof-barrel-segments", 12, 4, 64, true),
        sawtooth_count: roofInputNumber("roof-sawtooth-count", 3, 1, 20, true),
        sawtooth_pitch_deg: roofInputNumber("roof-sawtooth-pitch", 35, 5, 80),
        structure: {
          rafter: {
            width_mm: roofInputNumber("roof-rafter-width", 80, 20, 1000),
            height_mm: roofInputNumber("roof-rafter-height", 200, 20, 1500),
            spacing_mm: roofInputNumber("roof-rafter-spacing", 700, 100, 3000),
          },
          purlin: {
            width_mm: roofInputNumber("roof-purlin-width", 160, 20, 1500),
            height_mm: roofInputNumber("roof-purlin-height", 240, 20, 2000),
            maximum_spacing_mm: roofInputNumber("roof-purlin-spacing", 2500, 250, 10000),
          },
        },
      },
    };
  }

  async function calculateRoofRequest(request) {
    const response = await fetch(`${routePrefix}/automation/roof/calculate`, {
      method: "POST",
      headers: {"Content-Type": "application/json", Accept: "application/json"},
      body: JSON.stringify(request),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      throw new Error((result.errors || []).join("; ") || result.message || "Dachberechnung fehlgeschlagen.");
    }
    return result;
  }

  function roofElementForRef(primitiveRef) {
    for (const sheet of state.input?.sheets || []) {
      const element = (sheet.elements || []).find((entry) => entry.element_ref === primitiveRef && entry.kind === "roof");
      if (element) return {sheet, element};
    }
    return null;
  }

  function persistentRoofTarget(element) {
    const source = element?.source && typeof element.source === "object" ? element.source : {};
    const objectInstanceId = String(element?.object_instance_id || source.object_instance_id || "").trim();
    const rawAnchor = element?.object_anchor || source.object_anchor;
    if (!objectInstanceId || !rawAnchor || typeof rawAnchor !== "object") return null;
    const anchor = {
      x: Number(rawAnchor.x),
      y: Number(rawAnchor.y),
      z: Number(rawAnchor.z),
    };
    return Object.values(anchor).every(Number.isFinite) ? {objectInstanceId, anchor} : null;
  }

  function primitiveForPersistentRoof(objectInstanceId) {
    return currentViewport()?.primitives?.find((primitive) => (
      String(primitive.metadata?.source?.object_instance_id || "") === objectInstanceId
    )) || null;
  }

  async function recalculateRoofPrimitive(primitiveRef, {recordHistory = false} = {}) {
    const source = sourcePrimitiveForRef(primitiveRef);
    const target = roofElementForRef(primitiveRef);
    if (!source || !target) throw new Error("Das ausgewählte Dach ist nicht als bearbeitbarer CAD-Entwurf verfügbar.");
    const geometry = state.pointGeometryOverrides.get(primitiveRef) || source.geometry || {};
    const sourcePoints = normalizedPolygonPoints(geometry.points_mm);
    if (sourcePoints.length < 3 || polygonAreaAndCentroid(sourcePoints).areaMm2 < 1) {
      throw new Error("Die bearbeitete Dachkontur benötigt mindestens drei Punkte und eine gültige Fläche.");
    }
    const persistentTarget = persistentRoofTarget(target.element);
    const before = recordHistory && !persistentTarget ? editSnapshot() : null;
    const request = roofRequestForPoints(sourcePoints);
    const calculation = await calculateRoofRequest(request);
    if (persistentTarget && projectContext.coreProjectId) {
      const documentData = state.input.document;
      const payload = {
        contract_version: "cad-command/0.2",
        command: "update_roof",
        document_ref: documentData.document_ref,
        sheet_ref: target.sheet.sheet_ref,
        viewport_ref: state.activeViewportRef,
        base_revision_ref: documentData.source_revision_ref,
        client_command_id: `roof_update_${Date.now().toString(36)}_${++state.commandSequence}`,
        geometry: {start_mm: sourcePoints[0], end_mm: sourcePoints.at(-1), points_mm: sourcePoints},
        family_ref: "world-edit.roof",
        variant_ref: calculation.roof_type || "gable",
        parameters: {
          ...activeStoreyParameters(),
          target_object_instance_id: persistentTarget.objectInstanceId,
          target_anchor: persistentTarget.anchor,
          roof_request: request,
          roof_calculation: calculation,
        },
        user_context: {
          source: "vectoplan-cad-roof-tool",
          mode: "persistent-roof-update",
          core_project_id: projectContext.coreProjectId,
          project_public_id: projectContext.projectPublicId,
        },
      };
      const receipt = await dispatchCadCommandRequest(payload);
      publishModelMutation(receipt);
      if (receipt.accepted) {
        state.pointGeometryOverrides.delete(primitiveRef);
        await loadProjectInput({preserveCamera: true, preserveHistory: true, preserveViewState: true});
        const refreshed = primitiveForPersistentRoof(persistentTarget.objectInstanceId);
        state.selectedPrimitive = refreshed ? northUpPrimitive(refreshed) : null;
        renderAll();
        return calculation;
      }
    }
    const roofGeometry = calculation.geometry || {};
    const area = polygonAreaAndCentroid(sourcePoints).areaMm2 / 1_000_000;
    target.element.geometry = {
      ...(target.element.geometry || {}),
      points_mm: cloneValue(roofGeometry.source_footprint_mm || sourcePoints),
      coverage_points_mm: cloneValue(roofGeometry.roof_coverage_polygon_mm || []),
      ridge_line_mm: cloneValue(roofGeometry.ridge_line_mm || []),
      roof_calculation: cloneValue(calculation),
      area_m2: Math.round(area * 100) / 100,
    };
    target.element.roof_type = calculation.roof_type;
    target.element.roof_request = cloneValue(request);
    target.element.roof_calculation = cloneValue(calculation);
    target.element.label = `Parametrisches Dach · ${calculation.roof_type || "gable"}`;
    state.pointGeometryOverrides.delete(primitiveRef);
    await refreshProjection();
    const refreshed = sourcePrimitiveForRef(primitiveRef);
    state.selectedPrimitive = refreshed ? northUpPrimitive(refreshed) : null;
    if (recordHistory && before) {
      state.commands.push({
        kind: "local-edit",
        receipt: {command: {command: "modify_point"}},
        before,
        after: editSnapshot(),
      });
      state.redoCommands = [];
    }
    renderAll();
    return calculation;
  }

  async function submitRoofCommand(roofDraft) {
    if (!roofDraft) throw new Error("Keine Dachkontur gezeichnet.");
    const displayPoints = normalizedPolygonPoints(roofDraft.points);
    if (displayPoints.length < 3 || polygonAreaAndCentroid(displayPoints).areaMm2 < 1) {
      throw new Error("Die Dachkontur benötigt mindestens drei Punkte und eine geschlossene Fläche.");
    }
    const modelPoints = displayPoints.map(northUpPointToModel);
    const request = roofRequestForPoints(modelPoints);
    const calculation = await calculateRoofRequest(request);
    const documentData = state.input.document;
    const payload = {
      contract_version: "cad-command/0.2",
      command: "create_roof",
      document_ref: documentData.document_ref,
      sheet_ref: roofDraft.sheetRef,
      viewport_ref: roofDraft.viewportRef,
      base_revision_ref: documentData.source_revision_ref,
      client_command_id: `roof_${Date.now().toString(36)}_${++state.commandSequence}`,
      geometry: {start_mm: modelPoints[0], end_mm: modelPoints.at(-1), points_mm: modelPoints},
      parameters: {
        ...activeStoreyParameters(),
        roof_request: request,
        roof_calculation: calculation,
      },
      user_context: {
        source: "vectoplan-cad-roof-tool",
        mode: "cad-parametric-local",
        core_project_id: projectContext.coreProjectId,
        project_public_id: projectContext.projectPublicId,
      },
    };
    const receipt = await dispatchCadCommandRequest(payload);
    publishModelMutation(receipt);
    if (receipt.accepted) {
      state.selectedPrimitive = null;
      await loadProjectInput({preserveCamera: true, preserveHistory: true, preserveViewState: true});
      selectTool("roof");
      showMessage(`Dach gespeichert: ${calculation.summary?.face_count || 0} Flächen, ${calculation.summary?.rafter_count || 0} Sparren und ${calculation.summary?.purlin_count || 0} Pfetten · 2D und 3D verwenden dasselbe Modell.`);
      return;
    }
    const sheet = state.input.sheets.find((entry) => entry.sheet_ref === roofDraft.sheetRef);
    if (sheet && receipt.preview_element) sheet.elements.push(receipt.preview_element);
    state.commands.push({receipt, sheetRef: roofDraft.sheetRef, element: receipt.preview_element});
    state.redoCommands = [];
    state.selectedPrimitive = null;
    await refreshProjection();
    selectTool("roof");
    showMessage(`Dach berechnet: ${calculation.summary?.face_count || 0} Flächen, ${calculation.summary?.rafter_count || 0} Sparren und ${calculation.summary?.purlin_count || 0} Pfetten.`);
  }

  function openRoomLabelEditor(primitive) {
    const panel = document.getElementById("room-label-panel");
    const input = document.getElementById("room-label-input");
    if (!panel || !input) return;
    state.roomLabelEditPrimitive = primitive;
    const currentLabel = String(primitive.text || primitive.metadata?.label || "Raum").split("\n")[0] || "Raum";
    input.value = currentLabel;
    panel.hidden = false;
    input.focus();
    input.select();
  }

  function closeRoomLabelEditor() {
    const panel = document.getElementById("room-label-panel");
    if (panel) panel.hidden = true;
    state.roomLabelEditPrimitive = null;
  }

  async function saveRoomLabelEditor() {
    const primitive = state.roomLabelEditPrimitive;
    const input = document.getElementById("room-label-input");
    if (!primitive || !input) return;
    const currentLabel = String(primitive.text || primitive.metadata?.label || "Raum").split("\n")[0] || "Raum";
    const label = String(input.value || "").trim();
    if (!label || label === currentLabel) {
      closeRoomLabelEditor();
      return;
    }
    closeRoomLabelEditor();
    const item = state.libraryItems.find((entry) => entry.family_ref === primitive.metadata?.family_ref)
      || quickLibraryItem("room");
    const variant = item?.variants?.find((entry) => entry.variant_ref === primitive.metadata?.variant_ref)
      || item?.variants?.find((entry) => entry.is_default)
      || item?.variants?.[0];
    if (!item || !variant) throw new Error("Die Creative-Library-Referenz des Raums ist nicht verfügbar.");
    const geometry = primitive.geometry || {};
    let displayPoints = normalizedPolygonPoints(geometry.points_mm);
    if (displayPoints.length < 3) {
      const x = Number(geometry.x_mm) || 0;
      const y = Number(geometry.y_mm) || 0;
      const width = Number(geometry.width_mm) || 1;
      const depth = Number(geometry.depth_mm) || 1;
      displayPoints = [[x, y], [x + width, y], [x + width, y + depth], [x, y + depth]];
    }
    const modelPoints = displayPoints.map(northUpPointToModel);
    const documentData = state.input.document;
    const payload = {
      contract_version: "cad-command/0.2",
      command: "update_room",
      document_ref: documentData.document_ref,
      sheet_ref: state.activeSheetRef,
      viewport_ref: state.activeViewportRef,
      base_revision_ref: documentData.source_revision_ref,
      client_command_id: `room_label_${Date.now().toString(36)}_${++state.commandSequence}`,
      geometry: {start_mm: modelPoints[0], end_mm: modelPoints.at(-1), points_mm: modelPoints},
      family_ref: item.family_ref,
      variant_ref: variant.variant_ref,
      parameters: {
        ...activeStoreyParameters(),
        target_element_ref: primitive.metadata?.element_ref || primitive.primitive_ref,
        room_type: primitive.metadata?.room_type || "sonstige",
        label,
        height_mm: Number(geometry.height_mm) || Number(activeStoreyParameters().storey_height_mm) || 2770,
      },
      user_context: {
        source: "vectoplan-cad-room-label",
        mode: "core_bridge_prepared",
        core_project_id: projectContext.coreProjectId,
        project_public_id: projectContext.projectPublicId,
      },
    };
    const receipt = await dispatchCadCommandRequest(payload);
    publishModelMutation(receipt);
    if (receipt.accepted) {
      await loadProjectInput({preserveCamera: true, preserveHistory: true, preserveViewState: true});
    } else {
      const sheet = state.input.sheets.find((entry) => entry.sheet_ref === state.activeSheetRef);
      const sourceRef = primitive.metadata?.element_ref || primitive.primitive_ref;
      receipt.preview_element.element_ref = sourceRef;
      const index = sheet?.elements?.findIndex((element) => element.element_ref === sourceRef) ?? -1;
      if (index >= 0) sheet.elements.splice(index, 1, receipt.preview_element);
      else sheet?.elements?.push(receipt.preview_element);
      state.commands.push({receipt, sheetRef: state.activeSheetRef, element: receipt.preview_element});
      state.redoCommands = [];
      await refreshProjection();
    }
    state.selectedPrimitive = null;
    showMessage(`Raumbezeichnung in „${label}“ geändert.`);
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
    if (entry.kind === "local-edit") {
      state.redoCommands.push(entry);
      restoreEditSnapshot(entry.before);
      showMessage(`${commandLabel(entry.receipt.command.command)} rückgängig gemacht.`);
      return;
    }
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
    if (entry.kind === "local-edit") {
      state.commands.push(entry);
      restoreEditSnapshot(entry.after);
      showMessage(`${commandLabel(entry.receipt.command.command)} wiederhergestellt.`);
      return;
    }
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
    if (state.planOverview) {
      state.camera = planOverviewCamera();
      renderPlan();
      return;
    }
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
    svg.addEventListener("pointerleave", () => {
      if (state.drawStart || state.pan) return;
      state.cursorPoint = null;
      state.snapTarget = null;
      schedulePlanRender();
    });
    svg.addEventListener("wheel", handleWheel, {passive: false});
    svg.addEventListener("auxclick", (event) => {
      if (event.button === 1) event.preventDefault();
    });
    svg.addEventListener("contextmenu", (event) => {
      if (!state.drawStart) return;
      event.preventDefault();
      cancelDrawing(true, true);
    });
    document.querySelector('[data-action="toggle-building"]')?.addEventListener("click", toggleBuildingPanel);
    document.getElementById("building-type")?.addEventListener("change", (event) => {
      if (!state.building) return;
      state.building.buildingType = event.target.value;
      publishBuildingDraft();
      syncPlanWorkspacePanel();
      if (state.planOverview) renderPlan();
    });
    document.getElementById("roof-type")?.addEventListener("change", (event) => {
      if (!state.building) return;
      state.building.roofType = event.target.value;
      publishBuildingDraft();
    });
    document.querySelectorAll('[data-action="add-storey"]').forEach((button) => {
      button.addEventListener("click", () => addBuildingStorey(button.dataset.storeyKind));
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
    document.querySelectorAll("[data-edit-action]").forEach((button) => {
      button.addEventListener("click", (event) => handleEditAction(button.dataset.editAction, event));
    });
    document.querySelectorAll("[data-view-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.viewAction === "plan-overview") togglePlanOverview();
      });
    });
    document.getElementById("plan-phase")?.addEventListener("change", (event) => {
      state.planPhase = event.target.value;
      syncPlanWorkspacePanel();
      renderPlan();
    });
    document.getElementById("plan-content")?.addEventListener("change", (event) => {
      state.planContent = event.target.value;
      state.planViewSelection = planViewOptions(state.planContent)[0]?.value || "all";
      syncPlanWorkspacePanel();
      renderPlan();
    });
    document.getElementById("plan-view-selection")?.addEventListener("change", (event) => {
      state.planViewSelection = event.target.value;
      if (state.planContent === "floor_plans" && state.planViewSelection !== state.building?.activeStoreyId) {
        selectBuildingStorey(state.planViewSelection);
      }
      renderPlan();
    });
    document.querySelector('[data-action="close-distort"]')?.addEventListener("click", () => {
      document.getElementById("distort-panel").hidden = true;
    });
    document.querySelector('[data-action="apply-distort"]')?.addEventListener("click", applyDistort);
    document.querySelector('[data-action="save-room-label"]')?.addEventListener("click", () => saveRoomLabelEditor().catch(handleError));
    document.querySelector('[data-action="cancel-room-label"]')?.addEventListener("click", closeRoomLabelEditor);
    document.getElementById("room-label-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveRoomLabelEditor().catch(handleError);
      }
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
    document.querySelector('[data-action="finish-roof"]')?.addEventListener("click", () => completeRoofDrawing());
    document.querySelectorAll("[data-roof-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const primitive = selectedSourcePrimitive();
        if (!primitive || (primitive.source_kind !== "roof" && primitive.style_ref !== "roof")) return;
        showMessage("Dachparameter geändert · 2D-Geometrie und Tragwerk werden aktualisiert …");
        recalculateRoofPrimitive(primitive.primitive_ref, {recordHistory: true}).then((calculation) => {
          showMessage(`Dachparameter übernommen: ${calculation.roof_type}, ${calculation.normalized_request?.parameters?.pitch_deg || 0}°.`);
        }).catch(handleError);
      });
    });
    window.addEventListener("resize", handleResize);
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const data = event.data && typeof event.data === "object" ? event.data : {};
      if (String(data.type || data.kind || "") !== "vectoplan-app:parcel-selection-sync") return;
      const selection = normalizeParcelSelection(data.detail || data);
      if (!selection) return;
      const previousSignature = parcelSelectionSignature();
      state.parcelSelection = selection;
      if (state.scene) renderPlan();
      if (previousSignature !== parcelSelectionSignature()) scheduleParcelProjectionReload();
    });
    window.addEventListener("keydown", handleAreaEscape, true);
    window.addEventListener("keyup", suppressAreaEscapeKeyup, true);
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
        if (state.pointDrag?.before) restoreEditSnapshot(state.pointDrag.before);
        state.pointDrag = null;
        state.pointEditMode = false;
        cancelDrawing(true, true);
        document.getElementById("distort-panel").hidden = true;
        closeRoomLabelEditor();
        closePanels();
        syncEditToolButtons();
      }
      if (!isEditableTarget(event.target) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedPrimitive();
      }
      if (!isEditableTarget(event.target) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
        event.preventDefault();
        copySelectedPrimitive({cut: true});
      }
      if (!isEditableTarget(event.target) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClipboard();
      }
      if (!isEditableTarget(event.target) && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleEditAction("rotate", event);
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
    syncEditToolButtons();
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
    await loadPlanRules();
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
