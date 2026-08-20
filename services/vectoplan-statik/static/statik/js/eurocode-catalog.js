(() => {
  "use strict";
  const apiRoot = document.body.dataset.apiRoot;
  const state = { catalog: null, family: "", kind: "", confidence: "", topic: "", query: "", page: 1, pageSize: 50, selected: "", request: 0 };
  const byId = (id) => document.getElementById(id);
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };
  const kindLabel = (kind) => ({ base_standard: "Stammnorm", national_annex: "Nationaler Anhang", amendment: "Änderung", corrigendum: "Berichtigung" }[kind] || kind || "unvollständig");
  const topicLabel = (topic) => ({
    actions: "Einwirkungen", combinations: "Kombinationen", analysis: "Tragwerksanalyse", resistance: "Tragfähigkeit",
    serviceability: "Gebrauchstauglichkeit", stability: "Stabilität", fire: "Brand", fatigue: "Ermüdung",
    connections: "Verbindungen", materials: "Materialkennwerte", detailing: "Konstruktionsregeln", concrete: "Betonbau",
    steel: "Stahlbau", composite: "Verbundbau", timber: "Holzbau", masonry: "Mauerwerk", geotechnics: "Geotechnik",
    seismic: "Erdbeben", aluminium: "Aluminium"
  }[topic] || topic);

  function queryUrl() {
    const url = new URL(`${apiRoot}/eurocodes/rules`, window.location.origin);
    url.searchParams.set("page", state.page);
    url.searchParams.set("page_size", state.pageSize);
    if (state.query) url.searchParams.set("q", state.query);
    if (state.family) url.searchParams.set("family", state.family);
    if (state.kind) url.searchParams.set("document_kind", state.kind);
    if (state.confidence) url.searchParams.set("confidence", state.confidence);
    if (state.topic) url.searchParams.set("topic", state.topic);
    return url;
  }

  function renderStats() {
    const stats = state.catalog.statistics;
    const target = byId("catalogStats");
    target.replaceChildren();
    [[stats.documents, "Dokumente"], [stats.pages, "Seiten"], [stats.rules, "Regelstellen"], [stats.weak_or_scanned_pages, "schwache Seiten"]].forEach(([value, label]) => {
      const pill = make("div", "stat-pill"); pill.append(make("strong", "", Number(value).toLocaleString("de-DE")), make("span", "", label)); target.append(pill);
    });
  }

  function renderFamilies() {
    const nav = byId("familyNavigation");
    const coverage = byId("coverageStrip");
    nav.replaceChildren(); coverage.replaceChildren();
    state.catalog.families.forEach((family) => {
      const button = make("button", `category-button${state.family === family.id ? " active" : ""}`);
      button.type = "button"; button.dataset.family = family.id;
      button.append(make("span", "category-number", family.id), make("span", "category-label", family.title), make("span", "category-count", family.equation_candidates.toLocaleString("de-DE")));
      button.addEventListener("click", () => selectFamily(family.id)); nav.append(button);
      const card = make("button", `coverage-card${state.family === family.id ? " active" : ""}`);
      card.type = "button"; card.dataset.family = family.id;
      card.append(make("strong", "", family.id), make("span", "", `${family.documents} Dok. · ${family.pages} S.`), make("span", "", `${family.equation_candidates.toLocaleString("de-DE")} Stellen`));
      card.addEventListener("click", () => selectFamily(family.id)); coverage.append(card);
    });
  }

  function selectFamily(family) {
    state.family = state.family === family ? "" : family; state.page = 1; renderFamilies(); loadRules();
  }

  function renderTopics() {
    const select = byId("topic");
    Object.keys(state.catalog.statistics.by_topic).sort((a, b) => topicLabel(a).localeCompare(topicLabel(b), "de")).forEach((topic) => {
      const option = make("option", "", `${topicLabel(topic)} (${state.catalog.statistics.by_topic[topic].toLocaleString("de-DE")})`);
      option.value = topic; select.append(option);
    });
  }

  function ruleRow(rule) {
    const row = make("button", `formula-row eurocode-rule-row${state.selected === rule.rule_id ? " selected" : ""}`);
    row.type = "button"; row.dataset.ruleId = rule.rule_id;
    const main = make("span", "formula-main");
    const line = make("span", "formula-line"); line.append(make("span", "formula-id", rule.equation_number === "unvollständig" ? rule.rule_id : `Gl. (${rule.equation_number})`), make("span", "formula-title", rule.title.replace(/^Gleichung \([^)]*\) · /, "")));
    main.append(line, make("span", "equation-preview", rule.equation_text), make("span", "rule-topic", topicLabel(rule.topic)));
    const source = make("span", "formula-source");
    source.append(make("strong", "", rule.designation), make("span", "", `PDF-Seite ${rule.source.pdf_page} · Abschnitt ${rule.source.clause}`), make("span", "standard-tag", kindLabel(rule.document_kind)));
    const status = make("span", ""); status.append(make("span", "status-badge status-incomplete", "unvollständig"), make("span", "confidence", `Erkennung: ${rule.confidence}`));
    row.append(main, source, status); row.addEventListener("click", () => selectRule(rule.rule_id)); return row;
  }

  async function loadRules() {
    const request = ++state.request;
    byId("resultSummary").textContent = "Regelstellen werden geladen …";
    const response = await fetch(queryUrl(), { headers: { Accept: "application/json" } });
    if (!response.ok || request !== state.request) return;
    const payload = await response.json();
    if (request !== state.request) return;
    const list = byId("ruleList"); list.replaceChildren(...payload.items.map(ruleRow));
    byId("emptyState").hidden = payload.items.length > 0;
    const familyText = state.family ? ` · ${state.family}` : " · EC1–EC9";
    byId("resultSummary").textContent = `${payload.pagination.total.toLocaleString("de-DE")} Treffer${familyText}`;
    byId("pageStatus").textContent = `Seite ${payload.pagination.page} von ${payload.pagination.page_count}`;
    byId("previousPage").disabled = !payload.pagination.has_previous;
    byId("nextPage").disabled = !payload.pagination.has_next;
    byId("previousPage").dataset.page = Math.max(1, payload.pagination.page - 1);
    byId("nextPage").dataset.page = Math.min(payload.pagination.page_count, payload.pagination.page + 1);
  }

  async function selectRule(ruleId) {
    state.selected = ruleId; await loadRules();
    const response = await fetch(`${apiRoot}/eurocodes/rules/${encodeURIComponent(ruleId)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return; const rule = await response.json();
    byId("detailEmpty").hidden = true; byId("detailContent").hidden = false; byId("detailPanel").classList.add("open");
    byId("detailFamily").textContent = `${rule.eurocode_family} · ${rule.family_title}`;
    byId("detailId").textContent = rule.rule_id; byId("detailTitle").textContent = rule.title;
    byId("detailEquation").textContent = rule.equation_text;
    byId("detailDesignation").textContent = rule.designation; byId("detailFile").textContent = rule.source.file_name;
    byId("detailLocation").textContent = `PDF-Seite ${rule.source.pdf_page} · Abschnitt ${rule.source.clause} ${rule.source.section}`;
    byId("detailKind").textContent = kindLabel(rule.document_kind); byId("detailExcerpt").textContent = rule.source_excerpt;
    byId("detailConfidence").textContent = rule.confidence;
    const url = new URL(window.location.href); url.searchParams.set("regel", ruleId); history.replaceState({}, "", url);
  }

  function closeDetail() {
    state.selected = ""; byId("detailPanel").classList.remove("open"); byId("detailContent").hidden = true; byId("detailEmpty").hidden = false;
    const url = new URL(window.location.href); url.searchParams.delete("regel"); history.replaceState({}, "", url); loadRules();
  }

  function bindFilters() {
    let timer;
    byId("eurocodeSearch").addEventListener("input", (event) => { clearTimeout(timer); timer = setTimeout(() => { state.query = event.target.value.trim(); state.page = 1; loadRules(); }, 220); });
    [["documentKind", "kind"], ["confidence", "confidence"], ["topic", "topic"]].forEach(([id, key]) => byId(id).addEventListener("change", (event) => { state[key] = event.target.value; state.page = 1; loadRules(); }));
    byId("allFamilies").addEventListener("click", () => { state.family = ""; state.page = 1; renderFamilies(); loadRules(); });
    byId("previousPage").addEventListener("click", (event) => { state.page = Number(event.currentTarget.dataset.page); loadRules(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    byId("nextPage").addEventListener("click", (event) => { state.page = Number(event.currentTarget.dataset.page); loadRules(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    byId("closeDetail").addEventListener("click", closeDetail);
  }

  async function initialize() {
    try {
      const response = await fetch(`${apiRoot}/eurocodes`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`); state.catalog = await response.json();
      byId("catalogVersion").textContent = `${state.catalog.schema_version} · ${state.catalog.statistics.rules.toLocaleString("de-DE")} Stellen`;
      renderStats(); renderFamilies(); renderTopics(); bindFilters(); await loadRules();
      const selected = new URL(window.location.href).searchParams.get("regel"); if (selected) selectRule(selected);
    } catch (error) { byId("resultSummary").textContent = `Eurocode-Register konnte nicht geladen werden: ${error}`; }
  }
  initialize();
})();
