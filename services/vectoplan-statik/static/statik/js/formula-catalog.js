(() => {
  "use strict";

  const apiRoot = document.body.dataset.apiRoot;
  const state = {
    catalog: null,
    records: [],
    query: "",
    category: null,
    statuses: new Set(),
    selected: null,
  };

  const byId = (id) => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const unknown = (value) => value === undefined || value === null || value === "" || value === "unvollständig";
  const statusLabel = (status) => ({
    implemented: "implementiert",
    implemented_bounded: "begrenzt implementiert",
    documented: "dokumentiert",
    incomplete: "unvollständig",
  }[status] || "unvollständig");
  const statusBadge = (status) => {
    const node = make("span", `status-badge status-${status}`, statusLabel(status));
    return node;
  };

  function sourceLocation(source) {
    const page = source.printed_page ?? source.pdf_page ?? "unvollständig";
    const pdf = source.pdf_page ?? "unvollständig";
    const pageText = String(page) === String(pdf) ? `Seite ${page}` : `Buchseite ${page} · PDF-Seite ${pdf}`;
    return `${pageText} · ${source.section || "unvollständig"}`;
  }

  function renderFilters() {
    const statuses = byId("statusFilters");
    statuses.replaceChildren();
    state.catalog.status_definitions.forEach((definition) => {
      state.statuses.add(definition.id);
      const button = make("button", "filter-chip active", definition.label);
      button.type = "button";
      button.title = definition.meaning;
      button.dataset.status = definition.id;
      button.addEventListener("click", () => {
        if (state.statuses.has(definition.id)) state.statuses.delete(definition.id);
        else state.statuses.add(definition.id);
        button.classList.toggle("active", state.statuses.has(definition.id));
        renderList();
      });
      statuses.append(button);
    });

    const nav = byId("categoryNavigation");
    nav.replaceChildren();
    state.catalog.categories.forEach((category) => {
      const count = state.records.filter((record) => record.category_id === category.id).length;
      const button = make("button", "category-button");
      button.type = "button";
      button.dataset.category = category.id;
      button.title = category.description;
      button.append(
        make("span", "category-number", String(category.order).padStart(2, "0")),
        make("span", "category-label", category.label),
        make("span", "category-count", count),
      );
      button.addEventListener("click", () => {
        state.category = state.category === category.id ? null : category.id;
        updateCategoryButtons();
        renderList();
      });
      nav.append(button);
    });
  }

  function updateCategoryButtons() {
    document.querySelectorAll(".category-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.category === state.category);
    });
  }

  function filteredRecords() {
    const needle = state.query.trim().toLocaleLowerCase("de");
    return state.records.filter((record) => {
      if (!state.statuses.has(record.status)) return false;
      if (state.category && record.category_id !== state.category) return false;
      if (!needle) return true;
      const haystack = [
        record.formula_id, record.title, record.equation, record.description,
        record.category_label, record.source?.short_title, record.source?.title,
        record.source?.section, ...(record.standard_refs || []), ...(record.tags || []),
      ].join(" ").toLocaleLowerCase("de");
      return haystack.includes(needle);
    });
  }

  function renderStats() {
    const stats = byId("catalogStats");
    stats.replaceChildren();
    const values = [
      [state.catalog.statistics.formula_count, "Ansätze"],
      [state.catalog.statistics.by_status.implemented + state.catalog.statistics.by_status.implemented_bounded, "rechenbar"],
      [state.catalog.statistics.by_status.incomplete, "offen"],
    ];
    values.forEach(([value, label]) => {
      const pill = make("div", "stat-pill");
      pill.append(make("strong", "", value), make("span", "", label));
      stats.append(pill);
    });
  }

  function formulaRow(record) {
    const row = make("button", `formula-row${state.selected === record.formula_id ? " selected" : ""}`);
    row.type = "button";
    row.dataset.formulaId = record.formula_id;
    row.setAttribute("aria-label", `${record.formula_id}: ${record.title}`);

    const main = make("span", "formula-main");
    const line = make("span", "formula-line");
    line.append(make("span", "formula-id", record.formula_id), make("span", "formula-title", record.title));
    main.append(line, make("span", "equation-preview", record.equation));

    const source = make("span", "formula-source");
    source.append(
      make("strong", "", record.source.short_title),
      make("span", "", sourceLocation(record.source)),
    );
    const standards = record.standard_refs?.length ? record.standard_refs.join(" · ") : "Normbezug: unvollständig";
    source.append(make("span", "standard-tag", standards));

    row.append(main, source, statusBadge(record.status));
    row.addEventListener("click", () => selectFormula(record.formula_id));
    return row;
  }

  function renderList() {
    const records = filteredRecords();
    const list = byId("formulaList");
    list.replaceChildren(...records.map(formulaRow));
    byId("emptyState").hidden = records.length > 0;
    const category = state.category ? state.catalog.categories.find((item) => item.id === state.category)?.label : "alle Kategorien";
    byId("resultSummary").textContent = `${records.length} von ${state.records.length} Ansätzen · ${category}`;
  }

  function renderStandards(record) {
    const container = byId("standardReferences");
    container.replaceChildren();
    if (!record.standard_refs?.length) {
      container.append(make("div", "missing-note", "Normbezug: unvollständig"));
      return;
    }
    const standardIndex = new Map(state.catalog.standard_families.map((item) => [item.id, item]));
    record.standard_refs.forEach((standardId) => {
      const standard = standardIndex.get(standardId);
      const card = make("div", "standard-card");
      card.append(
        make("strong", "", standard?.label || standardId),
        make("span", "", standard?.topic || "Detailzuordnung unvollständig"),
        make("span", "", standard?.current_reference || "Aktuelle Fassung: unvollständig"),
      );
      container.append(card);
    });
  }

  function renderProcessing(record) {
    const list = byId("processingSteps");
    list.replaceChildren();
    (record.processing?.steps || []).forEach((step) => {
      const item = make("li");
      item.append(make("strong", "", step.label), make("span", "", step.detail));
      list.append(item);
    });
  }

  function renderExample(record) {
    const example = record.processing?.example || {};
    const inputs = byId("exampleInputs");
    inputs.replaceChildren();
    if (example.inputs?.length) {
      example.inputs.forEach((input) => {
        const card = make("div", "example-input");
        card.append(make("span", "", input.label), make("strong", "", `${input.value} ${input.unit || ""}`.trim()));
        inputs.append(card);
      });
    } else {
      inputs.append(make("div", "missing-note", "Beispielwerte: unvollständig"));
    }
    const steps = example.steps || ["unvollständig"];
    byId("exampleSteps").textContent = steps.join(" → ");
    const result = example.result || { label: "Ergebnis", value: "unvollständig", unit: "" };
    const resultBox = byId("exampleResult");
    resultBox.replaceChildren(
      make("span", "", result.label || "Ergebnis"),
      make("strong", "", `${result.value} ${result.unit || ""}`.trim()),
    );
    if (result.assessment) resultBox.append(make("div", "result-assessment", result.assessment));
  }

  function renderVariables(record) {
    const table = byId("variableTable");
    table.replaceChildren();
    if (!record.variables?.length) {
      table.append(make("div", "variable-row", "Variablen: unvollständig"));
    } else {
      record.variables.forEach((variable) => {
        const row = make("div", "variable-row");
        const description = make("span", "variable-description");
        description.append(
          document.createTextNode(variable.description),
          make("code", "variable-id", variable.variable_id || "unvollständig"),
        );
        const bounds = variable.minimum === "unvollständig" && variable.maximum === "unvollständig"
          ? "Grenzen offen"
          : `${variable.minimum ?? "–"} … ${variable.maximum ?? "–"}`;
        row.append(
          make("strong", "", variable.symbol),
          description,
          make("span", "", variable.unit || "unvollständig"),
          make("span", "variable-bounds", bounds),
        );
        table.append(row);
      });
    }
    const assumptions = byId("assumptionList");
    assumptions.replaceChildren();
    (record.assumptions || ["unvollständig"]).forEach((assumption) => assumptions.append(make("li", "", assumption)));
  }

  function renderSource(record) {
    const source = record.source;
    byId("sourceTitle").textContent = source.title;
    byId("sourceLocation").textContent = sourceLocation(source);
    byId("sourceState").textContent = source.standard_state;
    byId("sourceReplacement").textContent = source.current_replacement;

    const officialLink = byId("officialSourceLink");
    officialLink.hidden = unknown(source.official_url);
    if (!officialLink.hidden) officialLink.href = source.official_url;

    const figure = byId("sourceExcerptFigure");
    const missing = byId("sourceExcerptMissing");
    if (unknown(source.excerpt_url)) {
      figure.hidden = true;
      missing.hidden = false;
    } else {
      figure.hidden = false;
      missing.hidden = true;
      byId("sourceExcerpt").src = source.excerpt_url;
      byId("sourceCaption").textContent = `${source.file_name} · ${sourceLocation(source)} · Ausschnitt zur Orientierung`;
    }
  }

  function renderCompleteness(record) {
    const missing = record.completeness?.missing || [];
    byId("completenessText").textContent = missing.length
      ? "Die folgenden Katalogfelder sind bewusst als unvollständig markiert."
      : "Methode, Fundstelle, Normbezug, Umsetzung, Test und Quellenausschnitt sind erfasst.";
    const container = byId("missingFields");
    container.replaceChildren();
    missing.forEach((field) => container.append(make("span", "missing-field", field)));
  }

  function showDetail(record) {
    byId("detailEmpty").hidden = true;
    byId("detailContent").hidden = false;
    byId("detailPanel").classList.add("open");
    byId("detailCategory").textContent = record.category_label;
    byId("detailId").textContent = record.formula_id;
    byId("detailTitle").textContent = record.title;
    byId("detailDescription").textContent = record.description;
    byId("detailEquation").textContent = record.equation;
    const badgeTarget = byId("detailStatus");
    badgeTarget.className = `status-badge status-${record.status}`;
    badgeTarget.textContent = statusLabel(record.status);
    renderSource(record);
    renderStandards(record);
    renderProcessing(record);
    renderExample(record);
    renderVariables(record);
    renderCompleteness(record);
  }

  async function selectFormula(formulaId) {
    state.selected = formulaId;
    renderList();
    const response = await fetch(`${apiRoot}/implementation-methods/${encodeURIComponent(formulaId)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const record = await response.json();
    showDetail(record);
    const url = new URL(window.location.href);
    url.searchParams.set("formel", formulaId);
    history.replaceState({}, "", url);
  }

  function closeDetail() {
    state.selected = null;
    byId("detailPanel").classList.remove("open");
    byId("detailContent").hidden = true;
    byId("detailEmpty").hidden = false;
    renderList();
    const url = new URL(window.location.href);
    url.searchParams.delete("formel");
    history.replaceState({}, "", url);
  }

  async function initialize() {
    try {
      const response = await fetch(`${apiRoot}/implementation-methods`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json();
      state.records = state.catalog.formulas || [];
      byId("catalogVersion").textContent = `${state.catalog.catalog_version} · ${state.records.length} Ansätze`;
      renderFilters();
      renderStats();
      renderList();
      const selected = new URL(window.location.href).searchParams.get("formel");
      if (selected && state.records.some((record) => record.formula_id === selected)) selectFormula(selected);
    } catch (error) {
      byId("resultSummary").textContent = "Methodenkatalog konnte nicht geladen werden.";
      byId("formulaList").append(make("div", "missing-note", String(error)));
    }
  }

  byId("formulaSearch").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderList();
  });
  byId("showAllCategories").addEventListener("click", () => {
    state.category = null;
    updateCategoryButtons();
    renderList();
  });
  byId("closeDetail").addEventListener("click", closeDetail);
  initialize();
})();
