(() => {
  "use strict";

  const body = document.body;
  const apiRoot = body.dataset.apiRoot || "/api/v1/statik";
  const state = {
    catalog: null,
    details: new Map(),
    outline: null,
    discipline: "all",
    query: "",
    selectedId: "",
    page: "all",
    variant: "regelfall",
    enabledModules: new Set(),
    disabledModules: new Set(),
    selectedChapterId: "",
  };

  const byId = (id) => document.getElementById(id);
  const list = byId("templateList");
  const search = byId("templateSearch");
  const filters = byId("disciplineFilters");
  const loading = byId("loadingState");
  const errorState = byId("errorState");
  const clearFilter = byId("clearFilter");

  const figureMarkup = {
    building: `
      <path class="thin" d="M42 179H384M75 179V72l88-44 183 58v93M75 72l181 54 90-40M163 28l183 58M163 28v98M256 126v53M112 91v88M208 110v69M300 112v67"/>
      <path class="primary" d="M82 80l80-39 174 53-80 22zM83 87l72 22v55l-72-22zM173 51l157 47v42l-157-47z"/>
      <path class="secondary" d="M176 112l34 10v35l-34-10zM271 116l33-15v41l-33 14z"/>
      <path class="dash" d="M58 194H365M58 189v10M365 189v10"/><text x="192" y="207">Tragsystem / Lastabtragung</text>`,
    hall: `
      <path class="heavy" d="M65 178V83l65-51 67 51v95M197 83l65-51 67 51v95M65 83h264M130 32h132"/>
      <path class="primary" d="M72 85l58-45 58 45v87H72zM205 85l57-45 58 45v87H205z"/>
      <path class="secondary" d="M130 40v132M262 40v132M88 116h84M221 116h83"/>
      <path class="load" d="M91 20v43m-5-8 5 8 5-8M131 8v32m-5-8 5 8 5-8M171 20v43m-5-8 5 8 5-8"/>
      <path class="dash" d="M47 193H348"/><text x="166" y="207">Rahmen · Verbände</text>`,
    bridge: `
      <path class="primary" d="M40 94h340v22H40z"/>
      <path class="heavy" d="M40 94h340M40 116h340"/>
      <path class="secondary" d="M94 116l-8 45h28l-8-45M201 116l-10 57h32l-10-57M310 116l-8 45h28l-8-45"/>
      <path class="thin" d="M65 90v-26h292v26M65 70h292M72 58v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12m25-12v12"/>
      <path class="dash" d="M47 179h323"/><text x="163" y="201">Überbau · Lager · Unterbau</text>`,
    tunnel: `
      <path class="thin" d="M25 174h370M47 174V89c0-71 86-91 163-58 75-33 163-13 163 58v85"/>
      <path class="primary" d="M70 174V95c0-52 61-70 140-40 77-30 139-12 139 40v79h-30V99c0-35-41-49-109-20-69-29-110-15-110 20v75z"/>
      <path class="secondary" d="M210 79v95M100 132h219M148 117h124"/>
      <path class="load" d="M95 32l18 31m-2-9 2 9-9-2M210 10v42m-5-8 5 8 5-8M326 32l-18 31m2-9-2 9 9-2"/>
      <text x="149" y="199">Tunnelquerschnitt · Baugrund</text>`,
    foundation: `
      <path class="primary" d="M120 100h180l43 53H77z"/>
      <path class="heavy" d="M120 100h180l43 53H77zM168 100V49h84v51"/>
      <path class="secondary" d="M178 49h64v-18h-64zM109 153v35M147 153v35M185 153v35M223 153v35M261 153v35M299 153v35"/>
      <path class="load" d="M210 5v35m-5-8 5 8 5-8M81 87l35 11m-9-7 9 7-10 1M339 87l-35 11m9-7-9 7 10 1"/>
      <path class="dash" d="M54 194h312"/><text x="150" y="210">Gründung · Bodenmodell</text>`,
    retaining: `
      <path class="primary" d="M187 31h36v142h98v18H120v-18h67z"/>
      <path class="heavy" d="M187 31h36v142h98M120 173h201v18H120z"/>
      <path class="thin" d="M223 58l116 27v88M223 85l116 28M223 112l116 29M223 139l116 29"/>
      <path class="load" d="M335 92l-76 0m9-5-9 5 9 5M335 120l-76 0m9-5-9 5 9 5M335 148l-76 0m9-5-9 5 9 5"/>
      <path class="dash" d="M55 191H365"/><text x="149" y="209">Erddruck · Standsicherheit</text>`,
    water: `
      <path class="primary" d="M80 79h260v96H80z"/>
      <path class="heavy" d="M80 79v96h260V79M161 79v96M260 79v96"/>
      <path class="thin" d="M30 109c20-10 39 10 59 0s39 10 59 0 39 10 59 0 39 10 59 0 39 10 59 0 39 10 59 0M30 125c20-10 39 10 59 0s39 10 59 0 39 10 59 0 39 10 59 0 39 10 59 0"/>
      <path class="load" d="M121 146v-42m-5 8 5-8 5 8M211 146v-42m-5 8 5-8 5 8M301 146v-42m-5 8 5-8 5 8"/>
      <text x="146" y="201">Wasserstände · Auftrieb</text>`,
    tower: `
      <path class="heavy" d="M174 181L205 22h12l31 159M151 181h120M183 136h56M190 101h42M197 65h28"/>
      <path class="thin" d="M205 22l34 114-65 45M217 22l-43 114 74 45M183 136l49-35-35-36 20-43M239 136l-42-35 28-36-20-43"/>
      <path class="load" d="M65 56h102m-10-5 10 5-10 5M68 96h92m-10-5 10 5-10 5M82 136h77m-10-5 10 5-10 5"/>
      <path class="dash" d="M58 190h305"/><text x="174" y="208">Turm · Wind</text>`,
    special: `
      <path class="primary" d="M129 50h163l26 122H103z"/>
      <path class="heavy" d="M129 50h163l26 122H103zM103 172h215M139 50V29h143v21"/>
      <path class="secondary" d="M160 78h102v63H160zM180 141v31M241 141v31"/>
      <path class="load" d="M210 5v60m-5-8 5 8 5-8M75 94h75m-9-5 9 5-9 5M345 94h-75m9-5-9 5 9 5"/>
      <path class="dash" d="M65 190h291"/><text x="151" y="208">Sondertragwerk · System</text>`,
    load_path: `
      <rect class="primary" x="34" y="30" width="90" height="38" rx="4"/><rect class="primary" x="165" y="86" width="90" height="38" rx="4"/><rect class="primary" x="296" y="144" width="90" height="38" rx="4"/>
      <path class="heavy" d="M124 49h43v56M255 105h43v58"/><path class="load" d="M151 99l16 6-16 6M282 157l16 6-16 6"/>
      <text x="51" y="53">Einwirkung</text><text x="181" y="109">Tragsystem</text><text x="314" y="167">Auflager</text><text x="140" y="204">Lastpfad · Reaktionen</text>`,
    actions: `
      <path class="heavy" d="M42 150h336M72 150v28M348 150v28"/><path class="load" d="M78 35v91m-6-10 6 10 6-10M130 35v91m-6-10 6 10 6-10M182 35v91m-6-10 6 10 6-10M234 35v91m-6-10 6 10 6-10M286 35v91m-6-10 6 10 6-10M338 35v91m-6-10 6 10 6-10"/>
      <text x="150" y="198">Flächen-/Linienlasten</text>`,
    bridge_actions: `
      <path class="heavy" d="M35 145h350M65 145v28M355 145v28"/><path class="primary" d="M70 116h72v25H70zM211 116h72v25h-72z"/><circle class="secondary" cx="88" cy="145" r="7"/><circle class="secondary" cx="125" cy="145" r="7"/><circle class="secondary" cx="229" cy="145" r="7"/><circle class="secondary" cx="266" cy="145" r="7"/>
      <path class="load" d="M106 43v54m-6-10 6 10 6-10M247 43v54m-6-10 6 10 6-10"/><text x="137" y="198">Verkehr · Temperatur · Wind</text>`,
    wind_actions: `
      <path class="heavy" d="M210 26v155M166 181h88"/><path class="thin" d="M178 61h64M174 102h72M170 143h80"/><path class="load" d="M40 58h116m-12-6 12 6-12 6M58 99h102m-12-6 12 6-12 6M82 140h82m-12-6 12 6-12 6"/>
      <path class="dash" d="M210 26c35 38 45 91 35 155"/><text x="155" y="204">Windprofil · Verformung</text>`,
    snow_wind_actions: `
      <path class="heavy" d="M62 165V91l73-55 74 55v74M209 91l73-55 76 55v74"/><path class="load" d="M105 17v50m-6-10 6 10 6-10M160 17v50m-6-10 6 10 6-10M270 17v50m-6-10 6 10 6-10M325 17v50m-6-10 6 10 6-10M30 113h46m-10-6 10 6-10 6"/>
      <text x="146" y="202">Schnee · Wind · Kran</text>`,
    results: `
      <path class="thin" d="M45 170h330M45 35v135"/><path class="primary" d="M55 154C98 143 121 102 161 111s54 39 92 19 52-78 112-89v113z"/><path class="heavy" d="M55 154C98 143 121 102 161 111s54 39 92 19 52-78 112-89"/>
      <path class="dash" d="M45 72h330"/><text x="51" y="67">Grenze</text><text x="148" y="202">Ergebnis · Ausnutzung</text>`,
  };

  const iconMarkup = {
    building: `<path d="M5 27V12l8-5 14 6v14M13 7v20M5 12l14 6 8-5M9 19v8m9-8v8m5-7v7"/>`,
    hall: `<path d="M4 27V13l7-7 7 7v14M18 13l7-7 4 7v14M4 13h25M11 6h14"/>`,
    bridge: `<path d="M3 12h26v5H3zM7 17l-1 9h4l-1-9m7 0-1 9h4l-1-9m7 0-1 9h4l-1-9M5 9h22"/>`,
    tunnel: `<path d="M4 27V16C4 4 28 4 28 16v11M8 27V17c0-8 16-8 16 0v10M16 13v14"/>`,
    foundation: `<path d="M8 12h16l5 8H3zM12 12V5h8v7M8 20v7m5-7v7m6-7v7m5-7v7"/>`,
    retaining: `<path d="M13 4h6v20h10v4H5v-4h8zM19 9l10 3m-10 3 10 3m-10 3 10 3"/>`,
    water: `<path d="M5 10h22v15H5zM12 10v15m8-15v15M2 16c3-3 5 3 8 0s5 3 8 0 5 3 8 0 4 2 5 1"/>`,
    tower: `<path d="M9 28L15 4h2l6 24M6 28h20M11 20h10m-9-6h8M14 8h4"/>`,
    special: `<path d="M9 7h14l4 20H5zM12 7V4h8v3M11 13h10v9H11z"/>`,
  };

  const text = (id, value) => {
    const node = byId(id);
    if (node) node.textContent = value ?? "–";
  };

  async function requestJson(path, options = {}) {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function disciplineById(id) {
    return state.catalog?.disciplines.find((item) => item.discipline_id === id);
  }

  function filteredTemplates() {
    if (!state.catalog) return [];
    const query = state.query.trim().toLocaleLowerCase("de-DE");
    return state.catalog.templates.filter((item) => {
      if (state.discipline !== "all" && item.discipline !== state.discipline) return false;
      if (!query) return true;
      return [item.title, item.short_title, item.family, item.summary, ...(item.tags || [])]
        .join(" ").toLocaleLowerCase("de-DE").includes(query);
    });
  }

  function renderFilters() {
    filters.replaceChildren();
    const entries = [
      { discipline_id: "all", label: "Alle Bereiche", accent: "#667085" },
      ...state.catalog.disciplines,
    ];
    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = entry.label;
      button.dataset.discipline = entry.discipline_id;
      button.className = `filter-${entry.discipline_id}`;
      button.classList.toggle("is-active", state.discipline === entry.discipline_id);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.discipline === entry.discipline_id ? "true" : "false");
      button.addEventListener("click", () => {
        state.discipline = entry.discipline_id;
        renderFilters();
        renderList();
      });
      filters.append(button);
    });
  }

  function createCard(item) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `template-card discipline-${item.discipline}`;
    card.dataset.templateId = item.template_id;
    card.classList.toggle("is-active", item.template_id === state.selectedId);
    card.setAttribute("aria-pressed", item.template_id === state.selectedId ? "true" : "false");

    const icon = document.createElement("span");
    icon.className = "template-card-icon";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 32 32");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = iconMarkup[item.system_figure] || iconMarkup.special;
    icon.append(svg);

    const copy = document.createElement("span");
    copy.className = "template-card-copy";
    const titleNode = document.createElement("strong");
    titleNode.textContent = item.short_title;
    const familyNode = document.createElement("span");
    familyNode.textContent = item.family;
    const tags = document.createElement("span");
    tags.className = "template-card-tags";
    (item.tags || []).slice(0, 2).forEach((tag) => {
      const chip = document.createElement("i");
      chip.textContent = tag;
      tags.append(chip);
    });
    copy.append(titleNode, familyNode, tags);

    const arrow = document.createElement("span");
    arrow.className = "template-card-arrow";
    arrow.textContent = "›";
    arrow.setAttribute("aria-hidden", "true");
    card.append(icon, copy, arrow);
    card.addEventListener("click", () => selectTemplate(item.template_id));
    return card;
  }

  function renderList() {
    const items = filteredTemplates();
    list.replaceChildren();
    text("libraryResult", `${items.length} von ${state.catalog.templates.length} Vorlagen`);
    clearFilter.hidden = !state.query && state.discipline === "all";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "template-empty";
      const strong = document.createElement("strong");
      strong.textContent = "Keine passende Vorlage";
      const span = document.createElement("span");
      span.textContent = "Suchbegriff oder Bereich ändern.";
      empty.append(strong, span);
      list.append(empty);
      return;
    }

    const groups = new Map();
    items.forEach((item) => {
      const key = state.discipline === "all" ? disciplineById(item.discipline)?.label || item.discipline : item.family;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    groups.forEach((groupItems, label) => {
      const heading = document.createElement("div");
      heading.className = "template-group-heading";
      heading.textContent = label;
      list.append(heading);
      groupItems.forEach((item) => list.append(createCard(item)));
    });
  }

  async function loadDetail(templateId) {
    if (!state.details.has(templateId)) {
      state.details.set(templateId, await requestJson(`/report-templates/${encodeURIComponent(templateId)}`));
    }
    return state.details.get(templateId);
  }

  async function composeOutline(templateId = state.selectedId) {
    return requestJson(`/report-templates/${encodeURIComponent(templateId)}/outline`, {
      method: "POST",
      body: JSON.stringify({
        variant: state.variant,
        enabled_modules: [...state.enabledModules],
        disabled_modules: [...state.disabledModules],
      }),
    });
  }

  async function selectTemplate(templateId, updateUrl = true) {
    const templateChanged = state.selectedId !== templateId;
    state.selectedId = templateId;
    if (templateChanged) {
      state.enabledModules.clear();
      state.disabledModules.clear();
      state.selectedChapterId = "";
    }
    renderList();
    try {
      const [detail, outline] = await Promise.all([loadDetail(templateId), composeOutline(templateId)]);
      state.outline = outline;
      renderDetail(detail);
      renderOutline(outline);
      if (updateUrl) updateLocation();
    } catch (error) {
      showError(error);
    }
  }

  function renderFigure(targetId, type) {
    const target = byId(targetId);
    if (target) target.innerHTML = figureMarkup[type] || figureMarkup.special;
  }

  function renderVisualizationPlan(detail) {
    const target = byId("automaticVisualizations");
    if (!target) return;
    target.replaceChildren();
    (detail.visualization_plan || []).forEach((visualization, index) => {
      const card = document.createElement("section");
      card.className = "automatic-visualization-card";
      const header = document.createElement("header");
      header.append(Object.assign(document.createElement("b"), {textContent: String(index + 1).padStart(2, "0")}), Object.assign(document.createElement("strong"), {textContent: visualization.title}));
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 420 215");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", visualization.title);
      svg.classList.add("system-figure");
      svg.innerHTML = figureMarkup[visualization.figure_kind] || figureMarkup.special;
      const footer = document.createElement("footer");
      const source = (visualization.source_pipeline_ids || []).join(" · ");
      footer.append(Object.assign(document.createElement("code"), {textContent: visualization.data_pointer}), Object.assign(document.createElement("span"), {textContent: source || "Pipeline unvollständig"}));
      card.append(header, svg, footer);
      target.append(card);
    });
    const gate = detail.pipeline_binding?.release_gate;
    text("visualizationGate", gate?.passed ? "Pipeline-Gate bestätigt" : "Vorschau · Fachprüfung offen");
  }

  function renderTags(tags) {
    const target = byId("coverTags");
    target.replaceChildren();
    tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.textContent = tag;
      target.append(chip);
    });
  }

  function renderChapters(chapters) {
    const target = byId("chapterList");
    target.replaceChildren();
    chapters.forEach((chapter) => {
      const li = document.createElement("li");
      const number = document.createElement("b");
      number.textContent = chapter.number;
      const copy = document.createElement("div");
      const titleNode = document.createElement("strong");
      titleNode.textContent = chapter.title;
      const meta = document.createElement("small");
      meta.textContent = `${chapter.kind} · ${chapter.repeatable ? "wiederholbar" : "einmalig"}`;
      copy.append(titleNode, meta);
      const source = document.createElement("i");
      source.className = `source-${chapter.source}`;
      source.title = `Quelle: ${chapter.source}`;
      li.append(number, copy, source);
      target.append(li);
    });
  }

  function renderPipeline(binding) {
    const target = byId("pipelineList");
    target.replaceChildren();
    binding.stages.forEach((stage, index) => {
      const li = document.createElement("li");
      const number = document.createElement("b");
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("div");
      const titleNode = document.createElement("strong");
      titleNode.textContent = stage.label;
      const path = document.createElement("code");
      path.textContent = stage.source_path;
      copy.append(titleNode, path);
      const targets = document.createElement("span");
      targets.textContent = `${stage.targets.length} Ziele`;
      li.append(number, copy, targets);
      target.append(li);
    });
    (binding.pipelines || []).forEach((pipeline, index) => {
      const li = document.createElement("li");
      const number = document.createElement("b"); number.textContent = `P${index + 1}`;
      const copy = document.createElement("div");
      const titleNode = document.createElement("strong"); titleNode.textContent = pipeline.pipeline_id;
      const path = document.createElement("code"); path.textContent = pipeline.title;
      copy.append(titleNode, path);
      const stateNode = document.createElement("span"); stateNode.textContent = pipeline.normative_gate_passed ? "bestätigt" : "offen";
      li.append(number, copy, stateNode); target.append(li);
    });
  }

  function renderVariables(variables) {
    const target = byId("variableList");
    target.replaceChildren();
    variables.slice(0, 8).forEach((variable) => {
      const chip = document.createElement("div");
      chip.className = "variable-chip";
      const id = document.createElement("strong");
      id.textContent = `{${variable.slot_id}}`;
      const path = document.createElement("span");
      path.textContent = variable.json_pointer;
      chip.append(id, path);
      target.append(chip);
    });
  }

  function requirementLabel(requirement) {
    return { required: "Pflicht", conditional: "bedingt", optional: "optional" }[requirement] || requirement;
  }

  function renderOutlineGroups(outline) {
    const target = byId("outlineGroups");
    target.replaceChildren();
    outline.groups.forEach((group) => {
      const section = document.createElement("section");
      section.className = "outline-group";
      const header = document.createElement("header");
      const number = document.createElement("b");
      number.textContent = group.number;
      const titleNode = document.createElement("strong");
      titleNode.textContent = group.title;
      const count = document.createElement("small");
      count.textContent = `${group.chapter_count} Kapitel`;
      header.append(number, titleNode, count);
      const chapters = document.createElement("ol");
      outline.chapters.filter((chapter) => chapter.group === group.group_id).forEach((chapter) => {
        const li = document.createElement("li");
        const chapterNumber = document.createElement("b");
        chapterNumber.textContent = chapter.number;
        const chapterTitle = document.createElement("span");
        const dot = document.createElement("i");
        dot.className = chapter.activation.requirement;
        chapterTitle.append(dot, document.createTextNode(chapter.title));
        const pages = document.createElement("small");
        pages.textContent = `${chapter.page_range[0]}–${chapter.page_range[1]} S.`;
        li.append(chapterNumber, chapterTitle, pages);
        chapters.append(li);
      });
      section.append(header, chapters);
      target.append(section);
    });
  }

  function renderPositionGroups(outline) {
    const target = byId("positionGroups");
    target.replaceChildren();
    outline.position_groups.forEach((label) => {
      const chip = document.createElement("span");
      chip.textContent = label;
      target.append(chip);
    });
    text("positionGroupCount", `${outline.position_groups.length} Gruppen`);
  }

  function renderScopeModules(outline) {
    const target = byId("scopeModuleList");
    if (!target) return;
    target.replaceChildren();
    outline.profile.groups.forEach((group) => {
      const modules = outline.available_modules.filter((module) => module.group === group.group_id);
      if (!modules.length) return;
      const heading = document.createElement("div");
      heading.className = "scope-group-title";
      heading.textContent = group.title;
      target.append(heading);
      modules.forEach((module) => {
        const row = document.createElement("label");
        row.className = "scope-module";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = module.activation.active;
        input.disabled = module.activation.requirement === "required";
        input.dataset.moduleId = module.module_id;
        input.addEventListener("change", async () => {
          if (input.checked) {
            state.enabledModules.add(module.module_id);
            state.disabledModules.delete(module.module_id);
          } else {
            state.disabledModules.add(module.module_id);
            state.enabledModules.delete(module.module_id);
          }
          await refreshOutline();
        });
        const copy = document.createElement("span");
        copy.className = "scope-module-copy";
        const titleNode = document.createElement("strong");
        titleNode.textContent = module.title;
        const reason = document.createElement("small");
        reason.textContent = module.activation.reason;
        copy.append(titleNode, reason);
        const badge = document.createElement("b");
        badge.className = module.activation.requirement;
        badge.textContent = requirementLabel(module.activation.requirement);
        row.append(input, copy, badge);
        target.append(row);
      });
    });
    const changed = state.enabledModules.size + state.disabledModules.size;
    text("scopeChangeCount", changed);
    text("scopeModuleSummary", `${outline.chapters.length} von ${outline.available_modules.length} Modulen aktiv`);
  }

  function renderChapterSelector(outline) {
    const select = byId("chapterSelect");
    select.replaceChildren();
    outline.chapters.forEach((chapter) => {
      const option = document.createElement("option");
      option.value = chapter.module_id;
      option.textContent = `${chapter.number} · ${chapter.title}`;
      select.append(option);
    });
    const selectedExists = outline.chapters.some((chapter) => chapter.module_id === state.selectedChapterId);
    if (!selectedExists) {
      const representative = outline.chapters.find((chapter) => chapter.calculations.length && chapter.section_template.blocks.some(
        (block) => /(sketch|diagram|figure|gallery|profile|mesh|contour|reinforcement|timeline|flow)/i.test(block.kind),
      ))
        || outline.chapters.find((chapter) => chapter.calculations.length)
        || outline.chapters[0];
      state.selectedChapterId = representative?.module_id || "";
    }
    select.value = state.selectedChapterId;
    renderChapter(outline);
  }

  function fillList(id, items, emptyLabel) {
    const target = byId(id);
    target.replaceChildren();
    (items.length ? items : [emptyLabel]).slice(0, 6).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      target.append(li);
    });
  }

  function renderChapter(outline = state.outline) {
    if (!outline) return;
    const chapter = outline.chapters.find((item) => item.module_id === state.selectedChapterId)
      || outline.chapters[0];
    if (!chapter) return;
    state.selectedChapterId = chapter.module_id;
    byId("chapterSelect").value = chapter.module_id;
    text("chapterRunningNumber", `KAPITEL ${chapter.number}`);
    text("chapterGroupLabel", `${chapter.group_title} · ${requirementLabel(chapter.activation.requirement)}`);
    text("chapterTemplateTitle", chapter.title);
    text("chapterTemplatePurpose", chapter.section_template.purpose);
    text("chapterSectionTemplate", chapter.section_template_id);
    text("chapterBindingPath", chapter.section_template.blocks[0]?.binding || "/calculations");
    text("chapterRepeatRule", chapter.repeat_by === "once" ? "einmal je Akte" : chapter.repeat_by);
    text("chapterPageRange", `${chapter.page_range[0]}–${chapter.page_range[1]} Seiten`);
    text("chapterMediaSlots", `${chapter.sketch_slots} Skizzen · ${chapter.table_slots} Tabellen`);
    text("chapterFooterNumber", `Kapitel ${chapter.number}`);
    fillList("chapterCalculations", chapter.calculations, "Text-/Registerkapitel ohne eigenen Rechenkern");
    fillList("chapterOutputs", chapter.outputs, "Kapitelinhalt");

    const target = byId("sectionBlockFlow");
    target.replaceChildren();
    chapter.section_template.blocks.forEach((block, index) => {
      const row = document.createElement("section");
      const visual = /(sketch|diagram|figure|gallery|profile|mesh|contour|reinforcement|timeline|flow)/i.test(block.kind);
      row.className = `section-block kind-${block.kind}${visual ? " is-visual" : ""}`;
      const number = document.createElement("b");
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("div");
      copy.className = "section-block-copy";
      const label = document.createElement("strong");
      label.textContent = block.label;
      const binding = document.createElement("code");
      binding.textContent = `${block.kind} · ${block.binding}`;
      copy.append(label, binding);
      const status = document.createElement("span");
      status.textContent = block.required ? "Pflichtblock" : "bei Bedarf";
      row.append(number, copy, status);
      target.append(row);
    });
  }

  function renderOutline(outline) {
    state.outline = outline;
    const stats = outline.statistics;
    text("outlineChapterStat", stats.chapter_count);
    text("outlinePageStat", `${stats.estimated_pages_low}–${stats.estimated_pages_high}`);
    text("outlineBlockStat", stats.block_template_count);
    text("outlineSheetChapterCount", stats.chapter_count);
    text("outlineSheetPages", `${stats.estimated_pages_low}–${stats.estimated_pages_high}`);
    text("outlineSheetCalculationCount", stats.calculation_count);
    text("outlineVariantLabel", outline.variant.label.toLocaleUpperCase("de-DE"));
    text("outlineTitle", outline.outline_title);
    text("outlineDescription", outline.variant.description);
    text("pipelineCount", `${stats.calculation_count} Rechenschemata · ${stats.chapter_count} Kapitel`);
    text("chapterCount", `${stats.chapter_count} Kapitel`);
    renderOutlineGroups(outline);
    renderPositionGroups(outline);
    renderScopeModules(outline);
    renderChapterSelector(outline);
    renderChapters(outline.groups.map((group) => ({
      number: group.number,
      title: group.title,
      kind: `${group.chapter_count} aktive Kapitel`,
      repeatable: false,
      source: "hybrid",
    })));
    document.querySelectorAll("[data-variant-target]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.variantTarget === outline.variant.variant_id);
    });
  }

  async function refreshOutline() {
    try {
      const outline = await composeOutline();
      renderOutline(outline);
      updateLocation();
    } catch (error) {
      showError(error);
    }
  }

  function renderDetail(detail) {
    body.dataset.discipline = detail.discipline;
    const preview = detail.preview;
    const values = preview.sample_values;
    const check = preview.check;
    const utilization = Number(check.utilization || 0);
    const discipline = disciplineById(detail.discipline);

    text("selectedFamily", `${discipline?.label || detail.discipline} · ${detail.family}`);
    text("selectedTitle", detail.title);
    text("selectedSummary", detail.summary);
    text("variableCount", `${detail.variable_slots.length} Variablen-Slots`);
    text("pipelineProfile", detail.pipeline_binding.label);
    text("pipelineCount", `${detail.pipeline_binding.stages.length} Pipeline-Stufen`);
    text("pipelineProfileShort", detail.pipeline_binding.profile_id);
    text("variableCountShort", `${detail.variable_slots.length} Slots`);

    ["coverProjectName", "positionProjectName", "structureProjectName", "outlineProjectName", "chapterProjectName"].forEach((id) => text(id, preview.project_name));
    text("coverTemplateTitle", detail.title);
    text("coverTemplateId", detail.template_id);
    text("positionTemplateId", detail.template_id);
    text("structureTemplateId", detail.template_id);
    text("outlineTemplateId", detail.template_id);
    text("chapterTemplateId", detail.template_id);
    text("structureTemplateTitle", detail.title);
    text("visualizationProjectName", preview.project_name);
    text("visualizationTemplateId", detail.template_id);
    text("positionRef", preview.position_ref);
    text("positionTitle", preview.position_title);
    text("sampleSupport", values.support);
    text("sampleGeometry", values.geometry);
    text("sampleMaterial", values.material);
    text("sampleGk", values.gk);
    text("sampleQk", values.qk);
    text("loadGk", values.gk);
    text("loadQk", values.qk);
    text("sampleResult", values.result);
    text("checkLabel", check.label);
    text("checkDemand", check.demand);
    text("checkResistance", check.resistance);
    text("checkUtilization", `${utilization} %`);
    text("matrixPosition", preview.position_ref);
    text("matrixCheck", check.label);
    text("matrixDemand", check.demand);
    text("matrixResistance", check.resistance);
    text("matrixUtilization", `${utilization} %`);
    byId("checkMeter").value = utilization;

    renderTags(detail.tags || []);
    renderFigure("coverFigure", detail.system_figure);
    renderFigure("positionFigure", detail.system_figure);
    renderPipeline(detail.pipeline_binding);
    renderVariables(detail.variable_slots);
    renderVisualizationPlan(detail);
  }

  function setPage(page, updateUrl = true) {
    state.page = "all";
    document.querySelectorAll("[data-preview-page]").forEach((pageNode) => {
      pageNode.classList.add("is-visible");
      pageNode.hidden = false;
    });
    if (updateUrl) updateLocation();
  }

  function updateLocation() {
    const url = new URL(window.location.href);
    if (state.selectedId) url.searchParams.set("vorlage", state.selectedId);
    url.searchParams.delete("seite");
    url.searchParams.set("umfang", state.variant);
    history.replaceState({ templateId: state.selectedId, page: state.page, variant: state.variant }, "", url);
  }

  function showError(error) {
    errorState.hidden = false;
    errorState.querySelector("strong").textContent = `Vorlagen konnten nicht geladen werden: ${error.message}`;
    loading.hidden = true;
  }

  async function initialize() {
    loading.hidden = false;
    errorState.hidden = true;
    try {
      state.catalog = await requestJson("/report-templates");
      text("templateTotal", state.catalog.statistics.template_count);
      renderFilters();
      const url = new URL(window.location.href);
      const requestedVariant = url.searchParams.get("umfang");
      state.variant = ["regelfall", "vollstaendig", "prueffassung"].includes(requestedVariant)
        ? requestedVariant
        : "regelfall";
      const requestedId = url.searchParams.get("vorlage");
      const initial = state.catalog.templates.some((item) => item.template_id === requestedId)
        ? requestedId
        : state.catalog.templates[0]?.template_id;
      setPage("all", false);
      await selectTemplate(initial, false);
      renderList();
      updateLocation();
      loading.hidden = true;
    } catch (error) {
      showError(error);
    }
  }

  search.addEventListener("input", () => {
    state.query = search.value;
    renderList();
  });
  clearFilter.addEventListener("click", () => {
    state.query = "";
    state.discipline = "all";
    search.value = "";
    renderFilters();
    renderList();
  });
  document.querySelectorAll("[data-variant-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.variant = button.dataset.variantTarget;
      await refreshOutline();
    });
  });
  byId("chapterSelect").addEventListener("change", (event) => {
    state.selectedChapterId = event.target.value;
    renderChapter();
  });
  byId("scopeToggle")?.addEventListener("click", () => {
    const panel = byId("scopePanel");
    panel.hidden = !panel.hidden;
    byId("scopeToggle").setAttribute("aria-expanded", panel.hidden ? "false" : "true");
  });
  byId("scopeClose")?.addEventListener("click", () => {
    byId("scopePanel").hidden = true;
    byId("scopeToggle").setAttribute("aria-expanded", "false");
  });
  byId("scopeReset")?.addEventListener("click", async () => {
    state.enabledModules.clear();
    state.disabledModules.clear();
    await refreshOutline();
  });
  byId("retryButton").addEventListener("click", initialize);
  document.addEventListener("keydown", (event) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    if (!typing && event.key.toLocaleLowerCase("de-DE") === "f") {
      event.preventDefault();
      search.focus();
    }
    if (event.key === "Escape") {
      const scopePanel = byId("scopePanel");
      if (scopePanel && !scopePanel.hidden) {
        scopePanel.hidden = true;
        byId("scopeToggle")?.setAttribute("aria-expanded", "false");
      } else if (document.activeElement === search) {
        search.value = "";
        state.query = "";
        renderList();
        search.blur();
      }
    }
  });

  initialize();
})();
