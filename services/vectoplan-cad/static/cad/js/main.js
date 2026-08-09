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
    commands: [],
    redoCommands: [],
    commandSequence: 0,
    camera: null,
    baseCameraWidth: null,
    pan: null,
    touchPoints: new Map(),
    pinch: null,
    spacePressed: false,
    renderScheduled: false,
  };

  const toolConfig = {
    select: {label: "Auswahl", hint: "Element anklicken, um seine semantischen Referenzen zu prüfen."},
    wall: {label: "Wand", command: "create_wall", hint: "Start- und Endpunkt auf der Modellfläche wählen. Die Wand wird am Fangraster ausgerichtet."},
    line: {label: "Linie", command: "create_line", hint: "Zwei Punkte auf der Modellfläche wählen, um eine lokale Linie zu erzeugen."},
    dimension: {label: "Maß", command: "create_dimension", hint: "Zwei Messpunkte wählen. Die Länge wird aus den Modellkoordinaten berechnet."},
    section: {label: "Schnitt", command: "create_section_marker", hint: "Zwei Punkte wählen, um im Erdgeschoss eine Schnittmarke A–A anzulegen."},
  };

  function svgEl(name, attrs = {}, text = null) {
    const node = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) node.setAttribute(key, String(value));
    });
    if (text !== null) node.textContent = text;
    return node;
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
      throw new Error(details || data.error || data.message || `HTTP ${response.status}`);
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

  async function activateProjection(input, message) {
    if (!input || !Array.isArray(input.sheets)) {
      throw new Error("Core hat keine gültige CAD-Projektion geliefert.");
    }
    state.input = input;
    state.activeSheetRef = input.sheets[0]?.sheet_ref || null;
    state.activeViewportRef = input.sheets[0]?.viewports?.find((viewport) => viewport.kind === "floor_plan")?.viewport_ref || null;
    state.selectedPrimitive = null;
    state.commands = [];
    state.redoCommands = [];
    state.camera = null;
    state.baseCameraWidth = null;
    state.visibleLayers.clear();
    state.knownLayers.clear();
    cancelDrawing(false);
    await refreshProjection();
    showMessage(message);
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

  async function loadProjectInput() {
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
        }),
      },
    );
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
      loadedMessage,
    );
    updateConnectionStatus({
      coreConnected: true,
      projectConnected: true,
      projectText: semanticMode
        ? `Projekt ${projectLabel} verbunden · ${constructionElementCount} Bauwerksobjekte aus ${userPlacementCount} Benutzerblöcken`
        : userPlacementMode
        ? `Projekt ${projectLabel} verbunden · ${userPlacementCount} Benutzerblöcke`
        : `Projekt ${projectLabel} verbunden`,
    });
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
    const rectangles = (viewport?.primitives || []).map(primitiveModelBounds).filter(Boolean);
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

    const completeBounds = viewport?.model_view_box_mm;
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
    const bounds = focusedProjectionBounds(viewport) || viewport?.model_view_box_mm;
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
    defs.append(minorPattern, majorPattern);
    svg.append(defs);
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, class: "workspace-plane"}));
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, fill: "url(#workspace-grid-minor)"}));
    svg.append(svgEl("rect", {x: camera.x, y: camera.y, width: camera.width, height: camera.height, fill: "url(#workspace-grid-major)"}));

    const bounds = viewport.model_view_box_mm;
    if (bounds) {
      svg.append(svgEl("rect", {x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, class: "model-frame"}));
      svg.append(svgEl("text", {x: bounds.x + 120, y: bounds.y - 220, class: "model-frame-label"}, "ERDGESCHOSS · MODELLBEREICH"));
    }
    (viewport.primitives || []).forEach((primitive) => svg.append(renderPrimitive(primitive)));
    renderDraft();
  }
  function renderPrimitive(primitive) {
    const geometry = primitive.geometry;
    let node;
    if (primitive.primitive_type === "polygon") {
      node = svgEl("polygon", {points: geometry.points_mm.map((point) => point.join(",")).join(" ")});
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
    group.append(svgEl("line", {x1: start[0], y1: start[1], x2: end[0], y2: end[1], class: "draft-preview"}));
    group.append(svgEl("circle", {cx: start[0], cy: start[1], r: 85, class: "draft-preview-point"}));
    group.append(svgEl("circle", {cx: end[0], cy: end[1], r: 85, class: "draft-preview-point"}));
    svg.append(group);
  }

  function renderInspector() {
    const empty = document.getElementById("inspector-empty");
    const inspector = document.getElementById("inspector");
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
    document.getElementById("command-count").textContent = String(state.commands.length);
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
      create_line: "Linie erstellen",
      create_dimension: "Bemaßung erstellen",
      create_section_marker: "Schnittmarke erstellen",
    }[command] || command;
  }

  function selectTool(tool) {
    if (!toolConfig[tool]) return;
    state.activeTool = tool;
    cancelDrawing(false);
    document.querySelectorAll("[data-tool]").forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    svg.classList.toggle("is-drawing", tool !== "select");
    document.getElementById("active-tool-label").textContent = toolConfig[tool].label;
    document.getElementById("tool-hint").textContent = toolConfig[tool].hint;
    document.getElementById("wall-thickness-field").hidden = tool !== "wall";
  }

  function cancelDrawing(render = true) {
    const hadDraft = Boolean(state.drawStart);
    state.drawStart = null;
    state.drawCurrent = null;
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

  function snappedModelPoint(point) {
    if (!document.getElementById("snap-enabled").checked) return [Math.round(point.x), Math.round(point.y)];
    const step = Number(document.getElementById("snap-size").value) || 100;
    return [Math.round(point.x / step) * step, Math.round(point.y / step) * step];
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
    const minWidth = Math.max(1200, baseWidth * 0.08);
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
    if (event.pointerType === "touch" && state.touchPoints.has(event.pointerId)) {
      state.touchPoints.set(event.pointerId, {clientX: event.clientX, clientY: event.clientY});
      if (updatePinch()) return;
    }
    if (updatePan(event)) return;
    if (!state.drawStart) return;
    const point = pointFromEvent(event);
    if (!point) return;
    state.drawCurrent = {model: snappedModelPoint(point)};
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
    const model = snappedModelPoint(point);
    if (!state.drawStart) {
      state.drawStart = {sheetRef: state.activeSheetRef, viewportRef: viewport.viewport_ref, model};
      state.drawCurrent = {model};
      renderPlan();
      return;
    }
    if (model[0] === state.drawStart.model[0] && model[1] === state.drawStart.model[1]) {
      showMessage("Start- und Endpunkt dürfen nicht identisch sein.");
      return;
    }
    const start = state.drawStart;
    cancelDrawing(false);
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
    const minWidth = Math.max(1200, baseWidth * 0.08);
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
    state.commandSequence += 1;
    const payload = {
      contract_version: "cad-command/0.1",
      command: config.command,
      document_ref: documentData.document_ref,
      sheet_ref: start.sheetRef,
      viewport_ref: start.viewportRef,
      base_revision_ref: documentData.source_revision_ref,
      client_command_id: `local_${Date.now().toString(36)}_${state.commandSequence}`,
      geometry: {start_mm: start.model, end_mm: end},
      parameters: {},
      user_context: {source: "vectoplan-cad-browser", mode: "stateless_draft"},
    };
    if (config.command === "create_wall") {
      payload.parameters.thickness_mm = Number(document.getElementById("wall-thickness").value) || 240;
      payload.family_ref = "hochbau.waende.ziegelwand";
      payload.variant_ref = `${payload.parameters.thickness_mm}mm_entwurf`;
    }
    if (config.command === "create_section_marker") payload.parameters.label = "A–A";
    const receipt = await fetchJson(`${routePrefix}/commands`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    const sheet = state.input.sheets.find((item) => item.sheet_ref === start.sheetRef);
    sheet.elements.push(receipt.preview_element);
    state.commands.push({receipt, sheetRef: start.sheetRef, element: receipt.preview_element});
    state.redoCommands = [];
    state.selectedPrimitive = null;
    await refreshProjection();
    showMessage(`${config.label} lokal angelegt.`);
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
    document.querySelector('[data-action="toggle-inspector"]').setAttribute("aria-expanded", String(inspectorOpen));
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
    document.querySelector('[data-action="toggle-inspector"]').addEventListener("click", toggleInspector);
    document.querySelectorAll('[data-action="close-panels"]').forEach((button) => button.addEventListener("click", closePanels));
    syncPanelButtons();
    document.querySelector('[data-action="undo"]').addEventListener("click", () => undo().catch(handleError));
    document.querySelector('[data-action="redo"]').addEventListener("click", () => redo().catch(handleError));
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", (event) => {
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
      if (event.code === "Space") {
        state.spacePressed = false;
        svg.classList.remove("is-pan-ready");
      }
    });
    window.addEventListener("blur", () => {
      state.spacePressed = false;
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
    selectTool("select");
    await loadBootstrap();
    if (projectContext.coreProjectId) {
      await loadProjectInput();
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
