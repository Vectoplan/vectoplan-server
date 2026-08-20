(() => {
  "use strict";

  const apiRoot = document.body.dataset.apiRoot;
  const state = { catalog: null, records: [], query: "", category: null, domain: null, statuses: new Set(), selected: null, mode: "templates", variantPage: 1, variantPayload: null, variantRequest: 0, selectedVariant: null };
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
  };
  const operatorLabels = {
    equals: "ist", not_equals: "ist nicht", contains: "enthält", contains_any: "enthält mindestens",
    exists: "ist vorhanden", greater_than: "ist größer als", at_least: "ist mindestens",
  };
  const domainLabels = {
    scaffolding: "Gerüstbau", bridge: "Brückenbau", building: "Hochbau", hall: "Hallenbau",
    cross_domain: "Übergreifend", scenario: "Sonderbetrachtung", governance: "Prüfung & Freigabe", special: "Sondertragwerke",
  };

  function badge(status) { return make("span", `status-badge status-${status}`, statusLabels[status] || status); }
  function categoryFor(pipeline) { return state.catalog.categories.find((item) => item.category_id === pipeline.category_id); }
  function ruleText(rule) {
    const value = Array.isArray(rule.value) ? rule.value.join(", ") : rule.value;
    return `${rule.fact} ${operatorLabels[rule.operator] || rule.operator} ${value}`;
  }
  function selectionText(pipeline) {
    const selection = pipeline.selection || {};
    const clauses = [...(selection.all || []), ...(selection.any || [])];
    return clauses.length ? clauses.map(ruleText).join(" · ") : "gilt für jeden gültigen Rechenfall";
  }
  function pathIds(pipeline) { return pipeline.path_refs || []; }

  function renderCoverage() {
    const coverage = state.catalog.path_coverage;
    byId("coverageAssigned").textContent = `${coverage.assigned_path_count}/${coverage.catalogued_path_count}`;
    byId("coveragePipelines").textContent = state.catalog.statistics.pipeline_count;
    byId("coverageExecutable").textContent = Number(state.catalog.statistics.application_variant_count || 0).toLocaleString("de-DE");
    const gate = byId("coverageGate");
    gate.className = `coverage-gate ${coverage.gate.passed ? "passed" : "failed"}`;
    gate.textContent = coverage.gate.passed
      ? "✓ Jeder Rechenweg besitzt mindestens einen definierten Pipelineplatz."
      : `! ${coverage.unassigned_path_count} Rechenwege sind keiner Pipeline zugeordnet.`;
  }

  function renderFilters() {
    const statusBox = byId("statusFilters");
    [...new Set(state.records.map((item) => item.status))].forEach((status) => {
      state.statuses.add(status);
      const button = make("button", "filter-chip active", statusLabels[status] || status);
      button.type = "button";
      button.addEventListener("click", () => {
        state.statuses.has(status) ? state.statuses.delete(status) : state.statuses.add(status);
        button.classList.toggle("active", state.statuses.has(status)); renderList();
      });
      statusBox.append(button);
    });
    const domainNavigation = byId("domainNavigation");
    Object.entries(state.catalog.statistics.by_domain || {})
      .sort((left, right) => (domainLabels[left[0]] || left[0]).localeCompare(domainLabels[right[0]] || right[0], "de"))
      .forEach(([domain, count], index) => {
        const button = make("button", "category-button");
        button.type = "button"; button.dataset.domain = domain;
        button.append(make("span", "category-number", String(index + 1).padStart(2, "0")), make("span", "category-label", domainLabels[domain] || domain), make("span", "category-count", count));
        button.addEventListener("click", () => {
          state.domain = state.domain === domain ? null : domain;
          document.querySelectorAll("[data-domain]").forEach((item) => item.classList.toggle("active", item.dataset.domain === state.domain));
          state.variantPage = 1;
          state.mode === "variants" ? loadVariants() : renderList();
        });
        domainNavigation.append(button);
      });
    const navigation = byId("categoryNavigation");
    state.catalog.categories.forEach((category) => {
      const count = state.records.filter((item) => item.category_id === category.category_id).length;
      const button = make("button", "category-button");
      button.type = "button"; button.dataset.category = category.category_id;
      button.append(make("span", "category-number", String(category.order).padStart(2, "0")), make("span", "category-label", category.label), make("span", "category-count", count));
      button.addEventListener("click", () => {
        state.category = state.category === category.category_id ? null : category.category_id;
        document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("active", item.dataset.category === state.category));
        renderList();
      });
      navigation.append(button);
    });
  }

  function filteredRecords() {
    const needle = state.query.trim().toLocaleLowerCase("de");
    return state.records.filter((pipeline) => {
      if (!state.statuses.has(pipeline.status)) return false;
      if (state.category && pipeline.category_id !== state.category) return false;
      if (state.domain && pipeline.domain !== state.domain) return false;
      if (!needle) return true;
      const normative = pipeline.normative_basis || {};
      return [pipeline.pipeline_id, pipeline.title, pipeline.description, pipeline.level, pipeline.domain, domainLabels[pipeline.domain], selectionText(pipeline), ...pathIds(pipeline), ...(pipeline.standard_refs || []), ...(pipeline.outputs || []), ...(normative.explicit_eurocode_refs || []), ...(normative.supplementary_standard_candidates || []), ...(normative.regulatory_checks || []), ...Object.values(pipeline.applicability || {}).flat()]
        .join(" ").toLocaleLowerCase("de").includes(needle);
    });
  }

  function pipelineRow(pipeline) {
    const row = make("button", `pipeline-row${state.selected === pipeline.pipeline_id ? " selected" : ""}`);
    row.type = "button";
    const main = make("span", "pipeline-main");
    const line = make("span", "path-line");
    line.append(make("span", "path-id", pipeline.pipeline_id), make("span", "path-title", pipeline.title));
    const meta = make("span", "path-meta");
    meta.append(make("span", "meta-chip", domainLabels[pipeline.domain] || pipeline.domain), make("span", "meta-chip", `${pipeline.phases.length} Phasen`), make("span", "meta-chip", `${pipeline.path_count} Rechenwege`), make("span", "meta-chip", `${pipeline.application_variant_count} Varianten`), make("span", "meta-chip", `${pipeline.variable_count} Variablen`));
    main.append(line, make("span", "path-description", pipeline.description), meta);
    const sequence = make("span", "pipeline-sequence");
    sequence.append(make("strong", "", "Ablauf"), make("span", "", pipeline.phases.map((phase) => phase.title).join(" → ")));
    row.append(main, sequence, badge(pipeline.status));
    row.addEventListener("click", () => selectPipeline(pipeline.pipeline_id));
    return row;
  }

  function variantRow(variant) {
    const row = make("button", `pipeline-row${state.selectedVariant?.variant_id === variant.variant_id ? " selected" : ""}`);
    row.type = "button";
    const main = make("span", "pipeline-main");
    const line = make("span", "path-line");
    line.append(make("span", "path-id", variant.variant_id), make("span", "path-title", variant.title));
    const meta = make("span", "path-meta");
    meta.append(make("span", "meta-chip", domainLabels[variant.domain] || variant.domain), make("span", "meta-chip", variant.structure_type), make("span", "meta-chip", variant.material), make("span", "meta-chip", variant.component), make("span", "meta-chip", `${variant.path_count} Rechenwege`));
    main.append(line, make("span", "path-description", `Konkrete Variante von ${variant.base_pipeline_id}`), meta);
    const sequence = make("span", "pipeline-sequence");
    sequence.append(make("strong", "", "Normatives Gate"), make("span", "", variant.normative_gate_passed ? "bestätigt" : "manuell zu prüfen"));
    row.append(main, sequence, badge(variant.status));
    row.addEventListener("click", () => { state.selectedVariant = variant; selectPipeline(variant.base_pipeline_id, variant); });
    return row;
  }

  function renderStats() {
    const values = [[state.catalog.statistics.pipeline_count, "Templates"], [Number(state.catalog.statistics.application_variant_count || 0).toLocaleString("de-DE"), "Varianten"], [state.catalog.path_coverage.by_disposition.reserved_blocked || 0, "offene Rechenwege"]];
    byId("catalogStats").replaceChildren(...values.map(([value, label]) => {
      const pill = make("div", "stat-pill"); pill.append(make("strong", "", value), make("span", "", label)); return pill;
    }));
  }

  function renderList() {
    if (state.mode === "variants") return;
    const records = filteredRecords();
    byId("pipelineList").replaceChildren(...records.map(pipelineRow));
    byId("emptyState").hidden = records.length > 0;
    const category = state.category ? state.catalog.categories.find((item) => item.category_id === state.category)?.label : "alle Ebenen";
    byId("resultSummary").textContent = `${records.length} von ${state.records.length} Pipelines · ${category}`;
  }

  async function loadVariants() {
    const request = ++state.variantRequest;
    const url = new URL(`${apiRoot}/pipeline-variants`, window.location.origin);
    url.searchParams.set("page", state.variantPage); url.searchParams.set("page_size", 50);
    if (state.query) url.searchParams.set("q", state.query);
    if (state.domain) url.searchParams.set("domain", state.domain);
    byId("resultSummary").textContent = "Pipelinevarianten werden geladen …";
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok || request !== state.variantRequest) return;
    const payload = await response.json(); if (request !== state.variantRequest) return;
    state.variantPayload = payload;
    byId("pipelineList").replaceChildren(...payload.items.map(variantRow));
    byId("emptyState").hidden = payload.items.length > 0;
    byId("resultSummary").textContent = `${payload.pagination.total.toLocaleString("de-DE")} von ${payload.statistics.variant_count.toLocaleString("de-DE")} konkreten Pipelinevarianten`;
    byId("variantPagination").hidden = false;
    byId("variantPageStatus").textContent = `Seite ${payload.pagination.page} von ${payload.pagination.page_count}`;
    byId("variantPrevious").disabled = !payload.pagination.has_previous;
    byId("variantNext").disabled = !payload.pagination.has_next;
  }

  function setMode(mode) {
    state.mode = mode; state.selected = null; state.selectedVariant = null; closeDetail();
    document.querySelectorAll("#pipelineModes button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    if (mode === "variants") {
      byId("pipelineHeading").textContent = "Konkrete Pipelinevarianten"; state.variantPage = 1; loadVariants();
    } else {
      byId("pipelineHeading").textContent = "Bauteil bis Gesamttragwerk"; byId("variantPagination").hidden = true; renderList();
    }
  }

  function renderRules(pipeline) {
    const container = byId("selectionRules"); container.replaceChildren();
    const selection = pipeline.selection || {};
    const groups = [["UND", selection.all || []], ["ODER", selection.any || []], ["NICHT", selection.none || []]];
    if (!groups.some(([, items]) => items.length)) {
      container.append(make("div", "rule-card rule-always", "Gemeinsame Governance-Pipeline · wird für jeden gültigen Rechenfall berücksichtigt.")); return;
    }
    groups.forEach(([group, rules]) => rules.forEach((rule) => {
      const card = make("div", "rule-card"); card.append(make("strong", "", `${group} · `), document.createTextNode(ruleText(rule))); container.append(card);
    }));
  }

  function renderApplicability(pipeline) {
    const labels = { structure_types: "Baukörper", materials: "Material", components: "Bauteile" };
    const rows = Object.entries(pipeline.applicability || {}).map(([key, values]) => {
      const row = make("div", "applicability-row");
      const tags = make("div", "tag-cloud"); (values || []).forEach((value) => tags.append(make("span", "", value)));
      row.append(make("strong", "", labels[key] || key), tags); return row;
    });
    byId("applicability").replaceChildren(...rows);
  }

  function renderNormativeBasis(pipeline) {
    const basis = pipeline.normative_basis || {};
    const gate = basis.gate || {};
    byId("pipelineNormativeGate").textContent = gate.passed ? "vollständig bestätigt" : "manuell zu prüfen";
    const container = byId("pipelineNormativeBasis");
    const summary = make("div", `normative-card${gate.passed ? " verified" : ""}`);
    summary.append(
      make("strong", "", `${basis.verified_path_count || 0}/${basis.governed_path_count || 0} Eurocode-gesteuerte Rechenwege bestätigt`),
      make("span", "", `${basis.unverified_path_count || 0} Rechenweg-Zuordnungen offen · ${(basis.documents || []).length} Eurocode-Dokumente/Overlays im Umfang`),
    );
    const explicit = (basis.explicit_eurocode_refs || []).map((reference) => {
      const card = make("div", "normative-card");
      card.append(make("strong", "", reference), make("span", "", "Eurocode-Programm · Regel- und NA-Zuordnung manuell bestätigen"));
      return card;
    });
    const documents = (basis.documents || []).slice(0, 18).map((document) => {
      const card = make("div", "normative-card"); card.append(make("strong", "", `${document.designation} · ${document.document_kind}`), make("span", "", `${document.eurocode_family} · manuelle Gültigkeitsprüfung erforderlich`)); return card;
    });
    const supplements = (basis.supplementary_standard_candidates || []).map((reference) => {
      const card = make("div", "normative-card supplementary");
      card.append(make("strong", "", reference), make("span", "", "Ergänzende Fach-/Produktnorm · Kandidat, manuell prüfen"));
      return card;
    });
    const regulatory = (basis.regulatory_checks || []).map((item) => {
      const card = make("div", "normative-card regulatory");
      card.append(make("strong", "", "Regelwerks-/Projektprüfung"), make("span", "", item));
      return card;
    });
    container.replaceChildren(summary, ...explicit, ...documents, ...supplements, ...regulatory);
  }

  function renderPhases(pipeline) {
    const list = byId("pipelinePhases"); list.replaceChildren();
    (pipeline.phases || []).forEach((phase) => {
      const item = make("li", "pipeline-phase"); const card = make("div", "phase-card");
      const head = make("div", "phase-head"); head.append(make("strong", "", phase.title), make("span", "", `${phase.path_count} Rechenwege`));
      const paths = make("div", "phase-paths");
      (phase.paths || []).forEach((path) => {
        const link = make("a", `phase-path${path.executable ? "" : " blocked"}`);
        link.href = `/statik/katalog?bereich=rechenwege&rechenweg=${encodeURIComponent(path.path_id)}`; link.target = "_top";
        const text = make("span"); text.append(make("strong", "", `${path.path_id} · ${path.title}`), make("small", "", `${path.formula_count} Methoden · ${statusLabels[path.status] || path.status}`));
        link.append(text, make("span", "path-mode", path.mode === "required" ? "Pflicht" : "bedingt")); paths.append(link);
      });
      card.append(head, make("div", "phase-gate", `Gate: ${phase.gate}`), paths); item.append(card); list.append(item);
    });
    byId("phaseCount").textContent = `${pipeline.phases.length} geordnete Phasen`;
  }

  function renderVariables(pipeline) {
    const variables = pipeline.required_variables || [];
    byId("variableCount").textContent = `${variables.length} stabile IDs`;
    byId("variables").replaceChildren(...variables.map((variable) => {
      const row = make("div", "variable-row"); const text = make("div");
      const bounds = `min ${variable.minimum ?? "unvollständig"} · max ${variable.maximum ?? "unvollständig"}`;
      text.append(make("strong", "", variable.variable_id), make("span", "", `${variable.symbol || "–"} · ${variable.description || "Beschreibung unvollständig"}`), make("span", "", `${variable.source || variable.value_source || "project_input_or_previous_step"} · ${bounds}`));
      row.append(text, make("span", "variable-unit", variable.unit || "–")); return row;
    }));
  }

  function showDetail(pipeline, variant = null) {
    byId("detailEmpty").hidden = true; byId("detailContent").hidden = false; byId("detailPanel").classList.add("open");
    byId("detailCategory").textContent = `${categoryFor(pipeline)?.label || pipeline.category_id} · ${pipeline.level}`;
    byId("detailId").textContent = pipeline.pipeline_id; byId("detailTitle").textContent = pipeline.title; byId("detailDescription").textContent = pipeline.description;
    const status = byId("detailStatus"); status.className = `status-badge status-${pipeline.status}`; status.textContent = statusLabels[pipeline.status] || pipeline.status;
    byId("variantContext").hidden = !variant;
    byId("variantContext").textContent = variant ? `${variant.variant_id} · ${variant.structure_type} · ${variant.material} · ${variant.component}` : "";
    const metrics = [[pipeline.path_count, "Rechenwege"], [pipeline.blocked_path_count, "gesperrt"], [pipeline.variable_count, "Variablen"]];
    byId("detailMetrics").replaceChildren(...metrics.map(([value, label]) => { const box = make("div", "detail-metric"); box.append(make("strong", "", value), make("span", "", label)); return box; }));
    renderRules(pipeline); renderApplicability(pipeline); renderNormativeBasis(pipeline); renderPhases(pipeline); renderVariables(pipeline);
    const reportTemplates = pipeline.report_templates || [];
    byId("reportTemplateCount").textContent = `${reportTemplates.length} verknüpft`;
    byId("reportTemplates").replaceChildren(...reportTemplates.map((item) => {
      const link = make("a", "formula-link", item.title);
      link.href = item.url; link.target = "_top"; return link;
    }));
    byId("standards").replaceChildren(...(pipeline.standard_refs || []).map((item) => make("span", "formula-link", item)));
    byId("outputs").replaceChildren(...(pipeline.outputs || []).map((item) => make("span", "output-item", item)));
    byId("reviewGates").replaceChildren(...(pipeline.review_gates || []).map((item) => make("li", "", item)));
  }

  async function selectPipeline(pipelineId, variant = null) {
    state.selected = pipelineId; renderList();
    const response = await fetch(`${apiRoot}/pipelines/${encodeURIComponent(pipelineId)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return; showDetail(await response.json(), variant);
    const url = new URL(window.location.href); url.searchParams.set("pipeline", pipelineId); history.replaceState({}, "", url);
  }
  function closeDetail() {
    state.selected = null; byId("detailPanel").classList.remove("open"); byId("detailContent").hidden = true; byId("detailEmpty").hidden = false; if (state.mode === "templates") renderList();
    const url = new URL(window.location.href); url.searchParams.delete("pipeline"); history.replaceState({}, "", url);
  }

  async function initialize() {
    try {
      const response = await fetch(`${apiRoot}/pipelines`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json(); state.records = state.catalog.pipelines || [];
      byId("catalogVersion").textContent = `${state.catalog.schema_version} · ${state.records.length} Pipelines`;
      renderCoverage(); renderFilters(); renderStats(); renderList();
      const selected = new URL(window.location.href).searchParams.get("pipeline");
      if (selected && state.records.some((item) => item.pipeline_id === selected)) selectPipeline(selected);
    } catch (error) {
      byId("resultSummary").textContent = "Pipeline-Katalog konnte nicht geladen werden.";
      byId("pipelineList").append(make("div", "missing-note", String(error)));
    }
  }

  byId("pipelineSearch").addEventListener("input", (event) => { state.query = event.target.value; renderList(); });
  let variantSearchTimer;
  byId("pipelineSearch").addEventListener("input", () => { if (state.mode !== "variants") return; clearTimeout(variantSearchTimer); variantSearchTimer = setTimeout(() => { state.variantPage = 1; loadVariants(); }, 220); });
  document.querySelectorAll("#pipelineModes button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  byId("variantPrevious").addEventListener("click", () => { state.variantPage = Math.max(1, state.variantPage - 1); loadVariants(); });
  byId("variantNext").addEventListener("click", () => { state.variantPage += 1; loadVariants(); });
  byId("showAllCategories").addEventListener("click", () => { state.category = null; document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("active")); renderList(); });
  byId("showAllDomains").addEventListener("click", () => { state.domain = null; document.querySelectorAll("[data-domain]").forEach((item) => item.classList.remove("active")); state.variantPage = 1; state.mode === "variants" ? loadVariants() : renderList(); });
  byId("closeDetail").addEventListener("click", closeDetail);
  initialize();
})();
