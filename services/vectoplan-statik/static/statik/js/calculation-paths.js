(() => {
  "use strict";

  const apiRoot = document.body.dataset.apiRoot;
  const state = { catalog: null, records: [], query: "", category: null, statuses: new Set(), selected: null, mode: "curated", candidatePage: 1, candidatePayload: null, candidateRequest: 0 };
  const byId = (id) => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const statusLabels = {
    implemented: "implementiert",
    implemented_bounded: "begrenzt implementiert",
    incomplete: "unvollständig",
    historical_reference: "historisch",
  };
  const operatorLabels = {
    equals: "ist",
    not_equals: "ist nicht",
    contains: "enthält",
    contains_any: "enthält mindestens",
    exists: "ist vorhanden",
    greater_than: "ist größer als",
    at_least: "ist mindestens",
  };

  function badge(status) {
    return make("span", `status-badge status-${status}`, statusLabels[status] || status);
  }

  function allFormulaIds(path) {
    return [
      ...(path.steps || []).map((step) => step.formula_ref),
      ...(path.supporting_formula_refs || []),
      ...(path.alternatives || []).flatMap((alternative) => alternative.formula_refs || []),
    ];
  }

  function selectionText(path) {
    const selection = path.selection || {};
    const clauses = [...(selection.all || []), ...(selection.any || [])];
    if (!clauses.length) return "gilt als gemeinsamer Grundpfad";
    return clauses.map((item) => `${item.fact} ${operatorLabels[item.operator] || item.operator} ${Array.isArray(item.value) ? item.value.join(", ") : item.value}`).join(" · ");
  }

  function renderCoverage() {
    const coverage = state.catalog.formula_coverage;
    byId("coverageAssigned").textContent = `${coverage.assigned_formula_count}/${coverage.catalogued_formula_count}`;
    byId("coveragePaths").textContent = state.catalog.statistics.path_count;
    byId("coverageCandidates").textContent = Number(state.catalog.statistics.eurocode_candidate_path_count || 0).toLocaleString("de-DE");
    const gate = byId("coverageGate");
    gate.className = `coverage-gate ${coverage.gate.passed ? "passed" : "failed"}`;
    gate.textContent = coverage.gate.passed
      ? "✓ Jede interne Rechenmethode ist einem Rechenweg oder einem sichtbaren Sperrpfad zugeordnet."
      : `! ${coverage.unassigned_formula_count} Rechenmethoden sind noch keinem Pfad zugeordnet.`;
  }

  function renderFilters() {
    const statuses = [...new Set(state.records.map((item) => item.status))];
    const statusBox = byId("statusFilters");
    statuses.forEach((status) => {
      state.statuses.add(status);
      const button = make("button", "filter-chip active", statusLabels[status] || status);
      button.type = "button";
      button.addEventListener("click", () => {
        state.statuses.has(status) ? state.statuses.delete(status) : state.statuses.add(status);
        button.classList.toggle("active", state.statuses.has(status));
        renderList();
      });
      statusBox.append(button);
    });

    const nav = byId("categoryNavigation");
    state.catalog.categories.forEach((category) => {
      const count = state.records.filter((item) => item.category_id === category.category_id).length;
      const button = make("button", "category-button");
      button.type = "button";
      button.dataset.category = category.category_id;
      button.append(
        make("span", "category-number", String(category.order).padStart(2, "0")),
        make("span", "category-label", category.label),
        make("span", "category-count", count),
      );
      button.addEventListener("click", () => {
        state.category = state.category === category.category_id ? null : category.category_id;
        document.querySelectorAll(".category-button").forEach((item) => item.classList.toggle("active", item.dataset.category === state.category));
        renderList();
      });
      nav.append(button);
    });
  }

  function filteredRecords() {
    const needle = state.query.trim().toLocaleLowerCase("de");
    return state.records.filter((path) => {
      if (!state.statuses.has(path.status)) return false;
      if (state.category && path.category_id !== state.category) return false;
      if (!needle) return true;
      return [path.path_id, path.title, path.description, selectionText(path), ...allFormulaIds(path), ...(path.outputs || [])]
        .join(" ").toLocaleLowerCase("de").includes(needle);
    });
  }

  function pathRow(path) {
    const row = make("button", `path-row${state.selected === path.path_id ? " selected" : ""}`);
    row.type = "button";
    const main = make("span", "path-row-main");
    const line = make("span", "path-line");
    line.append(make("span", "path-id", path.path_id), make("span", "path-title", path.title));
    const meta = make("span", "path-meta");
    meta.append(make("span", "meta-chip", `${path.steps.length} Schritte`), make("span", "meta-chip", `${path.formula_count} Methoden`), make("span", "meta-chip", `${Number(path.application_variant_count || 0).toLocaleString("de-DE")} Varianten`), make("span", "meta-chip", path.phase));
    main.append(line, make("span", "path-description", path.description), meta);
    const selection = make("span", "path-selection");
    selection.append(make("strong", "", "Auswahlregel"), make("span", "", selectionText(path)));
    row.append(main, selection, badge(path.status));
    row.addEventListener("click", () => selectPath(path.path_id));
    return row;
  }

  function candidateRow(candidate) {
    const row = make("button", `path-row candidate-row${state.selected === candidate.candidate_path_id ? " selected" : ""}`);
    row.type = "button";
    const main = make("span", "path-row-main");
    const line = make("span", "path-line");
    line.append(make("span", "path-id", candidate.candidate_path_id), make("span", "path-title", candidate.title));
    const meta = make("span", "path-meta");
    meta.append(make("span", "meta-chip", candidate.eurocode_family), make("span", "meta-chip", candidate.topic), make("span", "meta-chip", `${candidate.rule_count} PDF-Treffer`));
    main.append(line, make("span", "path-description", candidate.purpose), meta);
    const source = make("span", "path-selection");
    source.append(make("strong", "", candidate.designation), make("span", "", `Abschnitt ${candidate.clause} · ${candidate.section}`));
    row.append(main, source, badge("incomplete"));
    row.addEventListener("click", () => showCandidateDetail(candidate));
    return row;
  }

  function renderStats() {
    const stats = byId("catalogStats");
    const values = [
      [state.catalog.statistics.path_count, "Rechenwege"],
      [Number(state.catalog.statistics.application_variant_count || 0).toLocaleString("de-DE"), "Anwendungsvarianten"],
      [state.catalog.statistics.eurocode_candidate_path_count || 0, "EC-Kandidaten"],
    ];
    values.forEach(([value, label]) => {
      const pill = make("div", "stat-pill");
      pill.append(make("strong", "", value), make("span", "", label));
      stats.append(pill);
    });
  }

  function renderList() {
    if (state.mode === "eurocode") return;
    const records = filteredRecords();
    byId("pathList").replaceChildren(...records.map(pathRow));
    byId("emptyState").hidden = records.length > 0;
    const category = state.category ? state.catalog.categories.find((item) => item.category_id === state.category)?.label : "alle Kategorien";
    byId("resultSummary").textContent = `${records.length} von ${state.records.length} Rechenwegen · ${category}`;
  }

  async function loadCandidates() {
    const request = ++state.candidateRequest;
    const url = new URL(`${apiRoot}/eurocodes/calculation-path-candidates`, window.location.origin);
    url.searchParams.set("page", state.candidatePage);
    url.searchParams.set("page_size", 50);
    if (state.query) url.searchParams.set("q", state.query);
    byId("resultSummary").textContent = "Eurocode-Rechenwegkandidaten werden geladen …";
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok || request !== state.candidateRequest) return;
    const payload = await response.json();
    if (request !== state.candidateRequest) return;
    state.candidatePayload = payload;
    byId("pathList").replaceChildren(...payload.items.map(candidateRow));
    byId("emptyState").hidden = payload.items.length > 0;
    byId("resultSummary").textContent = `${payload.pagination.total.toLocaleString("de-DE")} von ${payload.statistics.candidate_path_count.toLocaleString("de-DE")} Eurocode-Kandidaten · vor manueller Kuratierung`;
    byId("candidatePagination").hidden = false;
    byId("candidatePageStatus").textContent = `Seite ${payload.pagination.page} von ${payload.pagination.page_count}`;
    byId("candidatePrevious").disabled = !payload.pagination.has_previous;
    byId("candidateNext").disabled = !payload.pagination.has_next;
  }

  function showCandidateDetail(candidate) {
    state.selected = candidate.candidate_path_id;
    if (state.candidatePayload) byId("pathList").replaceChildren(...state.candidatePayload.items.map(candidateRow));
    byId("detailEmpty").hidden = true; byId("detailContent").hidden = true; byId("candidateDetailContent").hidden = false; byId("detailPanel").classList.add("open");
    byId("candidateDetailId").textContent = candidate.candidate_path_id;
    byId("candidateDetailTitle").textContent = candidate.title;
    byId("candidateDetailDescription").textContent = candidate.purpose;
    const source = make("div", "normative-card");
    source.append(make("strong", "", `${candidate.designation} · ${candidate.document_kind}`), make("span", "", `${candidate.eurocode_family} · Abschnitt ${candidate.clause} · ${candidate.section}`), make("span", "", `Thema: ${candidate.topic} · Status: ${candidate.status}`));
    byId("candidateDetailSource").replaceChildren(source);
    byId("candidateRuleLinks").replaceChildren(...(candidate.rule_refs || []).map((ruleId) => {
      const link = make("a", "", ruleId); link.href = `/statik/katalog?bereich=eurocodes&regel=${encodeURIComponent(ruleId)}`; link.target = "_top"; return link;
    }));
    byId("candidateMissing").replaceChildren(...(candidate.missing || []).map((item) => make("li", "", item)));
  }

  function setMode(mode) {
    state.mode = mode;
    state.selected = null;
    closeDetail();
    document.querySelectorAll("#pathModes button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    if (mode === "eurocode") {
      byId("pathHeading").textContent = "Eurocode-Rechenwegkandidaten";
      state.candidatePage = 1; loadCandidates();
    } else {
      byId("pathHeading").textContent = "Vordefinierte Rechenfälle";
      byId("candidatePagination").hidden = true; renderList();
    }
  }

  function renderRules(path) {
    const container = byId("selectionRules");
    container.replaceChildren();
    const selection = path.selection || {};
    const groups = [["UND", selection.all || []], ["ODER", selection.any || []], ["NICHT", selection.none || []]];
    if (!groups.some(([, items]) => items.length)) {
      container.append(make("div", "rule-card rule-always", "Gemeinsamer Grundpfad · wird für jeden gültigen Rechenfall berücksichtigt."));
      return;
    }
    groups.forEach(([group, items]) => items.forEach((rule) => {
      const card = make("div", "rule-card");
      const prefix = make("strong", "", `${group} · ${rule.fact} `);
      card.append(prefix, document.createTextNode(`${operatorLabels[rule.operator] || rule.operator} ${Array.isArray(rule.value) ? rule.value.join(", ") : rule.value}`));
      container.append(card);
    }));
  }

  function renderApplicability(path) {
    const labels = { structure_types: "Baukörper", materials: "Material", component_types: "Bauteile", calculation_scopes: "Betrachtung" };
    const rows = Object.entries(path.applicability || {}).map(([key, values]) => {
      const row = make("div", "path-applicability-row");
      const tags = make("div", "path-applicability-tags");
      (values || []).forEach((value) => tags.append(make("span", "", value)));
      row.append(make("strong", "", labels[key] || key), tags);
      return row;
    });
    byId("pathApplicability").replaceChildren(...rows);
  }

  function renderNormativeBasis(path) {
    const basis = path.normative_basis || {};
    const gate = basis.gate || {};
    byId("normativeGate").textContent = gate.passed ? "Regel-ID bestätigt" : "manuell zu prüfen";
    const container = byId("normativeBasis");
    container.replaceChildren();
    const summary = make("div", `normative-card${gate.passed ? " verified" : ""}`);
    summary.append(
      make("strong", "", basis.basis_kind === "eurocode_governed" ? `${(basis.standard_refs || []).join(" · ") || "Eurocode-Bezug unvollständig"}` : "Allgemeine Rechenmethode"),
      make("span", "", `${basis.candidate_rule_count || 0} PDF-Regelkandidaten · Status: ${basis.verification_status || "unvollständig"}`),
    );
    const rules = make("div", "normative-rule-links");
    (basis.verified_rule_refs || []).forEach((ruleId) => {
      const link = make("a", "", `bestätigt · ${ruleId}`); link.href = `/statik/katalog?bereich=eurocodes&regel=${encodeURIComponent(ruleId)}`; link.target = "_top"; rules.append(link);
    });
    (basis.suggested_rule_refs || []).slice(0, 8).forEach((ruleId) => {
      const link = make("a", "", `Kandidat · ${ruleId}`); link.href = `/statik/katalog?bereich=eurocodes&regel=${encodeURIComponent(ruleId)}`; link.target = "_top"; rules.append(link);
    });
    summary.append(rules); container.append(summary);
    (basis.documents || []).forEach((document) => {
      const card = make("div", "normative-card");
      card.append(make("strong", "", `${document.designation} · ${document.document_kind}`), make("span", "", `${document.eurocode_family} · Rechts-/Anwendungsstatus: ${document.current_legal_status || "unvollständig"} / ${document.national_application_status || "unvollständig"}`));
      container.append(card);
    });
  }

  function renderVariables(path) {
    const variables = path.required_variables || [];
    byId("pathVariableCount").textContent = `${variables.length} stabile IDs`;
    byId("pathVariables").replaceChildren(...variables.map((variable) => {
      const row = make("div", "path-variable-row");
      const content = make("div");
      content.append(
        make("strong", "", variable.variable_id),
        make("span", "", `${variable.symbol || "–"} · ${variable.source || "project_input_or_previous_step"}`),
        make("span", "", `min ${variable.minimum ?? "unvollständig"} · max ${variable.maximum ?? "unvollständig"}`),
      );
      row.append(content, make("em", "", variable.unit || "–"));
      return row;
    }));
  }

  function renderLimits(path) {
    const labels = { minimum: "Mindestgrenzen", maximum: "Höchstgrenzen", exclusions: "Nicht abgedeckt" };
    const rows = Object.entries(path.limits || {}).map(([key, values]) => {
      const row = make("div", "path-limit-row");
      row.append(make("strong", "", labels[key] || key), document.createTextNode((values || ["unvollständig"]).join(" · ")));
      return row;
    });
    byId("pathLimits").replaceChildren(...rows);
  }

  function exampleSubstitution(formula) {
    const inputs = formula.example?.inputs || [];
    return inputs.length ? inputs.map((item) => `${item.label}=${item.value} ${item.unit || ""}`.trim()).join("; ") : "unvollständig";
  }

  function exampleResult(formula) {
    const result = formula.example?.result || {};
    const value = `${result.value ?? "unvollständig"} ${result.unit || ""}`.trim();
    return `${result.label || "Ergebnis"} = ${value}${result.assessment ? ` · ${result.assessment}` : ""}`;
  }

  function renderSteps(path) {
    const list = byId("calculationSteps");
    list.replaceChildren();
    (path.steps || []).forEach((step) => {
      const formula = step.formula;
      const item = make("li", "calculation-step");
      const card = make("div", "step-card");
      const head = make("div", "step-head");
      const jump = make("a", "formula-jump", `${formula.formula_id} · ${statusLabels[formula.status] || formula.status} ↗`);
      jump.href = `/statik/katalog?bereich=methoden&formel=${encodeURIComponent(formula.formula_id)}`;
      jump.target = "_top";
      head.append(make("strong", "", step.label), jump);
      const substitution = make("div", "step-substitution");
      substitution.innerHTML = `<b>Einsetzen:</b> ${escapeHtml(exampleSubstitution(formula))}`;
      const result = make("div", "step-result");
      result.innerHTML = `<b>Ergebnis:</b> ${escapeHtml(exampleResult(formula))}`;
      const refs = make("div", "step-source");
      (formula.standard_refs || []).forEach((ref) => refs.append(make("span", "", ref)));
      refs.append(make("span", "", `Quelle: ${formula.source?.short_title || formula.source?.title || "unvollständig"}`));
      card.append(head, make("div", "step-formula", formula.equation), substitution, result, refs);
      item.append(card);
      list.append(item);
    });
    byId("stepCount").textContent = `${path.steps.length} geordnete Schritte`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
  }

  function renderSupporting(path) {
    const formulas = path.supporting_formulas || [];
    byId("supportingSection").hidden = formulas.length === 0;
    const box = byId("supportingFormulas");
    box.replaceChildren();
    formulas.forEach((formula) => {
      const link = make("a", "formula-link", `${formula.formula_id} · ${formula.title}`);
      link.href = `/statik/katalog?bereich=methoden&formel=${encodeURIComponent(formula.formula_id)}`;
      link.target = "_top";
      box.append(link);
    });
  }

  function renderAlternatives(path) {
    const alternatives = path.alternatives || [];
    byId("alternativesSection").hidden = alternatives.length === 0;
    const box = byId("alternatives");
    box.replaceChildren();
    alternatives.forEach((alternative) => {
      const card = make("div", `alternative-card ${alternative.status === "incomplete" ? "incomplete" : ""}`);
      card.append(
        make("strong", "", alternative.label),
        make("span", "", `${statusLabels[alternative.status] || alternative.status} · Aktivierung: ${alternative.activation}`),
        make("p", "", alternative.note),
      );
      const links = make("div", "formula-links");
      (alternative.formulas || []).forEach((formula) => {
        const link = make("a", "formula-link", formula.formula_id);
        link.href = `/statik/katalog?bereich=methoden&formel=${encodeURIComponent(formula.formula_id)}`;
        link.target = "_top";
        links.append(link);
      });
      card.append(links);
      box.append(card);
    });
  }

  function showDetail(path) {
    byId("detailEmpty").hidden = true;
    byId("detailContent").hidden = false;
    byId("detailPanel").classList.add("open");
    const category = state.catalog.categories.find((item) => item.category_id === path.category_id);
    byId("detailCategory").textContent = `${category?.label || path.category_id} · ${path.phase}`;
    byId("detailId").textContent = path.path_id;
    byId("detailTitle").textContent = path.title;
    byId("detailDescription").textContent = path.description;
    const status = byId("detailStatus");
    status.className = `status-badge status-${path.status}`;
    status.textContent = statusLabels[path.status] || path.status;
    renderRules(path);
    renderApplicability(path);
    renderNormativeBasis(path);
    renderSteps(path);
    renderSupporting(path);
    renderAlternatives(path);
    renderVariables(path);
    byId("outputs").replaceChildren(...(path.outputs || []).map((item) => make("span", "output-item", item)));
    renderLimits(path);
    byId("pathAssumptions").replaceChildren(...(path.assumptions || []).map((item) => make("li", "", item)));
  }

  async function selectPath(pathId) {
    state.selected = pathId;
    renderList();
    const response = await fetch(`${apiRoot}/calculation-paths/${encodeURIComponent(pathId)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    showDetail(await response.json());
    const url = new URL(window.location.href);
    url.searchParams.set("rechenweg", pathId);
    history.replaceState({}, "", url);
  }

  function closeDetail() {
    state.selected = null;
    byId("detailPanel").classList.remove("open");
    byId("detailContent").hidden = true;
    byId("candidateDetailContent").hidden = true;
    byId("detailEmpty").hidden = false;
    if (state.mode === "curated") renderList();
    const url = new URL(window.location.href);
    url.searchParams.delete("rechenweg");
    history.replaceState({}, "", url);
  }

  async function initialize() {
    try {
      const response = await fetch(`${apiRoot}/calculation-paths`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json();
      state.records = state.catalog.paths || [];
      byId("catalogVersion").textContent = `${state.catalog.schema_version} · ${state.records.length} Rechenwege`;
      renderCoverage();
      renderFilters();
      renderStats();
      renderList();
      const selected = new URL(window.location.href).searchParams.get("rechenweg");
      if (selected && state.records.some((path) => path.path_id === selected)) selectPath(selected);
    } catch (error) {
      byId("resultSummary").textContent = "Rechenweg-Katalog konnte nicht geladen werden.";
      byId("pathList").append(make("div", "missing-note", String(error)));
    }
  }

  byId("pathSearch").addEventListener("input", (event) => { state.query = event.target.value; renderList(); });
  let candidateSearchTimer;
  byId("pathSearch").addEventListener("input", () => {
    if (state.mode !== "eurocode") return;
    clearTimeout(candidateSearchTimer);
    candidateSearchTimer = setTimeout(() => { state.candidatePage = 1; loadCandidates(); }, 220);
  });
  document.querySelectorAll("#pathModes button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  byId("candidatePrevious").addEventListener("click", () => { state.candidatePage = Math.max(1, state.candidatePage - 1); loadCandidates(); });
  byId("candidateNext").addEventListener("click", () => { state.candidatePage += 1; loadCandidates(); });
  byId("closeCandidateDetail").addEventListener("click", closeDetail);
  byId("showAllCategories").addEventListener("click", () => {
    state.category = null;
    document.querySelectorAll(".category-button").forEach((item) => item.classList.remove("active"));
    renderList();
  });
  byId("closeDetail").addEventListener("click", closeDetail);
  initialize();
})();
