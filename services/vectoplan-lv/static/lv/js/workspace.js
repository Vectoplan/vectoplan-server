const root = document.querySelector("#lv-app");
const stateDot = document.querySelector("#service-state-dot");
const stateLabel = document.querySelector("#service-state-label");
const lvSelect = document.querySelector("#lv-select");
const newLvButton = document.querySelector("#new-lv");
const addPositionButton = document.querySelector("#add-position");
const addTextButton = document.querySelector("#add-text");
const gaebImportButton = document.querySelector("#gaeb-import");
const gaebExportButton = document.querySelector("#gaeb-export");
const gaebFile = document.querySelector("#gaeb-file");
const searchInput = document.querySelector("#item-search");
const tableBody = document.querySelector("#item-table-body");
const counter = document.querySelector("#item-count");
const workspaceTitle = document.querySelector("#workspace-title");
const workspaceEyebrow = document.querySelector("#workspace-eyebrow");
const selectedLvMeta = document.querySelector("#selected-lv-meta");
const notice = document.querySelector("#notice");
const lvDialog = document.querySelector("#lv-dialog");
const lvForm = document.querySelector("#lv-form");
const itemDialog = document.querySelector("#item-dialog");
const itemForm = document.querySelector("#item-form");
const itemDialogTitle = document.querySelector("#item-dialog-title");
const itemDialogEyebrow = document.querySelector("#item-dialog-eyebrow");
const billingDialog = document.querySelector("#billing-dialog");
const billingForm = document.querySelector("#billing-form");
const billingDialogTitle = document.querySelector("#billing-dialog-title");
const billingFiles = document.querySelector("#billing-files");
const attachmentList = document.querySelector("#attachment-list");
const existingBillingRow = document.querySelector("#existing-billing-row");
const billingEntrySelect = document.querySelector("#billing-entry-select");
const newBillingEntryButton = document.querySelector("#new-billing-entry");

const state = {
  projectId: root?.dataset.projectPublicId?.trim() || "1",
  apiBase: root?.dataset.apiBase || "/v1",
  mode: "lv",
  lvs: [],
  selectedLvId: "",
  items: [],
  billingItemId: "",
  billings: [],
  attachments: [],
};

function asText(value) {
  return String(value ?? "");
}

function selectedLv() {
  return state.lvs.find((lv) => lv.public_id === state.selectedLvId) || null;
}

function setNotice(message, isError = false) {
  notice.textContent = asText(message);
  notice.classList.toggle("error", isError);
  notice.hidden = !message;
}

function projectHeaders(extra = {}) {
  return {
    Accept: "application/json",
    "X-Vectoplan-Project-Id": state.projectId,
    ...extra,
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: projectHeaders(options.headers || {}),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.error?.message || message;
    } catch {
      // The HTTP status remains the useful fallback.
    }
    throw new Error(message);
  }
  return response;
}

function decimalForApi(value) {
  const normalized = asText(value).trim();
  return normalized || null;
}

function numberForDisplay(value, fractionDigits = 2) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  if (!Number.isFinite(number)) return asText(value);
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fractionDigits, 4),
  }).format(number);
}

function currencyForDisplay(value) {
  if (value === null || value === undefined || value === "") return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: selectedLv()?.currency || "EUR",
  }).format(Number(value));
}

function makeCell(className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  return cell;
}

function makeButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function renderBillingSummary(item) {
  const cell = makeCell();
  const entries = Array.isArray(item.billings) ? item.billings : [];
  if (!entries.length || item.item_type === "text") {
    cell.textContent = "–";
    cell.classList.add("muted");
    return cell;
  }

  const summary = document.createElement("div");
  summary.className = "billing-summary";
  const invoices = document.createElement("strong");
  invoices.textContent = entries.map((entry) => `RG ${entry.invoice_number}`).join(", ");
  const details = document.createElement("span");
  const fileCount = entries.reduce(
    (total, entry) => total + (entry.attachments?.length || 0),
    0,
  );
  details.textContent = `${entries.length} Stand${entries.length === 1 ? "" : "stände"} · ${fileCount} Datei${fileCount === 1 ? "" : "en"}`;
  summary.append(invoices, details);
  cell.append(summary);
  return cell;
}

function filteredItems() {
  const needle = searchInput.value.trim().toLocaleLowerCase("de");
  if (!needle) return state.items;
  return state.items.filter((item) =>
    [item.ordinal_number, item.short_text, item.long_text]
      .some((value) => asText(value).toLocaleLowerCase("de").includes(needle)),
  );
}

function renderItems() {
  tableBody.replaceChildren();
  const visibleItems = filteredItems();
  const positionCount = state.items.filter((item) => item.item_type === "position").length;
  counter.textContent = `${positionCount} ${positionCount === 1 ? "Position" : "Positionen"}`;

  if (!state.selectedLvId) {
    const row = document.createElement("tr");
    const empty = makeCell("empty-state");
    empty.colSpan = 8;
    const title = document.createElement("strong");
    title.textContent = "Noch kein Leistungsverzeichnis vorhanden.";
    const hint = document.createElement("span");
    hint.textContent = "Lege ein LV an, um Positionen und Texte zu erfassen.";
    empty.append(title, hint);
    row.append(empty);
    tableBody.append(row);
    return;
  }

  if (!visibleItems.length) {
    const row = document.createElement("tr");
    const empty = makeCell("empty-state");
    empty.colSpan = 8;
    const title = document.createElement("strong");
    title.textContent = searchInput.value
      ? "Keine passenden Einträge gefunden."
      : "Dieses LV enthält noch keine Positionen.";
    const hint = document.createElement("span");
    hint.textContent = state.mode === "lv"
      ? "Füge eine Position oder Textzeile hinzu oder importiere GAEB 3.3."
      : "Abrechnungen werden direkt an den Positionen angelegt.";
    empty.append(title, hint);
    row.append(empty);
    tableBody.append(row);
    return;
  }

  for (const item of visibleItems) {
    const row = document.createElement("tr");
    if (item.item_type === "text") row.className = "text-row";

    const oz = makeCell();
    oz.textContent = item.ordinal_number || "Text";

    const copy = makeCell();
    const copyStack = document.createElement("div");
    copyStack.className = "item-copy";
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = item.item_type === "text" ? "Text" : "Position";
    const title = document.createElement("strong");
    title.textContent = item.short_text || item.long_text || "Ohne Text";
    copyStack.append(badge, title);
    if (item.long_text && item.long_text !== item.short_text) {
      const longText = document.createElement("span");
      longText.textContent = item.long_text;
      copyStack.append(longText);
    }
    copy.append(copyStack);

    const quantity = makeCell("number-column");
    quantity.textContent = item.item_type === "position"
      ? numberForDisplay(item.quantity, 3)
      : "–";
    const unit = makeCell();
    unit.textContent = item.unit || "–";
    const unitPrice = makeCell("number-column");
    unitPrice.textContent = item.item_type === "position"
      ? currencyForDisplay(item.unit_price)
      : "–";
    const total = makeCell("number-column");
    total.textContent = item.item_type === "position"
      ? currencyForDisplay(item.total_price)
      : "–";

    const actions = makeCell();
    const actionGroup = document.createElement("div");
    actionGroup.className = "row-actions";
    actionGroup.append(
      makeButton("Bearbeiten", "", () => openItemDialog(item.item_type, item)),
    );
    if (item.item_type === "position") {
      const entries = Array.isArray(item.billings) ? item.billings : [];
      actionGroup.append(
        makeButton(
          entries.length ? "Abrechnung" : "Abrechnen",
          "bill-action",
          () => openBillingDialog(item),
        ),
      );
    }
    actions.append(actionGroup);

    row.append(
      oz,
      copy,
      quantity,
      unit,
      unitPrice,
      total,
      renderBillingSummary(item),
      actions,
    );
    tableBody.append(row);
  }
}

function renderLvSelection() {
  lvSelect.replaceChildren();
  if (!state.lvs.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Noch kein LV";
    lvSelect.append(option);
  } else {
    for (const lv of state.lvs) {
      const option = document.createElement("option");
      option.value = lv.public_id;
      option.textContent = lv.name;
      option.selected = lv.public_id === state.selectedLvId;
      lvSelect.append(option);
    }
  }

  const hasLv = Boolean(state.selectedLvId);
  for (const control of [
    addPositionButton,
    addTextButton,
    gaebImportButton,
    gaebExportButton,
    searchInput,
  ]) {
    control.disabled = !hasLv;
  }
  const current = selectedLv();
  selectedLvMeta.textContent = current
    ? `${current.name} · ${current.currency} · bearbeitbarer Entwurf`
    : "Lege ein LV an, um zu beginnen.";
}

async function loadItems() {
  if (!state.selectedLvId) {
    state.items = [];
    renderLvSelection();
    renderItems();
    return;
  }
  const response = await api(`/lvs/${encodeURIComponent(state.selectedLvId)}/items`);
  const payload = await response.json();
  state.items = Array.isArray(payload.items) ? payload.items : [];
  renderLvSelection();
  renderItems();
}

async function loadLvs(preferredId = "") {
  const response = await api("/lvs");
  const payload = await response.json();
  state.lvs = Array.isArray(payload.items) ? payload.items : [];
  const candidate = preferredId || state.selectedLvId;
  state.selectedLvId = state.lvs.some((lv) => lv.public_id === candidate)
    ? candidate
    : (state.lvs[0]?.public_id || "");
  await loadItems();
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.querySelectorAll(".lv-only").forEach((element) => {
    element.classList.toggle("hidden", mode !== "lv");
  });
  workspaceTitle.textContent = mode === "lv"
    ? "LV & Kalkulation"
    : "Aufmaß & Abrechnung";
  workspaceEyebrow.textContent = mode === "lv"
    ? "Bearbeitbarer Stand"
    : "Rechnungsstände je Position";
  renderItems();
}

function openItemDialog(itemType, item = null) {
  itemForm.reset();
  itemForm.elements.public_id.value = item?.public_id || "";
  itemForm.elements.item_type.value = itemType;
  itemForm.elements.ordinal_number.value = item?.ordinal_number || "";
  itemForm.elements.short_text.value = item?.short_text || "";
  itemForm.elements.long_text.value = item?.long_text || "";
  itemForm.elements.quantity.value = item?.quantity || "";
  itemForm.elements.unit.value = item?.unit || "";
  itemForm.elements.unit_price.value = item?.unit_price || "";

  const isText = itemType === "text";
  itemDialogTitle.textContent = isText ? "Textzeile" : "Position";
  itemDialogEyebrow.textContent = item ? "Manuell bearbeiten" : "Manuell hinzufügen";
  itemForm.querySelectorAll(".position-field").forEach((field) => {
    field.classList.toggle("hidden", isText);
  });
  itemForm.elements.short_text.required = !isText;
  itemDialog.showModal();
}

async function saveItem(event) {
  event.preventDefault();
  const data = new FormData(itemForm);
  const itemId = asText(data.get("public_id"));
  const itemType = asText(data.get("item_type"));
  const payload = {
    item_type: itemType,
    ordinal_number: itemType === "position" ? asText(data.get("ordinal_number")) : null,
    short_text: asText(data.get("short_text")),
    long_text: asText(data.get("long_text")),
    quantity: itemType === "position" ? decimalForApi(data.get("quantity")) : null,
    unit: itemType === "position" ? asText(data.get("unit")) : null,
    unit_price: itemType === "position" ? decimalForApi(data.get("unit_price")) : null,
  };
  try {
    await api(
      itemId
        ? `/items/${encodeURIComponent(itemId)}`
        : `/lvs/${encodeURIComponent(state.selectedLvId)}/items`,
      {
        method: itemId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    itemDialog.close();
    await loadItems();
    setNotice(itemId ? "Änderungen gespeichert." : "Eintrag hinzugefügt.");
  } catch (error) {
    setNotice(error.message, true);
  }
}

function renderAttachments() {
  attachmentList.replaceChildren();
  for (const [index, attachment] of state.attachments.entries()) {
    const row = document.createElement("div");
    row.className = "attachment-row";
    const name = document.createElement("span");
    name.textContent = attachment.name;
    const size = document.createElement("span");
    size.textContent = attachment.size
      ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
      : "Metadaten";
    const remove = makeButton("Entfernen", "", () => {
      state.attachments.splice(index, 1);
      renderAttachments();
    });
    row.append(name, size, remove);
    attachmentList.append(row);
  }
}

function loadBillingIntoForm(entry = null) {
  billingForm.elements.public_id.value = entry?.public_id || "";
  billingForm.elements.invoice_number.value = entry?.invoice_number || "";
  billingForm.elements.billed_quantity.value = entry?.billed_quantity || "";
  billingForm.elements.notes.value = entry?.notes || "";
  state.attachments = Array.isArray(entry?.attachments)
    ? entry.attachments.map((attachment) => ({ ...attachment }))
    : [];
  billingFiles.value = "";
  renderAttachments();
}

function renderBillingChooser() {
  billingEntrySelect.replaceChildren();
  for (const entry of state.billings) {
    const option = document.createElement("option");
    option.value = entry.public_id;
    option.textContent = `Rechnung ${entry.invoice_number}`;
    billingEntrySelect.append(option);
  }
  existingBillingRow.hidden = !state.billings.length;
  if (state.billings.length) {
    billingEntrySelect.value = state.billings[0].public_id;
    loadBillingIntoForm(state.billings[0]);
  } else {
    loadBillingIntoForm();
    billingForm.elements.invoice_number.value = "1";
  }
}

async function openBillingDialog(item) {
  state.billingItemId = item.public_id;
  billingForm.elements.item_id.value = item.public_id;
  billingDialogTitle.textContent = `${item.ordinal_number || "Position"} · ${item.short_text || ""}`;
  try {
    const response = await api(`/items/${encodeURIComponent(item.public_id)}/billings`);
    const payload = await response.json();
    state.billings = Array.isArray(payload.items) ? payload.items : [];
    renderBillingChooser();
    billingDialog.showModal();
  } catch (error) {
    setNotice(error.message, true);
  }
}

async function saveBilling(event) {
  event.preventDefault();
  const data = new FormData(billingForm);
  const payload = {
    public_id: asText(data.get("public_id")) || null,
    invoice_number: asText(data.get("invoice_number")),
    billed_quantity: decimalForApi(data.get("billed_quantity")),
    notes: asText(data.get("notes")),
    attachments: state.attachments,
  };
  try {
    await api(`/items/${encodeURIComponent(state.billingItemId)}/billings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    billingDialog.close();
    await loadItems();
    setNotice("Aufmaß und Abrechnung wurden gespeichert.");
  } catch (error) {
    setNotice(error.message, true);
  }
}

async function importGaeb(file) {
  const data = new FormData();
  data.append("file", file);
  try {
    const response = await api(
      `/lvs/${encodeURIComponent(state.selectedLvId)}/imports/gaeb`,
      { method: "POST", body: data },
    );
    const report = await response.json();
    await loadItems();
    setNotice(
      `${report.imported_count} GAEB-Einträge importiert, ${report.skipped_count} übersprungen. Manuelle Bearbeitung ist sofort möglich.`,
      Boolean(report.skipped_count),
    );
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    gaebFile.value = "";
  }
}

async function exportGaeb() {
  try {
    const response = await api(
      `/lvs/${encodeURIComponent(state.selectedLvId)}/exports/gaeb?phase=84`,
    );
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = match?.[1] || "leistungsverzeichnis.X84";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(anchor.href);
    setNotice("GAEB DA XML 3.3 (X84) wurde exportiert.");
  } catch (error) {
    setNotice(error.message, true);
  }
}

async function initialize() {
  try {
    const health = await fetch("/health", {
      headers: { Accept: "application/json" },
    });
    if (!health.ok) throw new Error(`Health HTTP ${health.status}`);
    stateDot.classList.add("ok");
    stateLabel.textContent = "Service erreichbar";
    await loadLvs();
  } catch (error) {
    stateDot.classList.add("error");
    stateLabel.textContent = "Service nicht verfügbar";
    setNotice(error.message, true);
  }
}

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.close}`)?.close();
  });
});

newLvButton.addEventListener("click", () => {
  lvForm.reset();
  lvDialog.showModal();
});
lvForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(lvForm);
  try {
    const response = await api("/lvs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: asText(data.get("name")),
        description: asText(data.get("description")),
      }),
    });
    const created = await response.json();
    lvDialog.close();
    await loadLvs(created.public_id);
    setNotice("Leistungsverzeichnis angelegt.");
  } catch (error) {
    setNotice(error.message, true);
  }
});

lvSelect.addEventListener("change", async () => {
  state.selectedLvId = lvSelect.value;
  searchInput.value = "";
  try {
    await loadItems();
  } catch (error) {
    setNotice(error.message, true);
  }
});
addPositionButton.addEventListener("click", () => openItemDialog("position"));
addTextButton.addEventListener("click", () => openItemDialog("text"));
itemForm.addEventListener("submit", saveItem);
searchInput.addEventListener("input", renderItems);
gaebImportButton.addEventListener("click", () => gaebFile.click());
gaebFile.addEventListener("change", () => {
  if (gaebFile.files?.[0]) importGaeb(gaebFile.files[0]);
});
gaebExportButton.addEventListener("click", exportGaeb);
billingForm.addEventListener("submit", saveBilling);
billingFiles.addEventListener("change", () => {
  for (const file of billingFiles.files || []) {
    state.attachments.push({
      name: file.name,
      size: file.size,
      content_type: file.type || "application/octet-stream",
    });
  }
  renderAttachments();
});
billingEntrySelect.addEventListener("change", () => {
  const entry = state.billings.find(
    (candidate) => candidate.public_id === billingEntrySelect.value,
  );
  loadBillingIntoForm(entry || null);
});
newBillingEntryButton.addEventListener("click", () => {
  loadBillingIntoForm();
  billingForm.elements.invoice_number.value = asText(state.billings.length + 1);
});

setMode("lv");
initialize();
