(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const app = document.getElementById("statik-app");
  const apiBase = String(app?.dataset.apiBase || "/api/v1/statik").replace(/\/$/, "");
  const form = document.getElementById("element-form");
  const canvas = document.getElementById("structural-canvas");
  const surfaceCanvas = document.getElementById("surface-result-canvas");
  const model3dCanvas = document.getElementById("structural-3d-canvas");
  const calculationDialog = document.getElementById("calculation-dialog");
  let surfaceResultView = null;
  let structural3dView = null;

  const byId = (id) => document.getElementById(id);
  const state = {
    bootstrap: null,
    model: null,
    selectedRef: null,
    results: new Map(),
    surfaceResults: new Map(),
    engineeringResults: new Map(),
    dossiers: new Map(),
    dossierTab: "project",
    activeDossier: null,
    projectCatalog: null,
    projectWorkspace: null,
    projectCaseId: null,
    projectOverrides: new Map(),
    projectBaseValues: new Map(),
    variableScope: "position",
    variableSearch: "",
    outputBlobUrl: null,
    view: "system",
    dirty: false,
    viewBox: { x: 0, y: 0, width: 920, height: 560 },
    pan: null,
    toastTimer: null,
  };

  const KIND_META = {
    slab: { label: "Decke", short: "D", symbol: "slab-symbol" },
    beam: { label: "Träger", short: "T", symbol: "beam-symbol" },
    wall: { label: "Wand", short: "W", symbol: "wall-symbol" },
    column: { label: "Stütze", short: "S", symbol: "column-symbol" },
    foundation: { label: "Gründung", short: "F", symbol: "foundation-symbol" },
  };

  function svgElement(name, attributes = {}, text = null) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== null) node.textContent = String(text);
    return node;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = Array.isArray(payload.errors) ? payload.errors.join(" · ") : payload.message;
      throw new Error(details || `HTTP ${response.status}`);
    }
    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? "–").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  }

  function dossierTable(headers, rows) {
    if (!rows.length) return '<div class="dossier-empty"><span>Für diesen Abschnitt liegen noch keine Datensätze vor.</span></div>';
    return `<table class="dossier-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function dossierStatus(status) {
    return `<span class="dossier-pill${status === "open" || status === "attention" || status === "not_adequate" ? " is-attention" : ""}">${escapeHtml(status)}</span>`;
  }

  function currentProjectPosition(elementRef = state.selectedRef) {
    return state.projectWorkspace?.result?.positions?.find((item) => item.position_ref === elementRef) || null;
  }

  function projectStatusMarkup(status) {
    const label = { passed: "rechnerisch plausibel", attention: "Hinweis", not_adequate: "nicht ausreichend", not_assessed: "nicht bewertet" }[status] || status || "offen";
    const css = status === "passed" ? "" : ` is-${String(status).replaceAll("_", "-")}`;
    return `<span class="workspace-status${css}">${escapeHtml(label)}</span>`;
  }

  function projectOverviewMarkup() {
    const workspace = state.projectWorkspace;
    if (!workspace) return '<div class="dossier-empty"><span>Kein Projektarbeitsstand geladen.</span></div>';
    const result = workspace.result;
    const summary = result.summary || {};
    const template = workspace.calculation_template || {};
    const knowledge = workspace.knowledge || {};
    const positions = result.positions || [];
    const rows = positions.map((item) => {
      const positionSummary = item.result?.summary || {};
      const governing = positionSummary.governing_check || {};
      return `<tr data-select-position="${escapeHtml(item.position_ref)}"><td><button type="button" class="position-link" data-select-position="${escapeHtml(item.position_ref)}">${escapeHtml(item.position_ref)}</button></td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.group)}</td><td>${escapeHtml(governing.label || "–")}</td><td>${governing.utilization == null ? "–" : `${(Number(governing.utilization) * 100).toFixed(1)} %`}</td><td>${projectStatusMarkup(positionSummary.status)}</td></tr>`;
    }).join("");
    return `<div class="project-status-band">
      <article><span>Positionen</span><strong>${positions.length}</strong><small>${summary.check_count || 0} Nachweise</small></article>
      <article><span>Maßgebend</span><strong>${summary.governing_check?.utilization == null ? "–" : `${Math.round(Number(summary.governing_check.utilization) * 100)} %`}</strong><small>${escapeHtml(summary.governing_check?.label || "nicht bewertet")}</small></article>
      <article><span>Rechenwege</span><strong>${knowledge.statistics?.calculation_path_count || 0}</strong><small>projektweit aktiv</small></article>
      <article><span>Pipelines</span><strong>${knowledge.statistics?.pipeline_count || 0}</strong><small>Runtime-Gate offen</small></article>
      <article><span>Ausgabe</span><strong>${escapeHtml(template.title || "Template")}</strong><small>6 HTML-Blätter · PDF</small></article>
    </div><div class="project-overview-grid"><article class="dossier-card"><h3>Positions- und Prüfverzeichnis</h3><table class="dossier-table"><thead><tr><th>Pos.</th><th>Bezeichnung</th><th>Gruppe</th><th>Maßgebend</th><th>η</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></article><article class="dossier-card"><h3>Projekt- und Freigabestatus</h3>${dossierTable(["Bereich", "Stand"], [
      ["Berechnung", summary.status || "offen"],
      ["Workflow-Gate", summary.runtime_gate_passed ? "bestätigt" : "offen"],
      ["Berechnungstemplate", template.template_id || "–"],
      ["Numerische Änderungen", state.projectOverrides.size],
      ["Fachprüfung", "erforderlich"],
    ])}<div class="dossier-actions"><button type="button" data-action="run-project">Projekt neu berechnen</button><button type="button" class="primary" data-action="show-output">Ausgabe öffnen</button></div></article></div>`;
  }

  function projectPipelinesMarkup() {
    const workspace = state.projectWorkspace;
    if (!workspace) return '<div class="dossier-empty"><span>Keine Pipeline-Auswahl geladen.</span></div>';
    const pipelines = workspace.knowledge?.pipelines || [];
    const cards = pipelines.map((pipeline, index) => `<article class="pipeline-workflow-card"><b>${String(index + 1).padStart(2, "0")}</b><strong>${escapeHtml(pipeline.title)}</strong><code>${escapeHtml(pipeline.pipeline_id)} · ${pipeline.path_refs?.length || 0} Rechenwege · ${pipeline.positions?.length || 0} Positionen</code><a href="/statik/katalog?bereich=pipelines&pipeline=${encodeURIComponent(pipeline.pipeline_id)}" target="_blank" rel="noopener">Katalog ↗</a></article>`).join("");
    const template = workspace.calculation_template;
    return `<div class="project-status-band"><article><span>Aktive Pipelines</span><strong>${pipelines.length}</strong><small>aus Projektfakten gewählt</small></article><article><span>Runtime-Gate</span><strong>${workspace.knowledge.statistics?.runtime_gate_passed ? "bestätigt" : "offen"}</strong><small>keine Freigabe</small></article><article><span>Template-Pipelines</span><strong>${template.pipeline_binding?.pipeline_ids?.length || 0}</strong><small>${escapeHtml(template.template_id)}</small></article><article><span>Grafiken</span><strong>${template.visualization_plan?.length || 0}</strong><small>automatisch geplant</small></article><article><span>Änderungen</span><strong>${state.projectOverrides.size}</strong><small>lokale Overrides</small></article></div><div class="pipeline-workflow-grid">${cards || '<div class="dossier-empty"><span>Keine Pipeline ausgewählt.</span></div>'}</div>`;
  }

  function projectOutputMarkup() {
    const template = state.projectWorkspace?.calculation_template;
    if (!template) return '<div class="dossier-empty"><span>Keine Ausgabevorlage gebunden.</span></div>';
    return `<div class="output-tool-grid"><article class="output-tool"><span>Interaktiv</span><strong>HTML-Rechenakte</strong><p>Erzeugt die Projektausgabe aus dem aktuellen Variablenstand und öffnet sie direkt im Statikprogramm.</p><button type="button" data-action="show-output">HTML-Bericht öffnen</button></article><article class="output-tool"><span>Dokument</span><strong>PDF-Projektstatik</strong><p>Rendert denselben Arbeitsstand als PDF. Fachliche Freigabe und Signatur bleiben offen.</p><button type="button" data-action="export-project-pdf">PDF erzeugen</button></article><article class="output-tool"><span>${escapeHtml(template.template_id)}</span><strong>${escapeHtml(template.title)}</strong><p>${template.pipeline_binding?.pipeline_ids?.length || 0} gebundene Pipelines · ${template.visualization_plan?.length || 0} automatische Grafiken.</p><button type="button" data-action="show-template-output">Template anzeigen</button></article></div>`;
  }

  function renderDossier(dossier) {
    if (!dossier) return;
    state.activeDossier = dossier;
    const summary = dossier.summary || {};
    const projectTab = ["project", "pipelines", "output"].includes(state.dossierTab) && state.projectWorkspace;
    byId("dossier-position").textContent = projectTab
      ? state.projectWorkspace.project_case.project_metadata?.name || "Projektstatik"
      : dossier.document_control?.position_label || dossier.document_control?.position_ref || "Position";
    byId("dossier-status").textContent = projectTab
      ? `${state.projectWorkspace.result.summary.position_count} Positionen · ${state.projectWorkspace.knowledge.statistics.pipeline_count} Pipelines · Fachprüfung offen`
      : `${summary.check_count || 0} Nachweise · ${summary.calculation_step_count || dossier.calculation_steps?.length || 0} Rechenschritte · Fachprüfung erforderlich`;
    document.querySelectorAll("[data-dossier-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.dossierTab === state.dossierTab));
    const target = byId("dossier-content");
    const analyses = dossier.analysis_cases || [];
    const governing = Object.entries(analyses[0]?.envelope || {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Kein Feld-/Stabergebnis";
    const views = {
      project: projectOverviewMarkup,
      overview: () => `<div class="dossier-metrics">
        <article class="dossier-metric"><span>Status</span><strong>${escapeHtml(summary.status)}</strong><small>unabhängige Prüfung erforderlich</small></article>
        <article class="dossier-metric"><span>Maßgebende Ausnutzung</span><strong>${Math.round(Number(summary.governing_utilization || 0) * 100)} %</strong><small>${escapeHtml(summary.governing_check?.label || "noch nicht bewertet")}</small></article>
        <article class="dossier-metric"><span>Rechenkern</span><strong>${analyses.length}</strong><small>${escapeHtml(analyses[0]?.theory || "reiner Bauteilnachweis")}</small></article>
        <article class="dossier-metric"><span>Objektprüfung</span><strong>${summary.calculated_topics || 0} / ${(summary.calculated_topics || 0) + (summary.open_topics || 0)}</strong><small>${summary.open_topics || 0} Themen offen</small></article>
      </div><div class="dossier-grid dossier-secondary"><article class="dossier-card"><h3>Ergebnisumhüllende</h3><p>${escapeHtml(governing)}</p>${dossierTable(["Analyse", "GZ", "Solver", "Theorie"], analyses.map((item) => [item.label || item.combination_id, item.limit_state, item.solver, item.theory]))}</article><article class="dossier-card"><h3>Objektspezifische Prüfmatrix</h3>${dossierTable(["Thema", "Status"], (dossier.applicability_matrix || []).map((item) => [item.label, item.status]))}</article></div><div class="dossier-actions"><button type="button" data-action="show-calculation">Rechenweg öffnen</button><button type="button" class="primary" data-action="create-report">PDF-Bericht</button></div>`,
      loads: () => `<div class="dossier-grid"><article class="dossier-card"><h3>Lastfälle und Herkunft</h3>${dossierTable(["LF", "Bezeichnung", "Kategorie", "Wert", "Einheit", "Quelle"], (dossier.load_path?.sources || []).map((item) => [item.load_case_id, item.label, item.category, item.value, item.unit, item.origin]))}</article><article class="dossier-card"><h3>Weiterleitung / Reaktionen</h3>${dossierTable(["Von", "Nach", "Ansatz", "Wert", "Einheit", "Status"], (dossier.load_path?.transfers || []).map((item) => [item.from, item.to, item.rule, item.value, item.unit, item.status]))}</article></div>`,
      combinations: () => dossierTable(["ID", "Bezeichnung", "GZ", "Situation", "Leitend", "Wert", "Einheit"], (dossier.load_combinations || []).map((item) => [item.combination_id, item.label, item.limit_state, item.situation, item.leading_action || "–", item.value, item.unit])),
      checks: () => dossierTable(["Nachweis", "GZ", "Einwirkung ≤ Widerstand", "Ausnutzung", "Status", "Erläuterung"], (dossier.checks || []).map((item) => [item.label, item.limit_state, item.comparison, `${(Number(item.utilization || 0) * 100).toFixed(1)} %`, item.status, item.explanation])),
      calculation: () => `<div class="dossier-step-list">${(dossier.calculation_steps || []).map((step, index) => `<article class="dossier-step"><b>${String(index + 1).padStart(2, "0")}</b><strong>${escapeHtml(step.label)}</strong><code title="${escapeHtml(step.substitutions)}">${escapeHtml(step.formula)} · ${escapeHtml(step.substitutions)}</code><span>${escapeHtml(step.value)} ${escapeHtml(step.unit)}</span></article>`).join("")}</div><div class="dossier-secondary dossier-card"><h3>Aktive Rechenwege aus dem Katalog</h3>${dossierTable(["ID", "Bezeichnung", "Status", "Formeln"], (dossier.calculation_plan?.paths || []).map((path) => [path.path_id, path.title, path.status, (path.formula_refs || []).join(", ") || "–"]))}</div>`,
      pipelines: projectPipelinesMarkup,
      standards: () => `<div class="dossier-grid"><article class="dossier-card"><h3>Normenbasis</h3>${dossierTable(["Regelwerk", "Ausgabe", "Rolle", "Nationaler Anhang"], (dossier.standards || []).map((item) => [item.designation, item.edition, item.role, item.national_annex || "–"]))}</article><article class="dossier-card"><h3>Anwendungsgrenzen</h3>${dossierTable(["Hinweis"], (dossier.limitations || []).map((item) => [item]))}</article></div>`,
      output: projectOutputMarkup,
    };
    target.innerHTML = (views[state.dossierTab] || views.overview)();
  }

  function renderDossierUnavailable(element, message = "Für dieses Bauteil ist noch kein ausführbares Rechenmodell hinterlegt.") {
    state.activeDossier = null;
    byId("dossier-position").textContent = element?.label || "Keine Position";
    byId("dossier-status").textContent = "Modulgrenze transparent ausgewiesen";
    byId("dossier-content").innerHTML = `<div class="dossier-empty"><strong>Noch nicht berechnet</strong><span>${escapeHtml(message)}</span></div>`;
  }

  function selectedElement() {
    return state.model?.elements.find((element) => element.element_ref === state.selectedRef) || null;
  }

  function showToast(title, message, kind = "success") {
    const toast = byId("toast");
    byId("toast-title").textContent = title;
    byId("toast-message").textContent = message;
    toast.querySelector(".toast-icon").textContent = kind === "warning" ? "!" : "✓";
    toast.classList.toggle("is-warning", kind === "warning");
    toast.hidden = false;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 5200);
  }

  function setBusy(isBusy) {
    document.querySelectorAll('[data-action="calculate"], .primary-action').forEach((button) => {
      button.disabled = isBusy || selectedElement()?.kind !== "slab";
      if (button.classList.contains("primary-action")) {
        button.innerHTML = isBusy ? '<span aria-hidden="true">◌</span> Wird geprüft…' : '<span aria-hidden="true">▶</span> Neu berechnen';
      }
    });
  }

  function renderProjectMetadata() {
    byId("revision-label").textContent = state.model.model_revision_ref.split("_").at(-1) || "lokal";
  }

  function renderProjectWorkspaceStatus() {
    const workspace = state.projectWorkspace;
    if (!workspace) return;
    const summary = workspace.result.summary || {};
    const calculationState = byId("project-calculation-state");
    const plausible = summary.status === "passed";
    calculationState.innerHTML = `<i class="status-indicator${plausible ? " is-ok" : ""}"></i> ${plausible ? "Berechnung abgeschlossen" : "Prüfhinweise vorhanden"}`;
    const release = byId("project-release-state");
    release.textContent = workspace.safety.release_gate_passed ? "Freigabe bestätigt" : "Fachprüfung offen";
    release.classList.toggle("is-released", workspace.safety.release_gate_passed);
    byId("automation-message").textContent = `${summary.position_count} Positionen · ${summary.check_count} Nachweise · ${workspace.knowledge.statistics.calculation_path_count} Rechenwege aus dem Projektmodell abgeleitet.`;
    document.querySelectorAll("[data-workflow]").forEach((button) => {
      const id = button.dataset.workflow;
      button.classList.toggle("is-done", ["model", "idealize", "loads"].includes(id));
      button.classList.toggle("is-active", id === "calculate");
    });
  }

  function applyProjectWorkspace(workspace, { resetOverrides = false } = {}) {
    const previousSelection = state.selectedRef;
    state.projectWorkspace = workspace;
    state.projectCaseId = workspace.case_id;
    state.model = workspace.model;
    state.results.clear();
    state.surfaceResults.clear();
    state.engineeringResults.clear();
    state.dossiers.clear();
    app.classList.add("is-project-workspace");
    if (resetOverrides) {
      state.projectOverrides.clear();
      state.projectBaseValues = new Map((workspace.result.editable_variables || []).map((variable) => [variable.path, Number(variable.value)]));
    }
    const picker = byId("project-case-select");
    if (picker) picker.value = workspace.case_id;
    structural3dView?.setModel(state.model);
    renderProjectMetadata();
    renderProjectWorkspaceStatus();
    renderCheckList();
    const fallback = workspace.selection?.default_position_ref || state.model.elements[0]?.element_ref;
    const selected = state.model.elements.some((element) => element.element_ref === previousSelection) ? previousSelection : fallback;
    selectElement(selected, { keepPanels: true });
    if (state.view !== "system") setView(state.view);
  }

  async function loadProjectWorkspace(caseId) {
    const button = document.querySelector(".project-run-button");
    button?.classList.add("is-busy");
    if (button) button.disabled = true;
    byId("project-calculation-state").innerHTML = '<i class="status-indicator"></i> Projekt wird aufgebaut';
    try {
      const workspace = await requestJson(`/project-cases/${encodeURIComponent(caseId)}/workspace`);
      state.dossierTab = "project";
      applyProjectWorkspace(workspace, { resetOverrides: true });
      const locationUrl = new URL(location.href); locationUrl.searchParams.set("projekt", caseId); history.replaceState({}, "", locationUrl);
      showToast("Testprojekt geladen", `${workspace.result.summary.position_count} Positionen wurden berechnet. Die Fachprüfung bleibt offen.`);
    } catch (error) {
      showToast("Projekt konnte nicht geladen werden", error.message, "warning");
      throw error;
    } finally {
      button?.classList.remove("is-busy");
      if (button) button.disabled = false;
    }
  }

  function projectOverridePayload() {
    return [...state.projectOverrides.entries()].map(([path, value]) => ({ path, value }));
  }

  async function runProjectWorkspace() {
    if (!state.projectCaseId) return;
    const buttons = document.querySelectorAll('[data-action="run-project"]');
    buttons.forEach((button) => { button.disabled = true; button.classList.add("is-busy"); });
    byId("project-calculation-state").innerHTML = '<i class="status-indicator"></i> Projekt wird neu berechnet';
    try {
      const workspace = await requestJson(`/project-cases/${encodeURIComponent(state.projectCaseId)}/workspace`, {
        method: "POST",
        body: JSON.stringify({ overrides: projectOverridePayload() }),
      });
      applyProjectWorkspace(workspace);
      showToast("Projektberechnung aktualisiert", `${workspace.result.summary.check_count} Nachweise wurden aus ${workspace.knowledge.statistics.calculation_path_count} Rechenwegen neu aufgebaut.`);
    } catch (error) {
      showToast("Projektberechnung fehlgeschlagen", error.message, "warning");
    } finally {
      buttons.forEach((button) => { button.disabled = false; button.classList.remove("is-busy"); });
    }
  }

  async function resetProjectWorkspace() {
    if (!state.projectCaseId) return;
    state.projectOverrides.clear();
    await loadProjectWorkspace(state.projectCaseId);
  }

  function reviewClass(element) {
    if (element.review?.status === "attention" || Number(element.review?.last_utilization) > 0.85) return "is-attention";
    if (element.review?.status === "unreviewed") return "is-open";
    return "";
  }

  function renderTree(search = "") {
    const target = byId("model-tree");
    target.replaceChildren();
    const normalizedSearch = search.trim().toLocaleLowerCase("de");
    const groups = new Map();
    state.model.elements.forEach((element) => {
      if (normalizedSearch && !`${element.label} ${element.element_ref} ${element.group}`.toLocaleLowerCase("de").includes(normalizedSearch)) return;
      if (!groups.has(element.group)) groups.set(element.group, []);
      groups.get(element.group).push(element);
    });

    groups.forEach((elements, groupName) => {
      const group = document.createElement("section");
      group.className = "tree-group";
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "tree-group-heading";
      heading.innerHTML = `<span class="chevron">▼</span><span>${groupName}</span><span class="tree-count">${elements.length}</span>`;
      heading.addEventListener("click", () => group.classList.toggle("is-collapsed"));
      const items = document.createElement("div");
      items.className = "tree-items";

      elements.forEach((element) => {
        const meta = KIND_META[element.kind] || { short: "?" };
        const item = document.createElement("button");
        item.type = "button";
        item.className = `tree-item${element.element_ref === state.selectedRef ? " is-selected" : ""}`;
        item.dataset.elementRef = element.element_ref;

        const icon = document.createElement("span");
        icon.className = "tree-kind-icon";
        icon.textContent = meta.short;
        const copy = document.createElement("span");
        copy.className = "tree-copy";
        const label = document.createElement("strong");
        label.textContent = element.label;
        const sub = document.createElement("small");
        sub.textContent = element.level_ref.replace("level_", "").toUpperCase();
        copy.append(label, sub);
        const dot = document.createElement("span");
        dot.className = `review-dot ${reviewClass(element)}`.trim();
        item.append(icon, copy, dot);
        item.addEventListener("click", () => selectElement(element.element_ref));
        items.append(item);
      });
      group.append(heading, items);
      target.append(group);
    });
  }

  function renderCheckList() {
    const target = byId("check-list");
    target.replaceChildren();
    const attention = state.model.elements.filter((element) => reviewClass(element) === "is-attention");
    byId("attention-count").textContent = String(attention.length);
    attention.forEach((element) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "check-item";
      const dot = document.createElement("i");
      const copy = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = element.label;
      const note = document.createElement("small");
      note.textContent = "Fachliche Prüfung empfohlen";
      copy.append(label, note);
      const percent = document.createElement("span");
      percent.textContent = `${Math.round(Number(element.review.last_utilization || 0) * 100)}%`;
      item.append(dot, copy, percent);
      item.addEventListener("click", () => {
        selectElement(element.element_ref);
        activateNavigatorTab("model");
      });
      target.append(item);
    });
  }

  function formControl(name) {
    return form.elements.namedItem(name);
  }

  function normalizedAssumptions(element) {
    const p = element.parameters || {};
    return {
      span_m: p.span_m ?? p.length_m ?? p.height_m ?? 4.0,
      width_m: p.width_m ?? 1.0,
      thickness_cm: p.thickness_cm ?? p.height_cm ?? p.depth_cm ?? 20,
      support_condition: p.support_condition ?? "continuous",
      superimposed_dead_load_kn_m2: p.superimposed_dead_load_kn_m2 ?? 1.5,
      variable_load_kn_m2: p.variable_load_kn_m2 ?? 2.0,
      concrete_class: p.concrete_class ?? "C25/30",
      reinforcement_class: p.reinforcement_class ?? "B500B",
      cover_mm: p.cover_mm ?? 30,
      provided_reinforcement_mm2_m: p.provided_reinforcement_mm2_m ?? 754,
    };
  }

  function fillForm(element) {
    const values = normalizedAssumptions(element);
    Object.entries(values).forEach(([name, value]) => {
      const control = formControl(name);
      if (control) control.value = String(value);
    });
    const supported = element.kind === "slab";
    Array.from(form.elements).forEach((control) => {
      if (control.matches("input, select")) control.disabled = !supported;
    });
    const primary = form.querySelector(".primary-action");
    primary.disabled = !supported;
    primary.innerHTML = supported
      ? '<span aria-hidden="true">▶</span> Neu berechnen'
      : '<span aria-hidden="true">◇</span> Modul vorbereitet';
    form.classList.toggle("is-unsupported", !supported);

    const explainer = document.querySelector(".guided-explainer p");
    explainer.innerHTML = supported
      ? "<strong>Das ist bereits vorbereitet.</strong> Prüfe nur die hervorgehobenen Werte. Details bleiben jederzeit einsehbar."
      : `<strong>${KIND_META[element.kind]?.label || "Bauteil"}-Modul vorbereitet.</strong> In diesem ersten Fundament ist die interaktive Konzeptprüfung für Stahlbetondecken aktiv.`;
  }

  function updateProjectEditCount() {
    const counter = byId("project-edit-count");
    if (!counter) return;
    counter.textContent = `${state.projectOverrides.size} ${state.projectOverrides.size === 1 ? "Änderung" : "Änderungen"}`;
    counter.classList.toggle("is-dirty", state.projectOverrides.size > 0);
  }

  function renderProjectVariables() {
    const target = byId("project-variable-groups");
    if (!target || !state.projectWorkspace) return;
    const search = state.variableSearch.trim().toLocaleLowerCase("de");
    const selectedRef = state.selectedRef;
    const variables = (state.projectWorkspace.result.editable_variables || []).filter((variable) => {
      const scopeMatches = state.variableScope === "environment"
        ? variable.scope === "environment"
        : variable.scope === "position" && variable.scope_ref === selectedRef;
      if (!scopeMatches) return false;
      return !search || `${variable.label} ${variable.unit} ${variable.path} ${variable.group}`.toLocaleLowerCase("de").includes(search);
    });
    const groups = new Map();
    variables.forEach((variable) => {
      if (!groups.has(variable.group)) groups.set(variable.group, []);
      groups.get(variable.group).push(variable);
    });
    target.replaceChildren();
    if (!groups.size) {
      target.innerHTML = '<div class="variable-empty">Für diesen Bereich wurden keine passenden numerischen Eingaben gefunden.</div>';
      updateProjectEditCount();
      return;
    }
    groups.forEach((items, groupName) => {
      const group = document.createElement("section");
      group.className = "variable-group";
      const header = document.createElement("header");
      const title = document.createElement("strong"); title.textContent = groupName;
      const count = document.createElement("span"); count.textContent = `${items.length} Werte`;
      header.append(title, count);
      const fields = document.createElement("div"); fields.className = "variable-fields";
      items.forEach((variable) => {
        const field = document.createElement("label");
        field.className = `variable-field${state.projectOverrides.has(variable.path) ? " is-dirty" : ""}`;
        const label = document.createElement("span"); label.textContent = variable.label;
        const wrap = document.createElement("span"); wrap.className = "input-with-unit";
        const input = document.createElement("input");
        input.type = "number"; input.step = "any"; input.value = String(state.projectOverrides.get(variable.path) ?? variable.value);
        input.dataset.variablePath = variable.path;
        input.setAttribute("aria-label", `${variable.label} ${variable.unit}`);
        const unit = document.createElement("i"); unit.textContent = variable.unit || "–";
        const path = document.createElement("small"); path.className = "variable-path"; path.textContent = variable.path; path.title = variable.path;
        wrap.append(input, unit); field.append(label, wrap, path); fields.append(field);
      });
      group.append(header, fields); target.append(group);
    });
    updateProjectEditCount();
  }

  function handleProjectVariableInput(input) {
    const path = input.dataset.variablePath;
    if (!path) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    const original = state.projectBaseValues.get(path);
    if (original != null && Math.abs(Number(original) - value) < 1e-12) state.projectOverrides.delete(path);
    else state.projectOverrides.set(path, value);
    input.closest(".variable-field")?.classList.toggle("is-dirty", state.projectOverrides.has(path));
    updateProjectEditCount();
    byId("automation-message").textContent = "Lokale Projektparameter geändert · Neuberechnung erforderlich.";
    byId("project-calculation-state").innerHTML = '<i class="status-indicator"></i> Änderungen nicht berechnet';
  }

  function renderProjectPositionResult(position) {
    const result = position?.result;
    if (!result) return renderResultPlaceholder();
    const summary = result.summary || {};
    const governing = summary.governing_check || {};
    const utilization = Number(governing.utilization || 0);
    const dash = Math.min(Math.max(utilization, 0), 1) * 113.1;
    const ring = byId("result-ring");
    ring.className = `result-ring${summary.status === "attention" ? " is-attention" : summary.status === "not_adequate" ? " is-failed" : ""}`;
    byId("ring-value").setAttribute("stroke-dasharray", `${dash.toFixed(1)} 113.1`);
    byId("result-percent").textContent = governing.utilization == null ? "–" : `${Math.round(utilization * 100)}%`;
    byId("result-kicker").textContent = summary.status === "passed" ? "Rechnerisch plausibel · nicht freigegeben" : "Fachliche Prüfung erforderlich";
    byId("result-title").textContent = governing.label ? `${governing.label} ist maßgebend` : "Keine numerische Ausnutzung verfügbar";
    byId("result-message").textContent = governing.explanation || "Pipeline, Rechenwege und Grenzen sind in der Rechenakte dokumentiert.";
    const cards = byId("check-cards"); cards.replaceChildren();
    const checks = result.design?.checks || [];
    (checks.length ? checks : [{ label: "Nachweisstatus", status: "not_assessed", utilization: null, explanation: "Kein Bauteilnachweis in diesem Modul." }]).slice(0, 5).forEach((check) => {
      const card = document.createElement("article");
      card.className = `check-card${check.status === "attention" ? " is-attention" : check.status === "not_adequate" ? " is-failed" : check.utilization == null ? " is-placeholder" : ""}`;
      card.innerHTML = `<span>${escapeHtml(check.label)}</span><strong>${check.utilization == null ? "–" : `${Math.round(Number(check.utilization) * 100)}%`}</strong><small>${escapeHtml(check.explanation || check.status)}</small>`;
      cards.append(card);
    });
    const steps = byId("calculation-steps"); steps.replaceChildren();
    (result.calculation_steps || []).forEach((step, index) => {
      const item = document.createElement("article"); item.className = "calculation-step";
      item.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(step.label)}</strong><code>${escapeHtml(step.formula)}</code></div><span>${escapeHtml(step.value)} ${escapeHtml(step.unit)}</span>`;
      steps.append(item);
    });
    byId("analysis-reference").textContent = result.analysis_ref || "Projektarbeitsstand";
    document.querySelector('[data-action="show-calculation"]').disabled = !(result.calculation_steps || []).length;
  }

  function setInspector(element) {
    const meta = KIND_META[element.kind] || { label: element.kind, symbol: "" };
    byId("element-kind").textContent = meta.label;
    byId("element-label").textContent = element.label;
    byId("element-id").textContent = element.element_ref;
    const symbol = byId("element-symbol");
    symbol.className = `element-symbol ${meta.symbol}`;
    const review = byId("review-badge");
    review.className = `review-badge${reviewClass(element) ? "" : " is-ok"}`;
    review.textContent = reviewClass(element) === "is-attention" ? "Hinweis" : reviewClass(element) === "is-open" ? "offen" : "zu prüfen";
    const level = state.model.levels.find((entry) => entry.level_ref === element.level_ref);
    byId("stage-level").textContent = level?.label || element.level_ref;
    byId("stage-selection").textContent = element.label;
    if (state.projectWorkspace) {
      byId("project-variable-editor").hidden = false;
      renderProjectVariables();
    } else {
      byId("project-variable-editor").hidden = true;
      fillForm(element);
    }
  }

  function resetResultForUnsupported(element) {
    const ring = byId("result-ring");
    ring.className = "result-ring is-empty";
    byId("ring-value").setAttribute("stroke-dasharray", "0 113.1");
    byId("result-percent").textContent = "–";
    byId("result-kicker").textContent = `${KIND_META[element.kind]?.label || "Bauteil"}-Modul`;
    byId("result-title").textContent = "Schnittstelle und Prüfworkflow sind vorbereitet";
    byId("result-message").textContent = "Das Rechenmodul wird in einer nächsten Ausbaustufe ergänzt.";
    byId("check-cards").innerHTML = ["Tragfähigkeit", "Stabilität", "Gebrauch"].map((label) => `<article class="check-card is-placeholder"><span>${label}</span><strong>–</strong><small>Modul vorbereitet</small></article>`).join("");
    document.querySelector('[data-action="show-calculation"]').disabled = true;
  }

  function selectElement(elementRef, options = {}) {
    const element = state.model.elements.find((entry) => entry.element_ref === elementRef);
    if (!element) return;
    state.selectedRef = elementRef;
    state.dirty = false;
    byId("change-panel").hidden = true;
    renderTree();
    setInspector(element);
    renderCanvas();
    structural3dView?.setSelected(elementRef);
    const projectPosition = currentProjectPosition(elementRef);
    const existing = state.results.get(elementRef);
    if (projectPosition) renderProjectPositionResult(projectPosition);
    else if (existing) renderResult(existing);
    else if (element.kind !== "slab") resetResultForUnsupported(element);
    else renderResultPlaceholder();
    if (state.view === "loads") runSurfaceSimulation();
    if (projectPosition?.dossier) renderDossier(projectPosition.dossier);
    else loadEngineeringDossier(element);
    if (!options.keepPanels && window.innerWidth <= 860) closePanels();
  }

  function addSvgDefinitions() {
    const defs = svgElement("defs");
    const minor = svgElement("pattern", { id: "minor-grid", width: 14, height: 14, patternUnits: "userSpaceOnUse" });
    minor.append(svgElement("path", { d: "M 14 0 L 0 0 0 14", class: "drawing-grid-minor" }));
    const major = svgElement("pattern", { id: "major-grid", width: 70, height: 70, patternUnits: "userSpaceOnUse" });
    major.append(svgElement("rect", { width: 70, height: 70, fill: "url(#minor-grid)" }), svgElement("path", { d: "M 70 0 L 0 0 0 70", class: "drawing-grid-major" }));

    const loadMarker = svgElement("marker", { id: "load-arrow", markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: "auto", markerUnits: "strokeWidth" });
    loadMarker.append(svgElement("path", { d: "M0,0 L0,6 L7,3 z", fill: "#c55249" }));
    const pathMarker = svgElement("marker", { id: "path-arrow", markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: "auto", markerUnits: "strokeWidth" });
    pathMarker.append(svgElement("path", { d: "M0,0 L0,6 L7,3 z", fill: "#d4883b" }));
    const dimMarker = svgElement("marker", { id: "dimension-arrow", markerWidth: 8, markerHeight: 8, refX: 4, refY: 3, orient: "auto-start-reverse", markerUnits: "strokeWidth" });
    dimMarker.append(svgElement("path", { d: "M0,3 L7,0 L7,6 z", fill: "#778796" }));
    defs.append(minor, major, loadMarker, pathMarker, dimMarker);
    canvas.append(defs);
  }

  function polygonPoints(points) {
    return points.map((point) => point.join(",")).join(" ");
  }

  function elementCenter(element) {
    const geometry = element.geometry;
    if (geometry.type === "polygon") {
      const sums = geometry.points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
      return [sums[0] / geometry.points.length, sums[1] / geometry.points.length];
    }
    if (geometry.type === "line") return [(geometry.start[0] + geometry.end[0]) / 2, (geometry.start[1] + geometry.end[1]) / 2];
    return geometry.point || [0, 0];
  }

  function createModelElement(element) {
    const geometry = element.geometry;
    let node;
    if (geometry.type === "polygon") {
      node = svgElement("polygon", { points: polygonPoints(geometry.points), class: `model-element model-${element.kind}` });
    } else if (geometry.type === "line") {
      node = svgElement("line", {
        x1: geometry.start[0], y1: geometry.start[1], x2: geometry.end[0], y2: geometry.end[1],
        "stroke-width": geometry.width || 12,
        class: `model-element model-${element.kind}`,
      });
    } else {
      const size = Number(geometry.size || 20);
      node = svgElement("rect", {
        x: geometry.point[0] - size / 2, y: geometry.point[1] - size / 2,
        width: size, height: size,
        class: `model-element model-${element.kind}`,
      });
    }
    node.dataset.elementRef = element.element_ref;
    if (element.element_ref === state.selectedRef) node.classList.add("is-selected");
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", element.label);
    node.addEventListener("click", (event) => { event.stopPropagation(); selectElement(element.element_ref); });
    node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") selectElement(element.element_ref); });
    return node;
  }

  function drawAxes() {
    const axisXs = [[120, "A"], [470, "B"], [790, "C"]];
    const axisYs = [[120, "1"], [400, "2"]];
    axisXs.forEach(([x, label]) => {
      canvas.append(svgElement("line", { x1: x, y1: 88, x2: x, y2: 438, class: "axis-line" }));
      canvas.append(svgElement("circle", { cx: x, cy: 82, r: 10, class: "axis-bubble" }));
      canvas.append(svgElement("text", { x, y: 82, class: "axis-label" }, label));
    });
    axisYs.forEach(([y, label]) => {
      canvas.append(svgElement("line", { x1: 82, y1: y, x2: 827, y2: y, class: "axis-line" }));
      canvas.append(svgElement("circle", { cx: 76, cy: y, r: 10, class: "axis-bubble" }));
      canvas.append(svgElement("text", { x: 76, y, class: "axis-label" }, label));
    });
  }

  function drawDimensions() {
    canvas.append(svgElement("line", { x1: 120, y1: 452, x2: 470, y2: 452, class: "dimension-line" }));
    canvas.append(svgElement("text", { x: 295, y: 468, class: "dimension-text" }, "5,20 m"));
    canvas.append(svgElement("line", { x1: 470, y1: 452, x2: 790, y2: 452, class: "dimension-line" }));
    canvas.append(svgElement("text", { x: 630, y: 468, class: "dimension-text" }, "4,80 m"));
    canvas.append(svgElement("line", { x1: 838, y1: 120, x2: 838, y2: 400, class: "dimension-line" }));
    canvas.append(svgElement("text", { x: 858, y: 264, class: "dimension-text", transform: "rotate(90 858 264)" }, "4,20 m"));
  }

  function drawLoadOverlay() {
    state.model.elements.filter((element) => element.kind === "slab").forEach((element) => {
      const [cx, cy] = elementCenter(element);
      [-90, -45, 0, 45, 90].forEach((offset) => {
        canvas.append(svgElement("line", { x1: cx + offset, y1: cy - 72, x2: cx + offset, y2: cy - 23, class: "load-arrow" }));
      });
      canvas.append(svgElement("text", { x: cx, y: cy - 82, class: "load-label" }, "gₖ + qₖ"));
      canvas.append(svgElement("path", { d: `M ${cx} ${cy} C ${cx} ${cy + 40}, 470 ${cy + 15}, 470 395`, class: "load-path" }));
    });
  }

  function drawResultOverlay() {
    state.model.elements.filter((element) => element.kind === "slab").forEach((element) => {
      const result = state.results.get(element.element_ref);
      const utilization = Number(result?.summary?.governing_utilization ?? element.review?.last_utilization ?? 0);
      const statusClass = utilization > .85 ? "is-attention" : utilization > 0 ? "is-ok" : "is-open";
      canvas.append(svgElement("polygon", { points: polygonPoints(element.geometry.points), class: `capacity-overlay ${statusClass}` }));
      const [cx, cy] = elementCenter(element);
      canvas.append(svgElement("text", { x: cx, y: cy + 5, class: "element-label-svg" }, utilization ? `${Math.round(utilization * 100)} %` : "offen"));
    });
  }

  function renderCanvas() {
    canvas.replaceChildren();
    canvas.setAttribute("viewBox", `${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.width} ${state.viewBox.height}`);
    addSvgDefinitions();
    canvas.append(svgElement("rect", { x: 48, y: 52, width: 830, height: 444, rx: 3, class: "drawing-sheet" }));
    canvas.append(svgElement("rect", { x: 54, y: 58, width: 818, height: 432, fill: "url(#major-grid)" }));
    drawAxes();
    if (state.view === "results") drawResultOverlay();

    const order = { foundation: 0, slab: 1, wall: 2, beam: 3, column: 4 };
    [...state.model.elements].sort((a, b) => order[a.kind] - order[b.kind]).forEach((element) => canvas.append(createModelElement(element)));

    state.model.elements.filter((element) => element.kind === "slab").forEach((element) => {
      const [cx, cy] = elementCenter(element);
      canvas.append(svgElement("text", { x: cx, y: cy - 3, class: "element-label-svg" }, element.label.replace("Decke EG · ", "")));
      canvas.append(svgElement("text", { x: cx, y: cy + 13, class: "element-sublabel-svg" }, `h = ${element.parameters.thickness_cm} cm`));
    });
    if (state.view === "loads") drawLoadOverlay();
    drawDimensions();
  }

  function currentAssumptions() {
    const numeric = ["span_m", "width_m", "thickness_cm", "superimposed_dead_load_kn_m2", "variable_load_kn_m2", "cover_mm", "provided_reinforcement_mm2_m"];
    const assumptions = {};
    numeric.forEach((name) => { assumptions[name] = Number(formControl(name).value); });
    assumptions.support_condition = formControl("support_condition").value;
    assumptions.concrete_class = formControl("concrete_class").value;
    assumptions.reinforcement_class = formControl("reinforcement_class").value;
    return assumptions;
  }

  function renderResultPlaceholder() {
    const ring = byId("result-ring");
    ring.className = "result-ring is-empty";
    byId("ring-value").setAttribute("stroke-dasharray", "0 113.1");
    byId("result-percent").textContent = "–";
    byId("result-kicker").textContent = "Bereit zur Konzeptprüfung";
    byId("result-title").textContent = "Automatik kann die Vorbemessung starten";
    byId("result-message").textContent = "Alle Eingaben bleiben sichtbar und können fachlich angepasst werden.";
    document.querySelector('[data-action="show-calculation"]').disabled = true;
  }

  function renderResult(result) {
    const utilization = Number(result.summary.governing_utilization || 0);
    const percentage = Math.round(utilization * 100);
    const dash = Math.min(utilization, 1) * 113.1;
    const ring = byId("result-ring");
    ring.className = `result-ring${result.summary.status === "attention" ? " is-attention" : result.summary.status === "not_adequate" ? " is-failed" : ""}`;
    byId("ring-value").setAttribute("stroke-dasharray", `${dash.toFixed(1)} 113.1`);
    byId("result-percent").textContent = `${percentage}%`;
    byId("result-kicker").textContent = result.summary.status === "passed" ? "Konzeptprüfung plausibel" : "Fachliche Prüfung erforderlich";
    byId("result-title").textContent = `${result.summary.governing_label} ist maßgebend`;
    byId("result-message").textContent = `${result.recommendation.message} Vorschlag: h = ${result.recommendation.thickness_cm} cm, Aₛ = ${result.recommendation.reinforcement_mm2_m} mm²/m.`;

    const cards = byId("check-cards");
    cards.replaceChildren();
    result.checks.forEach((check) => {
      const card = document.createElement("article");
      card.className = `check-card${check.status === "attention" ? " is-attention" : check.status === "not_adequate" ? " is-failed" : ""}`;
      const label = document.createElement("span");
      label.textContent = check.label;
      const value = document.createElement("strong");
      value.textContent = `${Math.round(Number(check.utilization) * 100)}%`;
      const detail = document.createElement("small");
      detail.textContent = `${check.design_value} / ${check.resistance_value} ${check.unit}`;
      card.append(label, value, detail);
      cards.append(card);
    });

    const steps = byId("calculation-steps");
    steps.replaceChildren();
    result.calculation_steps.forEach((step, index) => {
      const item = document.createElement("article");
      item.className = "calculation-step";
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = step.label;
      const formula = document.createElement("code");
      formula.textContent = step.formula;
      copy.append(label, formula);
      const value = document.createElement("span");
      value.textContent = `${step.value} ${step.unit}`;
      item.append(number, copy, value);
      steps.append(item);
    });
    byId("analysis-reference").textContent = result.analysis_ref;
    document.querySelector('[data-action="show-calculation"]').disabled = false;
    const review = byId("review-badge");
    review.textContent = result.summary.status === "passed" ? "plausibel" : "Hinweis";
    review.className = `review-badge${result.summary.status === "passed" ? " is-ok" : ""}`;
  }

  async function runAnalysis({ silent = false } = {}) {
    if (state.projectWorkspace) {
      await runProjectWorkspace();
      return;
    }
    const element = selectedElement();
    if (!element || element.kind !== "slab") {
      showToast("Modul vorbereitet", "Die interaktive Konzeptprüfung ist im ersten Fundament für Stahlbetondecken aktiv.", "warning");
      return;
    }
    setBusy(true);
    try {
      const result = await requestJson("/analysis-preview", {
        method: "POST",
        body: JSON.stringify({
          contract_version: "structural-analysis-request/0.1",
          project_ref: state.model.project_ref,
          element_ref: element.element_ref,
          model_revision_ref: state.model.model_revision_ref,
          assumptions: currentAssumptions(),
        }),
      });
      state.results.set(element.element_ref, result);
      state.dirty = false;
      byId("change-panel").hidden = true;
      renderResult(result);
      renderCanvas();
      await loadEngineeringDossier(element, { force: true });
      if (!silent) showToast("Konzeptprüfung aktualisiert", `${result.summary.governing_label}: ${Math.round(result.summary.governing_utilization * 100)} % Ausnutzung.`);
    } catch (error) {
      showToast("Prüfung nicht möglich", error.message, "warning");
    } finally {
      setBusy(false);
    }
  }

  function markDirty() {
    if (selectedElement()?.kind !== "slab") return;
    state.dirty = true;
    byId("change-panel").hidden = false;
    byId("automation-message").textContent = "Manuelle Annahme geändert · Neuberechnung erforderlich.";
  }

  async function stageCommand() {
    const element = selectedElement();
    if (!element || !state.dirty) return;
    try {
      const receipt = await requestJson("/commands", {
        method: "POST",
        body: JSON.stringify({
          contract_version: "structural-command/0.1",
          command: "update_element_parameters",
          project_ref: state.model.project_ref,
          element_ref: element.element_ref,
          base_revision_ref: state.model.model_revision_ref,
          client_command_id: `ui_${Date.now()}`,
          parameters: currentAssumptions(),
        }),
      });
      showToast("Änderung lokal vorgemerkt", receipt.message, "warning");
      byId("change-panel").querySelector("strong").textContent = "Entwurf vorgemerkt";
    } catch (error) {
      showToast("Änderung ungültig", error.message, "warning");
    }
  }

  async function createReport() {
    if (state.projectWorkspace) {
      await showProjectOutput("report");
      return;
    }
    const element = selectedElement();
    const job = element ? buildElementJob(element) : null;
    if (!job) {
      showToast("Bericht nicht erstellt", "Für dieses Bauteil ist noch kein ausführbares Rechenmodell vorhanden.", "warning");
      return;
    }
    try {
      const response = await fetch(`${apiBase}/analysis-jobs/report`, {
        method: "POST",
        headers: { Accept: "application/pdf", "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "pdf",
          job,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${element.element_ref}-statikbericht.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      showToast("Bericht erstellt", "Der nachvollziehbare PDF-Rechenbericht wurde erzeugt.");
    } catch (error) {
      showToast("Bericht nicht erstellt", error.message, "warning");
    }
  }

  function setOutputView(view) {
    document.querySelectorAll("[data-output-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.outputView === view));
  }

  async function showProjectOutput(view = "report") {
    const workspace = state.projectWorkspace;
    if (!workspace) {
      showToast("Keine Projektausgabe", "Bitte zuerst ein Testprojekt laden.", "warning");
      return;
    }
    const dialog = byId("project-output-dialog");
    const frame = byId("project-output-frame");
    byId("output-dialog-title").textContent = workspace.project_case.project_metadata?.name || workspace.calculation_template.title;
    byId("output-dialog-state").textContent = `${workspace.calculation_template.title} · Fachprüfung und Freigabe offen`;
    if (!dialog.open) dialog.showModal();
    setOutputView(view);
    if (view === "template") {
      if (state.outputBlobUrl) URL.revokeObjectURL(state.outputBlobUrl);
      state.outputBlobUrl = null;
      frame.src = workspace.outputs.template;
      return;
    }
    byId("output-loading").hidden = false;
    try {
      const response = await fetch(workspace.outputs.report_api, {
        method: "POST",
        headers: { Accept: "text/html", "Content-Type": "application/json" },
        body: JSON.stringify({ format: "html", overrides: projectOverridePayload() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `HTTP ${response.status}`);
      }
      let markup = await response.text();
      markup = markup.replace("<head>", `<head><base href="${location.origin}/">`);
      if (state.outputBlobUrl) URL.revokeObjectURL(state.outputBlobUrl);
      state.outputBlobUrl = URL.createObjectURL(new Blob([markup], { type: "text/html" }));
      frame.src = state.outputBlobUrl;
    } catch (error) {
      showToast("Ausgabe konnte nicht erzeugt werden", error.message, "warning");
    } finally {
      byId("output-loading").hidden = true;
    }
  }

  async function exportProjectPdf() {
    const workspace = state.projectWorkspace;
    if (!workspace) return;
    byId("output-loading").hidden = false;
    try {
      const response = await fetch(workspace.outputs.report_api, {
        method: "POST",
        headers: { Accept: "application/pdf", "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf", overrides: projectOverridePayload() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `HTTP ${response.status}`);
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${state.projectCaseId}-projektstatik.pdf`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      showToast("PDF erzeugt", "Der aktuelle Projektarbeitsstand wurde als PDF ausgegeben. Die fachliche Freigabe bleibt offen.");
    } catch (error) {
      showToast("PDF konnte nicht erzeugt werden", error.message, "warning");
    } finally {
      byId("output-loading").hidden = true;
    }
  }

  function closeProjectOutput() {
    byId("project-output-dialog")?.close();
    if (state.outputBlobUrl) URL.revokeObjectURL(state.outputBlobUrl);
    state.outputBlobUrl = null;
    byId("project-output-frame").src = "about:blank";
  }

  function resetAutomaticValues() {
    const element = selectedElement();
    if (!element) return;
    fillForm(element);
    state.dirty = false;
    byId("change-panel").hidden = true;
    byId("automation-message").textContent = "Spannweite, Auflager und Lastfläche wurden automatisch vorbelegt.";
    if (element.kind === "slab") runAnalysis();
  }

  function activateNavigatorTab(tab) {
    document.querySelectorAll("[data-nav-tab]").forEach((button) => {
      const active = button.dataset.navTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    byId("model-tree").hidden = tab !== "model";
    byId("check-list").hidden = tab !== "checks";
  }

  function buildSurfaceJob(element) {
    const parameters = element.element_ref === state.selectedRef ? currentAssumptions() : normalizedAssumptions(element);
    const thicknessM = Number(parameters.thickness_cm) / 100;
    const permanent = thicknessM * 25 + Number(parameters.superimposed_dead_load_kn_m2 || 0);
    const variable = Number(parameters.variable_load_kn_m2 || 0);
    const elasticModulus = { "C20/25": 30000, "C25/30": 31000, "C30/37": 33000, "C35/45": 34000, "C40/50": 35000, "C50/60": 37000 }[parameters.concrete_class] || 31000;
    return {
      contract_version: "structural-analysis-job/0.2",
      project_ref: state.model.project_ref,
      model_revision_ref: state.model.model_revision_ref,
      job_ref: `surface_${element.element_ref}`,
      element_ref: element.element_ref,
      element_label: element.label,
      project_metadata: state.model.project,
      structure_type: state.model.project.type || "generic",
      material_kind: "reinforced_concrete",
      standards_profile: "DE_EC_2021",
      load_cases: [
        { load_case_id: "G", label: "Eigengewicht und Ausbau", category: "permanent", value: permanent, unit: "kN/m²", action_type: "self_weight" },
        { load_case_id: "Q", label: "Nutzlast", category: "variable", value: variable, unit: "kN/m²", action_type: "imposed" },
      ],
      analysis_model: {
        kind: "surface_plate",
        length_x_m: Number(parameters.span_m),
        length_y_m: Number(parameters.width_m),
        thickness_m: thicknessM,
        elastic_modulus_mpa: elasticModulus,
        poisson_ratio: 0.2,
        load_case_values_kn_m2: { G: permanent, Q: variable },
        series_terms: 17,
        grid_size: 25,
      },
      design: {
        type: "reinforced_concrete",
        parameters: {
          concrete_class: parameters.concrete_class,
          reinforcement_class: parameters.reinforcement_class,
          width_mm: 1000,
          height_mm: Number(parameters.thickness_cm) * 10,
          cover_mm: Number(parameters.cover_mm),
          bar_diameter_mm: 10,
          provided_reinforcement_mm2: Number(parameters.provided_reinforcement_mm2_m),
        },
      },
    };
  }

  function buildElementJob(element) {
    const projectPosition = currentProjectPosition(element.element_ref);
    if (projectPosition?.job) return JSON.parse(JSON.stringify(projectPosition.job));
    if (element.kind === "slab") return buildSurfaceJob(element);
    const parameters = element.parameters || {};
    const common = {
      contract_version: "structural-analysis-job/0.2",
      project_ref: state.model.project_ref,
      model_revision_ref: state.model.model_revision_ref,
      job_ref: `position_${element.element_ref}`,
      element_ref: element.element_ref,
      element_label: element.label,
      project_metadata: state.model.project,
      structure_type: state.model.project.type || "generic",
      standards_profile: "DE_EC_2021",
    };
    if (element.kind === "beam" && parameters.permanent_load_kn_m != null && parameters.variable_load_kn_m != null) {
      const widthM = Number(parameters.width_cm) / 100;
      const heightM = Number(parameters.height_cm) / 100;
      const permanent = Number(parameters.permanent_load_kn_m);
      const variable = Number(parameters.variable_load_kn_m);
      return { ...common, material_kind: "reinforced_concrete", load_cases: [
        { load_case_id: "G", label: "Ständige Linienlast", category: "permanent", value: permanent, unit: "kN/m", action_type: "self_weight" },
        { load_case_id: "Q", label: "Veränderliche Linienlast", category: "variable", value: variable, unit: "kN/m", action_type: "imposed" },
      ], analysis_model: { kind: "beam_line", spans: [{ span_id: element.element_ref, length_m: Number(parameters.span_m), elastic_modulus_mpa: Number(parameters.elastic_modulus_mpa || 33000), inertia_m4: widthM * heightM ** 3 / 12, load_case_values_kn_m: { G: permanent, Q: variable } }], supports: [{ vertical: true }, { vertical: true }], samples_per_span: 61 }, design: { type: "reinforced_concrete", parameters: { concrete_class: parameters.concrete_class || "C30/37", reinforcement_class: "B500B", width_mm: widthM * 1000, height_mm: heightM * 1000, cover_mm: Number(parameters.cover_mm || 35), bar_diameter_mm: Number(parameters.bar_diameter_mm || 16), provided_reinforcement_mm2: Number(parameters.provided_reinforcement_mm2 || 1608) } } };
    }
    if (element.kind === "wall" && parameters.material === "masonry" && parameters.design_axial_kn != null) {
      return { ...common, material_kind: "masonry", load_cases: [{ load_case_id: "NEd", label: "Bemessungsnormalkraft", category: "permanent", value: Number(parameters.design_axial_kn), unit: "kN", action_type: "self_weight" }], analysis_model: { kind: "member_check" }, design: { type: "masonry", parameters: { masonry_grade: parameters.masonry_grade || "MZ12_NMIIA", length_m: Number(parameters.length_m), thickness_m: Number(parameters.thickness_cm) / 100, height_m: Number(parameters.height_m), design_axial_kn: Number(parameters.design_axial_kn), design_moment_knm: Number(parameters.design_moment_knm || 0) } } };
    }
    if (element.kind === "foundation" && parameters.design_axial_kn != null) {
      return { ...common, material_kind: "soil", load_cases: [{ load_case_id: "GQ", label: "Stützen- und Momentenlast", category: "permanent", value: Number(parameters.design_axial_kn), unit: "kN", action_type: "self_weight" }], analysis_model: { kind: "member_check" }, design: { type: "foundation", parameters: { width_m: Number(parameters.width_m), length_m: Number(parameters.length_m), design_axial_kn: Number(parameters.design_axial_kn), design_moment_x_knm: Number(parameters.design_moment_x_knm || 0), design_moment_y_knm: Number(parameters.design_moment_y_knm || 0), design_horizontal_kn: Number(parameters.design_horizontal_kn || 0), base_friction_coefficient: Number(parameters.base_friction_coefficient || .45), design_soil_resistance_kn_m2: Number(parameters.soil_pressure_kn_m2) } } };
    }
    return null;
  }

  async function loadEngineeringDossier(element, { force = false } = {}) {
    const job = buildElementJob(element);
    if (!job) {
      renderDossierUnavailable(element);
      return;
    }
    const fingerprint = JSON.stringify(job);
    if (!force && state.dossiers.has(fingerprint)) {
      renderDossier(state.dossiers.get(fingerprint));
      return;
    }
    byId("dossier-position").textContent = element.label;
    byId("dossier-status").textContent = "Rechenakte wird aktualisiert …";
    try {
      const payload = await requestJson("/analysis-jobs/dossier", { method: "POST", body: JSON.stringify({ job }) });
      state.engineeringResults.set(fingerprint, payload.result);
      state.dossiers.set(fingerprint, payload.dossier);
      if (selectedElement()?.element_ref === element.element_ref) renderDossier(payload.dossier);
    } catch (error) {
      if (selectedElement()?.element_ref === element.element_ref) renderDossierUnavailable(element, error.message);
    }
  }

  async function runSurfaceSimulation() {
    const element = selectedElement();
    if (!surfaceResultView) return;
    if (!element || element.kind !== "slab") {
      surfaceResultView.setMessage("Flächensimulation für eine Decke auswählen");
      byId("viewer-mode-description").textContent = "Das gewählte Bauteil besitzt noch kein Flächenmodell";
      return;
    }
    const projectPosition = currentProjectPosition(element.element_ref);
    if (projectPosition) {
      const analyses = projectPosition.result?.analysis?.analyses || [];
      const surface = analyses.find((item) => item.combination?.limit_state === "ULS")?.result || analyses[0]?.result;
      if (surface?.grid) {
        surfaceResultView.render(surface);
        byId("viewer-mode-description").textContent = `${surface.grid.nx} × ${surface.grid.ny} Punkte · ${surface.theory || projectPosition.result.analysis.kind}`;
      } else {
        surfaceResultView.setMessage("Für diese Position liegt kein flächiges Ergebnisraster vor");
      }
      return;
    }
    const job = buildSurfaceJob(element);
    const fingerprint = JSON.stringify(job);
    if (state.surfaceResults.has(fingerprint)) {
      surfaceResultView.render(state.surfaceResults.get(fingerprint));
      return;
    }
    surfaceResultView.setMessage("Flächenraster wird berechnet …");
    try {
      const result = await requestJson("/analysis-jobs", { method: "POST", body: JSON.stringify(job) });
      const surface = result.analysis.analyses.find((item) => item.combination.limit_state === "ULS")?.result || result.analysis.analyses[0]?.result;
      state.surfaceResults.set(fingerprint, surface);
      surfaceResultView.render(surface);
      byId("viewer-mode-description").textContent = `${surface.grid.nx} × ${surface.grid.ny} Punkte · ${surface.theory}`;
    } catch (error) {
      surfaceResultView.setMessage("Flächensimulation konnte nicht berechnet werden");
      showToast("Flächensimulation fehlgeschlagen", error.message, "warning");
    }
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    canvas.toggleAttribute("hidden", view !== "system");
    surfaceCanvas.toggleAttribute("hidden", view !== "loads");
    model3dCanvas.toggleAttribute("hidden", view !== "results");
    document.querySelector(".canvas-legend").hidden = view !== "system";
    document.querySelector(".canvas-compass").hidden = view !== "system";
    const note = byId("viewer-mode-note");
    note.hidden = view === "system";
    document.querySelectorAll('[data-action^="zoom-"]').forEach((button) => { button.disabled = view !== "system"; });
    if (view === "system") {
      renderCanvas();
      byId("automation-message").textContent = "Spannweite, Auflager und Lastfläche wurden automatisch vorbelegt.";
    } else if (view === "loads") {
      byId("viewer-mode-title").textContent = "Flächensimulation";
      byId("viewer-mode-description").textContent = "Lineare Verformung unter Bemessungslast";
      byId("automation-message").textContent = "Das Flächenmodell wird aus Geometrie, Material und Lasten des gewählten Bauteils erzeugt.";
      runSurfaceSimulation();
    } else {
      byId("viewer-mode-title").textContent = "3D-Auswahlansicht";
      byId("viewer-mode-description").textContent = "Bauteile auswählen · kein Rundgang";
      byId("automation-message").textContent = "Die Auswahlansicht nutzt ausschließlich das lokale Strukturmodell von vectoplan-statik.";
      structural3dView?.setModel(state.model);
      structural3dView?.setSelected(state.selectedRef);
    }
  }

  function zoom(factor) {
    const box = state.viewBox;
    const nextWidth = Math.max(360, Math.min(1500, box.width * factor));
    const nextHeight = nextWidth * (560 / 920);
    box.x += (box.width - nextWidth) / 2;
    box.y += (box.height - nextHeight) / 2;
    box.width = nextWidth;
    box.height = nextHeight;
    canvas.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
  }

  function zoomFit() {
    state.viewBox = { x: 0, y: 0, width: 920, height: 560 };
    canvas.setAttribute("viewBox", "0 0 920 560");
  }

  function closePanels() {
    app.classList.remove("is-navigator-open", "is-inspector-open");
  }

  function showProvenance() {
    const provenance = selectedElement()?.provenance || {};
    const message = Object.entries(provenance).map(([key, value]) => `${key}: ${value}`).join(" · ");
    showToast("Datenherkunft", message || "Keine Herkunftsangaben vorhanden.");
  }

  function showLoadCases() {
    const labels = state.model.load_cases.map((load) => load.label).join(" · ");
    showToast("Automatische Lastfälle", labels);
  }

  function activateDossierTab(tab) {
    state.dossierTab = tab;
    byId("calculation-dossier").classList.add("is-open");
    document.querySelector(".dossier-toggle").setAttribute("aria-expanded", "true");
    if (state.activeDossier) renderDossier(state.activeDossier);
  }

  function toggleDossier() {
    const dossier = byId("calculation-dossier");
    const open = dossier.classList.toggle("is-open");
    document.querySelector(".dossier-toggle").setAttribute("aria-expanded", String(open));
  }

  function handleAction(action) {
    const actions = {
      calculate: () => runAnalysis(),
      "run-project": runProjectWorkspace,
      "reset-project": resetProjectWorkspace,
      "reset-auto": resetAutomaticValues,
      "stage-command": stageCommand,
      "create-report": createReport,
      "show-output": () => showProjectOutput("report"),
      "show-template-output": () => showProjectOutput("template"),
      "export-project-pdf": exportProjectPdf,
      "close-output": closeProjectOutput,
      "show-calculation": () => activateDossierTab("calculation"),
      "close-dialog": () => calculationDialog.close(),
      "show-provenance": showProvenance,
      "show-loads": showLoadCases,
      "zoom-in": () => zoom(.82),
      "zoom-out": () => zoom(1.22),
      "zoom-fit": zoomFit,
      "toggle-navigator": () => { app.classList.toggle("is-navigator-open"); app.classList.remove("is-inspector-open"); },
      "toggle-inspector": () => { app.classList.toggle("is-inspector-open"); app.classList.remove("is-navigator-open"); },
      "close-panels": closePanels,
      "hide-toast": () => { byId("toast").hidden = true; },
      "toggle-dossier": toggleDossier,
    };
    actions[action]?.();
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) handleAction(actionButton.dataset.action);
      const viewButton = event.target.closest("button[data-view]");
      if (viewButton) setView(viewButton.dataset.view);
      const tabButton = event.target.closest("button[data-nav-tab]");
      if (tabButton) activateNavigatorTab(tabButton.dataset.navTab);
      const dossierTab = event.target.closest("button[data-dossier-tab]");
      if (dossierTab) activateDossierTab(dossierTab.dataset.dossierTab);
      const workflowButton = event.target.closest("button[data-workflow]");
      if (workflowButton?.dataset.workflow === "publish") showToast("Rückgabe vorbereitet", "Der spätere Core-Command kann geprüfte Änderungen revisioniert an 2D und 3D zurückgeben.", "warning");
      const variableScope = event.target.closest("button[data-variable-scope]");
      if (variableScope) {
        state.variableScope = variableScope.dataset.variableScope;
        document.querySelectorAll("[data-variable-scope]").forEach((button) => button.classList.toggle("is-active", button === variableScope));
        renderProjectVariables();
      }
      const outputView = event.target.closest("button[data-output-view]");
      if (outputView) showProjectOutput(outputView.dataset.outputView);
      const positionLink = event.target.closest("[data-select-position]");
      if (positionLink) selectElement(positionLink.dataset.selectPosition);
    });

    byId("project-case-select")?.addEventListener("change", (event) => loadProjectWorkspace(event.target.value));
    byId("project-variable-search")?.addEventListener("input", (event) => {
      state.variableSearch = event.target.value;
      renderProjectVariables();
    });
    byId("project-variable-groups")?.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-variable-path]");
      if (input) handleProjectVariableInput(input);
    });

    form.addEventListener("submit", (event) => { event.preventDefault(); runAnalysis(); });
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    canvas.addEventListener("wheel", (event) => { event.preventDefault(); zoom(event.deltaY < 0 ? .9 : 1.1); }, { passive: false });
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 1 && !(event.button === 0 && event.shiftKey)) return;
      canvas.setPointerCapture(event.pointerId);
      state.pan = { clientX: event.clientX, clientY: event.clientY, box: { ...state.viewBox } };
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.pan) return;
      const rect = canvas.getBoundingClientRect();
      state.viewBox.x = state.pan.box.x - (event.clientX - state.pan.clientX) * state.pan.box.width / rect.width;
      state.viewBox.y = state.pan.box.y - (event.clientY - state.pan.clientY) * state.pan.box.height / rect.height;
      canvas.setAttribute("viewBox", `${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.width} ${state.viewBox.height}`);
    });
    canvas.addEventListener("pointerup", () => { state.pan = null; });
    canvas.addEventListener("pointercancel", () => { state.pan = null; });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); runAnalysis(); }
      if (event.key === "Escape") closePanels();
    });
  }

  async function initialize() {
    try {
      const [bootstrap, projectCatalog] = await Promise.all([
        requestJson("/bootstrap"),
        requestJson("/project-cases"),
      ]);
      state.bootstrap = bootstrap;
      state.projectCatalog = projectCatalog;
      surfaceResultView = window.VectoplanStatikSurfacePlugin
        ? new window.VectoplanStatikSurfacePlugin.StructuralSurfaceResultView(surfaceCanvas)
        : null;
      structural3dView = window.VectoplanStatikEditorPlugin
        ? new window.VectoplanStatikEditorPlugin.StructuralSelection3DView(model3dCanvas, { onSelect: (elementRef) => selectElement(elementRef, { keepPanels: true }) })
        : null;
      bindEvents();
      const picker = byId("project-case-select");
      picker.replaceChildren();
      (projectCatalog.cases || []).forEach((item) => {
        const option = document.createElement("option");
        option.value = item.case_id;
        option.textContent = item.label;
        option.title = item.description || item.label;
        picker.append(option);
      });
      const requested = new URLSearchParams(location.search).get("projekt");
      const initialCase = projectCatalog.cases?.some((item) => item.case_id === requested)
        ? requested
        : projectCatalog.cases?.[0]?.case_id;
      if (!initialCase) throw new Error("Keine Testprojekte im Projektkatalog vorhanden.");
      await loadProjectWorkspace(initialCase);
    } catch (error) {
      try {
        const model = await requestJson("/sample-model");
        state.projectWorkspace = null;
        state.model = model;
        app.classList.remove("is-project-workspace");
        structural3dView?.setModel(model);
        renderProjectMetadata();
        renderCheckList();
        selectElement(model.elements.find((element) => element.kind === "slab")?.element_ref || model.elements[0].element_ref, { keepPanels: true });
        await runAnalysis({ silent: true });
        showToast("Projektmodus nicht verfügbar", `${error.message} · Lokales Einzelmodell wurde geladen.`, "warning");
      } catch (fallbackError) {
        byId("stage-selection").textContent = "Statik-Arbeitsfläche nicht bereit";
        showToast("Initialisierung fehlgeschlagen", fallbackError.message, "warning");
      }
    }
  }

  initialize();
})();
