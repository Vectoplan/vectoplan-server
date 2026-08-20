(() => {
  "use strict";
  const apiRoot = document.body.dataset.apiRoot;
  const frame = document.getElementById("catalogFrame");
  const loading = document.getElementById("frameLoading");
  const areas = {
    eurocodes: { path: "/statik/formelkatalog", title: "Eurocode-Formelkatalog", detail: "regel" },
    rechenwege: { path: "/statik/rechenwege", title: "Rechenwege", detail: "rechenweg" },
    pipelines: { path: "/statik/pipelines", title: "Pipelines", detail: "pipeline" },
    methoden: { path: "/statik/methoden", title: "Rechenmethoden", detail: "formel" },
    berechnungstemplates: { path: "/statik/ausgabevorlagen", title: "Berechnungstemplate", detail: "vorlage" },
  };
  const currentArea = () => {
    const value = new URL(window.location.href).searchParams.get("bereich") || "eurocodes";
    return areas[value] ? value : "eurocodes";
  };
  function frameUrl(area) {
    const current = new URL(window.location.href);
    const target = new URL(areas[area].path, window.location.origin);
    target.searchParams.set("embedded", "1");
    const detailValue = current.searchParams.get(areas[area].detail);
    if (detailValue) target.searchParams.set(areas[area].detail, detailValue);
    return `${target.pathname}${target.search}`;
  }
  function openArea(area, updateHistory = true) {
    const selected = areas[area] ? area : "eurocodes";
    document.querySelectorAll("#catalogTabs button").forEach((button) => {
      button.classList.toggle("active", button.dataset.area === selected);
      button.setAttribute("aria-current", button.dataset.area === selected ? "page" : "false");
    });
    loading.classList.remove("hidden");
    frame.title = areas[selected].title;
    frame.src = frameUrl(selected);
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("bereich", selected);
      history.pushState({ area: selected }, "", url);
    }
  }
  async function loadCounts() {
    const results = await Promise.allSettled([
      fetch(`${apiRoot}/eurocodes`).then((response) => response.json()),
      fetch(`${apiRoot}/calculation-paths`).then((response) => response.json()),
      fetch(`${apiRoot}/pipelines`).then((response) => response.json()),
      fetch(`${apiRoot}/implementation-methods`).then((response) => response.json()),
      fetch(`${apiRoot}/report-templates`).then((response) => response.json()),
    ]);
    if (results[0].status === "fulfilled") document.getElementById("eurocodeCount").textContent = Number(results[0].value.statistics?.rules || 0).toLocaleString("de-DE");
    if (results[1].status === "fulfilled") document.getElementById("pathCount").textContent = results[1].value.statistics?.path_count ?? "–";
    if (results[2].status === "fulfilled") document.getElementById("pipelineCount").textContent = results[2].value.statistics?.pipeline_count ?? "–";
    if (results[3].status === "fulfilled") document.getElementById("methodCount").textContent = results[3].value.statistics?.formula_count ?? "–";
    if (results[4].status === "fulfilled") document.getElementById("templateCount").textContent = results[4].value.statistics?.template_count ?? "–";
  }
  document.querySelectorAll("#catalogTabs button").forEach((button) => button.addEventListener("click", () => openArea(button.dataset.area)));
  frame.addEventListener("load", () => loading.classList.add("hidden"));
  window.addEventListener("popstate", () => openArea(currentArea(), false));
  openArea(currentArea(), false);
  loadCounts();
})();
