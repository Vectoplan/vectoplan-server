(() => {
  "use strict";

  const app = document.querySelector(".cad-app");
  const routePrefix = app.dataset.routePrefix || "/api/v1/cad";
  const svg = document.getElementById("plan-svg");
  const ns = "http://www.w3.org/2000/svg";

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

  async function loadProfiles() {
    const data = await fetchJson(`${routePrefix}/plan-profiles`);
    const select = document.getElementById("plan-profile");
    select.replaceChildren();
    data.profiles.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.label;
      select.append(option);
    });
  }

  async function loadTestInput() {
    const input = await fetchJson(`${routePrefix}/test-input`);
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
    syncProfileSelection();
    showMessage("Erdgeschoss geladen. Änderungen bleiben lokal in diesem Browser-Tab.");
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

  function syncProfileSelection() {
    const profileId = state.input?.document?.plan_profile?.id;
    const select = document.getElementById("plan-profile");
    if (profileId && [...select.options].some((option) => option.value === profileId)) select.value = profileId;
  }

  function renderAll() {
    renderTree();
    renderLayerControls();
    renderPlan();
    renderInspector();
    renderCommandLog();
    syncHistoryButtons();
  }

  function renderTree() {
    const sheetTree = document.getElementById("sheet-tree");
    sheetTree.replaceChildren();
    const sheets = state.scene?.sheets || [];
    document.getElementById("sheet-count").textContent = String(sheets.length);
    sheets.forEach((sheet) => {
      const button = document.createElement("button");
      button.type = "button";
      button.classList.toggle("is-active", sheet.sheet_ref === state.activeSheetRef);
      const title = document.createElement("span");
      title.textContent = `${sheet.sheet_number || sheet.sheet_ref} · Erdgeschoss`;
      const meta = document.createElement("small");
      meta.textContent = "Unbegrenzter Modellbereich";
      button.append(title, meta);
      button.addEventListener("click", () => activateSheet(sheet.sheet_ref));
      sheetTree.append(button);
    });
  }

  function activateSheet(sheetRef) {
    state.activeSheetRef = sheetRef;
    state.activeViewportRef = groundFloorViewport()?.viewport_ref || null;
    state.selectedPrimitive = null;
    state.camera = null;
    state.baseCameraWidth = null;
    cancelDrawing(false);
    fitGroundFloor(false);
    renderAll();
  }

  function renderLayerControls() {
    const container = document.getElementById("layer-list");
    container.replaceChildren();
    const sheet = currentSceneSheet();
    const viewport = currentViewport();
    if (!sheet || !viewport) return;
    const usedLayers = new Set((viewport.primitives || []).map((primitive) => primitive.layer_ref));
    (sheet.layers || []).filter((layer) => usedLayers.has(layer.layer_ref)).forEach((layer) => {
      const row = document.createElement("label");
      row.className = "layer-row";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.visibleLayers.has(layer.layer_ref);
      checkbox.dataset.layer = layer.layer_ref;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.visibleLayers.add(layer.layer_ref);
        else state.visibleLayers.delete(layer.layer_ref);
        renderPlan();
      });
      const swatch = document.createElement("span");
      swatch.className = "layer-swatch";
      swatch.dataset.layer = layer.layer_ref;
      const label = document.createElement("span");
      label.textContent = layer.label;
      const count = document.createElement("span");
      count.className = "layer-count";
      count.textContent = String((viewport.primitives || []).filter((primitive) => primitive.layer_ref === layer.layer_ref).length);
      row.append(checkbox, swatch, label, count);
      container.append(row);
    });
  }

  function viewportCamera(viewport) {
    const bounds = viewport?.model_view_box_mm;
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
    document.getElementById("draft-indicator").hidden = state.commands.length === 0;
  }
  function renderPrimitive(primitive) {
    const geometry = primitive.geometry;
    let node;
    if (primitive.primitive_type === "polygon") {
      node = svgEl("polygon", {points: geometry.points_mm.map((point) => point.join(",")).join(" ")});
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
      event.stopPropagation();
      state.selectedPrimitive = primitive;
      renderPlan();
      renderInspector();
    });
    return node;
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
    document.getElementById("prop-source").textContent = item.source || "–";
    document.getElementById("prop-draft").hidden = !item.local_draft;
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
    if (!state.pan || state.pan.pointerId !== event.pointerId) return false;
    const dx = event.clientX - state.pan.clientX;
    const dy = event.clientY - state.pan.clientY;
    const start = state.pan.camera;
    state.camera.x = start.x - dx * start.width / Math.max(svg.clientWidth, 1);
    state.camera.y = start.y - dy * start.height / Math.max(svg.clientHeight, 1);
    schedulePlanRender();
    return true;
  }

  function endPan(event) {
    if (!state.pan || state.pan.pointerId !== event.pointerId) return false;
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    state.pan = null;
    svg.classList.remove("is-panning");
    return true;
  }
  function handlePointerMove(event) {
    if (!state.scene) return;
    if (updatePan(event)) return;
    if (!state.drawStart) return;
    const point = pointFromEvent(event);
    if (!point) return;
    state.drawCurrent = {model: snappedModelPoint(point)};
    schedulePlanRender();
  }

  function handlePointerDown(event) {
    if (!state.scene) return;
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

  async function requestExport(format) {
    if (!state.input) return;
    const documentData = state.input.document;
    const payload = {
      contract_version: "cad-export/0.1",
      format,
      document_ref: documentData.document_ref,
      sheet_ref: state.activeSheetRef,
      source_revision_ref: documentData.source_revision_ref,
      layout_profile: "sheet_as_displayed",
      layer_refs: [...state.visibleLayers],
      options: {include_local_drafts: false},
    };
    const response = await fetchJson(`${routePrefix}/exports`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    showMessage(response.message);
  }

  function isEditableTarget(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  }

  function handleResize() {
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
    svg.addEventListener("pointerup", endPan);
    svg.addEventListener("pointercancel", endPan);
    svg.addEventListener("wheel", handleWheel, {passive: false});
    svg.addEventListener("auxclick", (event) => {
      if (event.button === 1) event.preventDefault();
    });
    svg.addEventListener("contextmenu", (event) => {
      if (!state.drawStart) return;
      event.preventDefault();
      cancelDrawing();
    });
    document.querySelector('[data-action="load-test"]').addEventListener("click", () => loadTestInput().catch(handleError));
    document.querySelector('[data-action="undo"]').addEventListener("click", () => undo().catch(handleError));
    document.querySelector('[data-action="redo"]').addEventListener("click", () => redo().catch(handleError));
    document.querySelector('[data-action="zoom-fit"]').addEventListener("click", () => fitGroundFloor());
    document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
    document.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", () => requestExport(button.dataset.export).catch(handleError)));
    document.querySelector('[data-action="show-all-layers"]').addEventListener("click", () => {
      state.knownLayers.forEach((layer) => state.visibleLayers.add(layer));
      renderLayerControls();
      renderPlan();
    });
    document.getElementById("plan-profile").addEventListener("change", (event) => {
      showMessage(`Planprofil ${event.target.selectedOptions[0]?.textContent || event.target.value} gewählt. Eine Neuprojektion erfordert später vectoplan-core.`);
    });
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space" && !isEditableTarget(event.target)) {
        event.preventDefault();
        state.spacePressed = true;
        svg.classList.add("is-pan-ready");
      }
      if (event.key === "Escape") cancelDrawing();
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
    await Promise.all([loadBootstrap(), loadProfiles()]);
    await loadTestInput();
  }

  init().catch(handleError);
})();
