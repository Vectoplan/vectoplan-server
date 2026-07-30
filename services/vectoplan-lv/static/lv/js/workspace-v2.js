const root = document.querySelector("#lv-app");
const stateDot = document.querySelector("#service-state-dot");
const stateLabel = document.querySelector("#service-state-label");
const lvSelect = document.querySelector("#lv-select");
const newLvButton = document.querySelector("#new-lv");
const addTitleButton = document.querySelector("#add-title");
const addSectionButton = document.querySelector("#add-section");
const addPositionButton = document.querySelector("#add-position");
const addTextButton = document.querySelector("#add-text");
const gaebImportButton = document.querySelector("#gaeb-import");
const gaebExportButton = document.querySelector("#gaeb-export");
const gaebFile = document.querySelector("#gaeb-file");
const searchInput = document.querySelector("#item-search");
const tableBody = document.querySelector("#item-table-body");
const tablePane = document.querySelector("#table-pane");
const counter = document.querySelector("#item-count");
const workspaceTitle = document.querySelector("#workspace-title");
const workspaceEyebrow = document.querySelector("#workspace-eyebrow");
const selectedLvMeta = document.querySelector("#selected-lv-meta");
const interactionHint = document.querySelector("#interaction-hint");
const notice = document.querySelector("#notice");
const editorShell = document.querySelector("#editor-shell");
const calculationPanel = document.querySelector("#calculation-panel");
const calculationEmpty = document.querySelector("#calculation-empty");
const calculationForm = document.querySelector("#calculation-form");
const calculationTitle = document.querySelector("#calculation-title");
const calculationSubtitle = document.querySelector("#calculation-subtitle");
const calculationModeLabel = document.querySelector("#calculation-mode-label");
const calculationEmptyEyebrow = document.querySelector("#calculation-empty-eyebrow");
const calculationEmptyCopy = document.querySelector("#calculation-empty-copy");
const calculationStandField = document.querySelector("#calculation-stand-field");
const calculationBillingSelect = document.querySelector("#calculation-billing-select");
const calculationInvoice = document.querySelector("#calculation-invoice");
const calculationNote = document.querySelector("#calculation-note");
const calculationRows = document.querySelector("#calculation-rows");
const calculationTotal = document.querySelector("#calculation-total");
const calculationUnit = document.querySelector("#calculation-unit");
const addCalculationRowButton = document.querySelector("#add-calculation-row");
const calculationNoteLabel = document.querySelector("#calculation-note-label");
const calculationTotalLabel = document.querySelector("#calculation-total-label");
const calculationFiles = document.querySelector("#calculation-files");
const calculationAttachmentList = document.querySelector("#calculation-attachment-list");
const calculationUploadLabel = document.querySelector("#calculation-upload-label");
const calculationSaveButton = document.querySelector("#calculation-save");
const closeCalculationButton = document.querySelector("#close-calculation");
const openBillingDetailsButton = document.querySelector("#open-billing-details");
const contextMenu = document.querySelector("#context-menu");
const lvDialog = document.querySelector("#lv-dialog");
const lvForm = document.querySelector("#lv-form");
const itemDialog = document.querySelector("#item-dialog");
const itemForm = document.querySelector("#item-form");
const itemDialogTitle = document.querySelector("#item-dialog-title");
const itemDialogEyebrow = document.querySelector("#item-dialog-eyebrow");
const parentFieldLabel = document.querySelector("#parent-field-label");
const billingDialog = document.querySelector("#billing-dialog");
const billingForm = document.querySelector("#billing-form");
const billingDialogTitle = document.querySelector("#billing-dialog-title");
const billingQuantityHint = document.querySelector("#billing-quantity-hint");
const billingFiles = document.querySelector("#billing-files");
const attachmentList = document.querySelector("#attachment-list");
const existingBillingRow = document.querySelector("#existing-billing-row");
const billingEntrySelect = document.querySelector("#billing-entry-select");
const newBillingEntryButton = document.querySelector("#new-billing-entry");

const COMMON_UNITS = [
  "",
  "m",
  "m²",
  "m³",
  "cm",
  "mm",
  "St",
  "h",
  "kg",
  "t",
  "l",
  "psch",
  "%",
];

const state = {
  projectId: root?.dataset.projectPublicId?.trim() || "1",
  apiBase: root?.dataset.apiBase || "/v1",
  mode: "lv",
  lvs: [],
  selectedLvId: "",
  items: [],
  collapsedTitles: new Set(),
  collapsedSections: new Set(),
  contextTargetId: null,
  draggedItemId: null,
  selectedCalculationItemId: null,
  calculationBillings: [],
  calculationBillingId: null,
  calculationDraftRows: [],
  calculationAttachments: [],
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

function selectedCalculationItem() {
  return state.items.find(
    (item) => item.public_id === state.selectedCalculationItemId,
  ) || null;
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
      // Keep the HTTP fallback for non-JSON errors.
    }
    throw new Error(message);
  }
  return response;
}

function decimalForApi(value) {
  return asText(value).trim() || null;
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

function orderedItems() {
  return [...state.items].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
}

function titles() {
  return orderedItems().filter((item) => item.item_type === "title");
}

function sections() {
  return orderedItems().filter((item) => item.item_type === "section");
}

function childrenOf(parentId) {
  return orderedItems().filter(
    (item) => item.parent_public_id === parentId,
  );
}

function descendantsOf(parentId) {
  const direct = childrenOf(parentId);
  return direct.flatMap((item) => [
    item,
    ...(item.item_type === "section" ? childrenOf(item.public_id) : []),
  ]);
}

function rootItems() {
  return orderedItems().filter(
    (item) =>
      !["title", "section"].includes(item.item_type)
      && !item.parent_public_id,
  );
}

function makeCell(className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  return cell;
}

function makeButton(label, className, onClick, ariaLabel = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
}

function populateUnitSelect(select, selected = "") {
  select.replaceChildren();
  const values = COMMON_UNITS.includes(selected)
    ? COMMON_UNITS
    : [...COMMON_UNITS, selected];
  for (const unit of values) {
    const option = document.createElement("option");
    option.value = unit;
    option.textContent = unit || "Keine Einheit";
    option.selected = unit === selected;
    select.append(option);
  }
}

async function patchItem(item, field, value) {
  const response = await api(`/items/${encodeURIComponent(item.public_id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });
  const updated = await response.json();
  state.items = state.items.map((candidate) =>
    candidate.public_id === updated.public_id ? updated : candidate
  );
  return updated;
}

function beginInlineEdit(container, item, field, type = "text") {
  if (container.querySelector(".inline-editor")) return;
  const originalValue = asText(item[field]);
  const editor = type === "select"
    ? document.createElement("select")
    : (type === "textarea"
      ? document.createElement("textarea")
      : document.createElement("input"));
  editor.className = "inline-editor";
  if (type === "select") {
    populateUnitSelect(editor, originalValue);
  } else {
    if (type !== "textarea") editor.type = "text";
    editor.value = originalValue;
    if (type === "decimal") editor.inputMode = "decimal";
    if (type === "textarea") editor.rows = 3;
  }
  container.replaceChildren(editor);
  editor.focus();
  if (editor.select) editor.select();

  let finished = false;
  const cancel = () => {
    if (finished) return;
    finished = true;
    renderItems();
  };
  const commit = async () => {
    if (finished) return;
    finished = true;
    const value = editor.value.trim();
    if (value === originalValue) {
      renderItems();
      return;
    }
    try {
      await patchItem(item, field, value || null);
      renderItems();
      setNotice(`${field === "unit" ? "Einheit" : "Wert"} gespeichert.`);
    } catch (error) {
      renderItems();
      setNotice(error.message, true);
    }
  };
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter") {
      if (type !== "textarea" || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        commit();
      }
    }
  });
  editor.addEventListener("blur", commit);
  if (type === "select") editor.addEventListener("change", commit);
}

function makeEditableCell(item, field, displayValue, type = "text", className = "") {
  const cell = makeCell(`${className} editable-cell`.trim());
  cell.textContent = displayValue;
  cell.tabIndex = 0;
  cell.title = "Klicken zum Bearbeiten";
  cell.addEventListener("click", (event) => {
    event.stopPropagation();
    beginInlineEdit(cell, item, field, type);
  });
  cell.addEventListener("keydown", (event) => {
    if (event.key === "Enter") beginInlineEdit(cell, item, field, type);
  });
  return cell;
}

function makeEditableText(
  item,
  field,
  value,
  tagName = "strong",
  editorType = "text",
) {
  const element = document.createElement(tagName);
  element.className = "editable-value";
  if (field === "long_text") element.classList.add("long-text-editable");
  element.textContent = value || (
    field === "long_text" ? "Langtext ergänzen" : "Ohne Text"
  );
  element.tabIndex = 0;
  element.title = "Klicken zum Bearbeiten";
  const open = (event) => {
    event.stopPropagation();
    beginInlineEdit(element, item, field, editorType);
  };
  element.addEventListener("click", open);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") open(event);
  });
  return element;
}

function renderWorkSummary(item) {
  const cell = makeCell();
  if (item.item_type !== "position") {
    cell.textContent = "–";
    cell.classList.add("muted");
    return cell;
  }
  if (state.mode === "lv") {
    const summary = document.createElement("div");
    summary.className = "billing-summary";
    const calculation = document.createElement("strong");
    calculation.textContent = item.calculation_rows?.length
      ? `Σ ${numberForDisplay(item.calculation_total, 3)} ${item.unit || ""}`
      : "Rechenweg öffnen";
    const details = document.createElement("span");
    details.textContent = `${item.calculation_rows?.length || 0} Rechenzeilen · ${item.calculation_attachments?.length || 0} Dokumente`;
    summary.append(calculation, details);
    cell.append(summary);
    return cell;
  }
  const entries = Array.isArray(item.billings) ? item.billings : [];
  if (!entries.length) {
    cell.textContent = "–";
    cell.classList.add("muted");
    return cell;
  }
  const summary = document.createElement("div");
  summary.className = "billing-summary";
  const invoices = document.createElement("strong");
  invoices.textContent = entries.map((entry) => `RG ${entry.invoice_number}`).join(", ");
  const details = document.createElement("span");
  const calcCount = entries.reduce(
    (total, entry) => total + (entry.calculation_rows?.length || 0),
    0,
  );
  details.textContent = `${entries.length} Stand${entries.length === 1 ? "" : "stände"} · ${calcCount} Rechenzeilen`;
  summary.append(invoices, details);
  cell.append(summary);
  return cell;
}

function showContextMenu(event, item = null) {
  event.preventDefault();
  event.stopPropagation();
  state.contextTargetId = item?.public_id || null;
  contextMenu.querySelectorAll(".target-only").forEach((element) => {
    element.hidden = !item;
  });
  contextMenu.querySelectorAll(".position-only").forEach((element) => {
    element.hidden = item?.item_type !== "position";
  });
  const titleButton = contextMenu.querySelector('[data-context-action="add-title"]');
  titleButton.hidden = Boolean(item && item.item_type !== "title");
  const maxLeft = window.innerWidth - 225;
  const maxTop = window.innerHeight - 260;
  contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxLeft))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxTop))}px`;
  contextMenu.hidden = false;
}

function hideContextMenu() {
  contextMenu.hidden = true;
}

function attachDragBehavior(row, item) {
  row.draggable = true;
  row.dataset.itemId = item.public_id;
  row.addEventListener("dragstart", (event) => {
    state.draggedItemId = item.public_id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.public_id);
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", async (event) => {
    event.preventDefault();
    row.classList.remove("drag-over");
    await moveByDrop(state.draggedItemId, item);
  });
  row.addEventListener("dragend", () => {
    state.draggedItemId = null;
    document.querySelectorAll(".drag-over").forEach((element) => {
      element.classList.remove("drag-over");
    });
  });
}

async function persistOrder(items) {
  state.items = items.map((item, index) => ({
    ...item,
    sort_order: (index + 1) * 10,
  }));
  renderItems();
  try {
    const response = await api(
      `/lvs/${encodeURIComponent(state.selectedLvId)}/items/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: state.items.map((item) => ({
            public_id: item.public_id,
            parent_public_id: item.parent_public_id,
          })),
        }),
      },
    );
    const payload = await response.json();
    state.items = Array.isArray(payload.items) ? payload.items : state.items;
    renderItems();
    setNotice("Reihenfolge gespeichert.");
  } catch (error) {
    await loadItems();
    setNotice(error.message, true);
  }
}

async function moveByDrop(draggedId, target) {
  if (!draggedId || draggedId === target.public_id) return;
  const ordered = orderedItems();
  const dragged = ordered.find((item) => item.public_id === draggedId);
  if (!dragged) return;
  if (dragged.item_type === "title" && target.item_type !== "title") {
    return;
  }
  if (
    dragged.item_type === "section"
    && !["title", "section"].includes(target.item_type)
  ) {
    return;
  }
  const without = ordered.filter((item) => item.public_id !== draggedId);
  let targetIndex = without.findIndex(
    (item) => item.public_id === target.public_id,
  );
  if (dragged.item_type === "title") {
    dragged.parent_public_id = null;
  } else if (dragged.item_type === "section") {
    dragged.parent_public_id = target.item_type === "title"
      ? target.public_id
      : target.parent_public_id;
    if (target.item_type === "title") targetIndex += 1;
  } else if (["title", "section"].includes(target.item_type)) {
    dragged.parent_public_id = target.public_id;
    const childIndexes = without
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.parent_public_id === target.public_id)
      .map(({ index }) => index);
    targetIndex = childIndexes.length
      ? Math.max(...childIndexes) + 1
      : targetIndex + 1;
  } else {
    dragged.parent_public_id = target.parent_public_id;
  }
  without.splice(Math.max(0, targetIndex), 0, dragged);
  await persistOrder(without);
}

async function moveToRoot(draggedId) {
  const ordered = orderedItems();
  const dragged = ordered.find((item) => item.public_id === draggedId);
  if (
    !dragged
    || ["title", "section"].includes(dragged.item_type)
  ) return;
  dragged.parent_public_id = null;
  const without = ordered.filter((item) => item.public_id !== draggedId);
  without.push(dragged);
  await persistOrder(without);
}

async function moveItemRelative(item, direction) {
  const ordered = orderedItems();
  const siblings = ordered.filter((candidate) => {
    if (item.item_type === "title") return candidate.item_type === "title";
    if (item.item_type === "section") {
      return candidate.item_type === "section"
        && candidate.parent_public_id === item.parent_public_id;
    }
    return !["title", "section"].includes(candidate.item_type)
      && !["title", "section"].includes(item.item_type)
      && candidate.parent_public_id === item.parent_public_id;
  });
  const currentIndex = siblings.findIndex(
    (candidate) => candidate.public_id === item.public_id,
  );
  const other = siblings[currentIndex + direction];
  if (!other) return;
  const first = ordered.findIndex((candidate) => candidate.public_id === item.public_id);
  const second = ordered.findIndex((candidate) => candidate.public_id === other.public_id);
  [ordered[first], ordered[second]] = [ordered[second], ordered[first]];
  await persistOrder(ordered);
}

function titleAmount(titleId) {
  return descendantsOf(titleId)
    .filter((item) => item.item_type === "position")
    .reduce((sum, item) => sum + Number(item.total_price || 0), 0);
}

function sectionAmount(sectionId) {
  return childrenOf(sectionId)
    .filter((item) => item.item_type === "position")
    .reduce((sum, item) => sum + Number(item.total_price || 0), 0);
}

function dragCell() {
  const cell = makeCell("drag-column");
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.title = "Ziehen zum Verschieben";
  cell.append(handle);
  return cell;
}

function actionCell(item) {
  const cell = makeCell();
  const group = document.createElement("div");
  group.className = "row-actions";
  if (item.item_type === "position") {
    group.append(
      makeButton(
        "RG",
        "bill-action",
        (event) => {
          event.stopPropagation();
          openBillingDialog(item);
        },
        "Abrechnen",
      ),
    );
  }
  group.append(
    makeButton(
      "⋯",
      "more-action",
      (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        showContextMenu(
          {
            preventDefault() {},
            stopPropagation() {},
            clientX: rect.right,
            clientY: rect.bottom,
          },
          item,
        );
      },
      "Weitere Aktionen",
    ),
  );
  cell.append(group);
  return cell;
}

function renderTitleRow(title) {
  const row = document.createElement("tr");
  row.className = "title-row";
  row.addEventListener("contextmenu", (event) => showContextMenu(event, title));
  attachDragBehavior(row, title);
  const oz = makeCell("ordinal-cell");
  oz.textContent = `${title.ordinal_number || "00"}_TITEL`;
  const copy = makeCell();
  const label = document.createElement("div");
  label.className = "title-label";
  const toggle = makeButton(
    state.collapsedTitles.has(title.public_id) ? "▸" : "▾",
    "title-toggle",
    (event) => {
      event.stopPropagation();
      if (state.collapsedTitles.has(title.public_id)) {
        state.collapsedTitles.delete(title.public_id);
      } else {
        state.collapsedTitles.add(title.public_id);
      }
      renderItems();
    },
    "Titel ein- oder ausklappen",
  );
  label.append(toggle, makeEditableText(title, "short_text", title.short_text));
  copy.append(label);
  const total = makeCell("number-column title-total");
  total.textContent = currencyForDisplay(titleAmount(title.public_id));
  row.append(
    dragCell(),
    oz,
    copy,
    makeCell("number-column"),
    makeCell(),
    makeCell("number-column"),
    total,
    makeCell(),
    actionCell(title),
  );
  return row;
}

function renderSectionRow(section) {
  const row = document.createElement("tr");
  row.className = "section-row";
  row.addEventListener(
    "contextmenu",
    (event) => showContextMenu(event, section),
  );
  attachDragBehavior(row, section);
  const oz = makeCell("ordinal-cell");
  oz.textContent = `${section.ordinal_number || "00.00"}_TEILBEREICH`;
  const copy = makeCell();
  const label = document.createElement("div");
  label.className = "section-label";
  const toggle = makeButton(
    state.collapsedSections.has(section.public_id) ? "▸" : "▾",
    "title-toggle",
    (event) => {
      event.stopPropagation();
      if (state.collapsedSections.has(section.public_id)) {
        state.collapsedSections.delete(section.public_id);
      } else {
        state.collapsedSections.add(section.public_id);
      }
      renderItems();
    },
    "Teilbereich ein- oder ausklappen",
  );
  label.append(
    toggle,
    makeEditableText(section, "short_text", section.short_text),
  );
  copy.append(label);
  const total = makeCell("number-column title-total");
  total.textContent = currencyForDisplay(sectionAmount(section.public_id));
  row.append(
    dragCell(),
    oz,
    copy,
    makeCell("number-column"),
    makeCell(),
    makeCell("number-column"),
    total,
    makeCell(),
    actionCell(section),
  );
  return row;
}

function renderItemRow(item) {
  const row = document.createElement("tr");
  row.className = item.item_type === "text" ? "text-row" : "position-row";
  if (state.selectedCalculationItemId === item.public_id) {
    row.classList.add("selected-row");
  }
  row.addEventListener("contextmenu", (event) => showContextMenu(event, item));
  row.addEventListener("click", (event) => {
    if (
      item.item_type === "position"
      && !event.target.closest("button, input, select, textarea")
    ) {
      selectCalculationItem(item);
    }
  });
  attachDragBehavior(row, item);

  const oz = makeCell("ordinal-cell");
  if (item.item_type === "position") oz.textContent = item.ordinal_number || "–";
  if (item.item_type === "text") oz.textContent = "Text";

  const copy = makeCell();
  const stack = document.createElement("div");
  stack.className = "item-copy";
  const badge = document.createElement("span");
  badge.className = "type-badge";
  badge.textContent = item.item_type === "text" ? "Text" : "Position";
  stack.append(badge, makeEditableText(item, "short_text", item.short_text));
  stack.append(makeEditableText(
    item,
    "long_text",
    item.long_text,
    "span",
    "textarea",
  ));
  copy.append(stack);

  const quantity = item.item_type === "position"
    ? makeEditableCell(
      item,
      "quantity",
      numberForDisplay(item.quantity, 3),
      "decimal",
      "number-column",
    )
    : makeCell("number-column");
  const unit = item.item_type === "position"
    ? makeEditableCell(item, "unit", item.unit || "–", "select")
    : makeCell();
  const unitPrice = item.item_type === "position"
    ? makeEditableCell(
      item,
      "unit_price",
      currencyForDisplay(item.unit_price),
      "decimal",
      "number-column",
    )
    : makeCell("number-column");
  const total = makeCell("number-column");
  total.textContent = item.item_type === "position"
    ? currencyForDisplay(item.total_price)
    : "–";
  row.append(
    dragCell(),
    oz,
    copy,
    quantity,
    unit,
    unitPrice,
    total,
    renderWorkSummary(item),
    actionCell(item),
  );
  return row;
}

function renderRootGroup(items) {
  const row = document.createElement("tr");
  row.className = "root-group-row";
  row.addEventListener("contextmenu", (event) => showContextMenu(event));
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    row.classList.add("drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", async (event) => {
    event.preventDefault();
    row.classList.remove("drag-over");
    await moveToRoot(state.draggedItemId);
  });
  const cell = makeCell();
  cell.colSpan = 9;
  cell.textContent = `00_OHNE TITEL · ${items.length} Einträge · auf einen Titel ziehen, um zuzuordnen`;
  row.append(cell);
  return row;
}

function filtered(item) {
  const needle = searchInput.value.trim().toLocaleLowerCase("de");
  if (!needle) return true;
  return [item.ordinal_number, item.short_text, item.long_text]
    .some((value) => asText(value).toLocaleLowerCase("de").includes(needle));
}

function renderItems() {
  tableBody.replaceChildren();
  const positionCount = state.items.filter(
    (item) => item.item_type === "position",
  ).length;
  counter.textContent = `${positionCount} ${positionCount === 1 ? "Position" : "Positionen"}`;

  if (!state.selectedLvId || !state.items.length) {
    const row = document.createElement("tr");
    const empty = makeCell("empty-state");
    empty.colSpan = 9;
    const title = document.createElement("strong");
    title.textContent = state.selectedLvId
      ? "Dieses LV enthält noch keine Elemente."
      : "Noch kein Leistungsverzeichnis vorhanden.";
    const hint = document.createElement("span");
    hint.textContent = state.selectedLvId
      ? "Lege zuerst einen Titel an oder öffne das Kontextmenü mit Rechtsklick."
      : "Lege ein LV an, um Titel und Positionen zu erfassen.";
    empty.append(title, hint);
    row.append(empty);
    tableBody.append(row);
    return;
  }

  let visibleCount = 0;
  for (const title of titles()) {
    const childItems = childrenOf(title.public_id);
    const descendants = descendantsOf(title.public_id);
    const titleMatches = filtered(title);
    const matchingChildren = descendants.filter(filtered);
    if (!titleMatches && !matchingChildren.length) continue;
    tableBody.append(renderTitleRow(title));
    visibleCount += 1;
    if (
      !state.collapsedTitles.has(title.public_id)
      || searchInput.value
    ) {
      for (const item of childItems) {
        if (item.item_type === "section") {
          const sectionChildren = childrenOf(item.public_id);
          const sectionMatches = filtered(item)
            || sectionChildren.some(filtered);
          if (searchInput.value && !sectionMatches) continue;
          tableBody.append(renderSectionRow(item));
          visibleCount += 1;
          if (
            !state.collapsedSections.has(item.public_id)
            || searchInput.value
          ) {
            for (const child of sectionChildren) {
              if (!searchInput.value || filtered(child)) {
                tableBody.append(renderItemRow(child));
                visibleCount += 1;
              }
            }
          }
        } else if (!searchInput.value || filtered(item)) {
          tableBody.append(renderItemRow(item));
          visibleCount += 1;
        }
      }
    }
  }
  const roots = rootItems().filter(filtered);
  if (roots.length) {
    tableBody.append(renderRootGroup(roots));
    for (const item of roots) {
      tableBody.append(renderItemRow(item));
      visibleCount += 1;
    }
  }
  if (!visibleCount) {
    const row = document.createElement("tr");
    const empty = makeCell("empty-state");
    empty.colSpan = 9;
    empty.textContent = "Keine passenden Einträge gefunden.";
    row.append(empty);
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
    addTitleButton,
    addSectionButton,
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
  if (
    state.selectedCalculationItemId
    && !state.items.some((item) => item.public_id === state.selectedCalculationItemId)
  ) {
    state.selectedCalculationItemId = null;
  }
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
  const billingMode = mode === "billing";
  calculationPanel.hidden = false;
  editorShell.classList.add("with-calculation");
  document.querySelectorAll(".billing-only").forEach((element) => {
    element.classList.toggle("hidden", !billingMode);
  });
  workspaceTitle.textContent = billingMode
    ? "Aufmaß & Abrechnung"
    : "LV & Kalkulation";
  workspaceEyebrow.textContent = billingMode
    ? "Rechnungsstände je Position"
    : "Bearbeitbarer Stand";
  interactionHint.textContent = billingMode
    ? "Position anklicken · Rechenweg rechts bearbeiten"
    : "Textfelder direkt bearbeiten · Positionen ziehen · Rechenweg rechts";
  calculationModeLabel.textContent = billingMode
    ? "Aufmaß / Rechenweg"
    : "Kalkulation / Rechenweg";
  calculationEmptyEyebrow.textContent = calculationModeLabel.textContent;
  calculationEmptyCopy.textContent = billingMode
    ? "Wähle eine Position. Der Rechenweg bildet die Menge des ausgewählten Rechnungsstands."
    : "Wähle eine Position. Der Rechenweg bildet automatisch die LV-Menge.";
  calculationNoteLabel.textContent = billingMode
    ? "Notiz zum Aufmaß"
    : "Notiz zur Kalkulation";
  calculationTotalLabel.textContent = billingMode
    ? "Abzurechnende Menge"
    : "Ermittelte LV-Menge";
  calculationUploadLabel.textContent = billingMode
    ? "Aufmaß-Dokumente"
    : "Dokumente zur Kalkulation";
  calculationSaveButton.textContent = billingMode
    ? "Rechenweg speichern"
    : "Kalkulation speichern";
  const currentItem = selectedCalculationItem();
  const firstPosition = orderedItems().find(
    (item) => item.item_type === "position",
  );
  if (currentItem) {
    selectCalculationItem(currentItem);
  } else if (firstPosition) {
    selectCalculationItem(firstPosition);
  } else {
    calculationForm.hidden = true;
    calculationEmpty.hidden = false;
  }
  renderItems();
}

function populateParentSelect(itemType, selected = "") {
  const select = itemForm.elements.parent_public_id;
  select.replaceChildren();
  if (itemType !== "section") {
    const rootOption = document.createElement("option");
    rootOption.value = "";
    rootOption.textContent = "Ohne Gliederung";
    select.append(rootOption);
  }
  for (const title of titles()) {
    const option = document.createElement("option");
    option.value = title.public_id;
    option.textContent = `${title.ordinal_number || "00"}_TITEL · ${title.short_text}`;
    option.selected = title.public_id === selected;
    select.append(option);
    if (itemType !== "section") {
      for (const section of childrenOf(title.public_id).filter(
        (item) => item.item_type === "section",
      )) {
        const sectionOption = document.createElement("option");
        sectionOption.value = section.public_id;
        sectionOption.textContent = `　${section.ordinal_number}_TEILBEREICH · ${section.short_text}`;
        sectionOption.selected = section.public_id === selected;
        select.append(sectionOption);
      }
    }
  }
  select.value = selected || (
    itemType === "section" ? (titles()[0]?.public_id || "") : ""
  );
}

function openItemDialog(itemType, item = null, parentId = "") {
  hideContextMenu();
  itemForm.reset();
  itemForm.elements.public_id.value = item?.public_id || "";
  itemForm.elements.item_type.value = itemType;
  itemForm.elements.ordinal_number.value = item?.ordinal_number || "";
  itemForm.elements.short_text.value = item?.short_text || "";
  itemForm.elements.long_text.value = item?.long_text || "";
  itemForm.elements.quantity.value = item?.quantity || "";
  itemForm.elements.unit_price.value = item?.unit_price || "";
  populateParentSelect(item?.parent_public_id || parentId);
  populateUnitSelect(itemForm.elements.unit, item?.unit || "");

  const isPosition = itemType === "position";
  const isTitle = itemType === "title";
  itemDialogTitle.textContent = isTitle
    ? "Titel"
    : (isPosition ? "Position" : "Textzeile");
  itemDialogEyebrow.textContent = item ? "Element bearbeiten" : "Element hinzufügen";
  itemForm.querySelectorAll(".position-field").forEach((field) => {
    field.classList.toggle("hidden", !isPosition);
  });
  itemForm.querySelectorAll(".parent-field").forEach((field) => {
    field.classList.toggle("hidden", isTitle);
  });
  itemForm.querySelectorAll(".ordinal-field").forEach((field) => {
    field.classList.toggle("hidden", itemType === "text");
  });
  itemForm.elements.short_text.required = true;
  itemDialog.showModal();
}

async function saveItem(event) {
  event.preventDefault();
  const data = new FormData(itemForm);
  const itemId = asText(data.get("public_id"));
  const itemType = asText(data.get("item_type"));
  const payload = {
    item_type: itemType,
    parent_public_id: itemType === "title"
      ? null
      : asText(data.get("parent_public_id")),
    ordinal_number: itemType === "text"
      ? null
      : asText(data.get("ordinal_number")),
    short_text: asText(data.get("short_text")),
    long_text: asText(data.get("long_text")),
    quantity: itemType === "position" ? decimalForApi(data.get("quantity")) : null,
    unit: itemType === "position" ? asText(data.get("unit")) : null,
    unit_price: itemType === "position"
      ? decimalForApi(data.get("unit_price"))
      : null,
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
    setNotice(itemId ? "Element geändert." : "Element hinzugefügt.");
  } catch (error) {
    setNotice(error.message, true);
  }
}

function calculateExpression(expression) {
  const source = asText(expression)
    .replaceAll("×", "*")
    .replaceAll("·", "*")
    .replaceAll(":", "/")
    .replaceAll(",", ".")
    .replace(/\s+/g, "");
  if (!source || !/^[0-9+\-*/().]+$/.test(source)) return null;
  let index = 0;
  const parseNumber = () => {
    const start = index;
    while (/[0-9.]/.test(source[index] || "")) index += 1;
    if (start === index) return null;
    const value = Number(source.slice(start, index));
    return Number.isFinite(value) ? value : null;
  };
  const parseFactor = () => {
    if (source[index] === "+" || source[index] === "-") {
      const sign = source[index++] === "-" ? -1 : 1;
      const value = parseFactor();
      return value === null ? null : sign * value;
    }
    if (source[index] === "(") {
      index += 1;
      const value = parseSum();
      if (source[index] !== ")") return null;
      index += 1;
      return value;
    }
    return parseNumber();
  };
  const parseProduct = () => {
    let value = parseFactor();
    if (value === null) return null;
    while (source[index] === "*" || source[index] === "/") {
      const operator = source[index++];
      const right = parseFactor();
      if (right === null || (operator === "/" && right === 0)) return null;
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseSum = () => {
    let value = parseProduct();
    if (value === null) return null;
    while (source[index] === "+" || source[index] === "-") {
      const operator = source[index++];
      const right = parseProduct();
      if (right === null) return null;
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = parseSum();
  return index === source.length && Number.isFinite(result) ? result : null;
}

function renderCalculationRows() {
  calculationRows.replaceChildren();
  let total = 0;
  let valid = true;
  if (!state.calculationDraftRows.length) {
    state.calculationDraftRows.push({ expression: "", note: "" });
  }
  state.calculationDraftRows.forEach((rowData, rowIndex) => {
    const row = document.createElement("div");
    row.className = "calculation-row";
    const expression = document.createElement("input");
    expression.className = "calc-expression";
    expression.placeholder = "z. B. 2,50 × 4,00";
    expression.value = rowData.expression || "";
    expression.setAttribute("aria-label", `Rechenformel ${rowIndex + 1}`);
    const note = document.createElement("input");
    note.className = "calc-note";
    note.placeholder = "Erläuterung, z. B. Wand Nord";
    note.value = rowData.note || "";
    note.maxLength = 250;
    note.setAttribute("aria-label", `Erläuterung ${rowIndex + 1}`);
    const result = document.createElement("span");
    result.className = "calc-result";
    const remove = makeButton("×", "calc-remove", () => {
      state.calculationDraftRows.splice(rowIndex, 1);
      renderCalculationRows();
    }, `Rechenzeile ${rowIndex + 1} entfernen`);
    const update = () => {
      rowData.expression = expression.value;
      rowData.note = note.value;
      renderCalculationTotalsOnly();
    };
    expression.addEventListener("input", update);
    note.addEventListener("input", update);
    row.append(expression, result, note, remove);
    calculationRows.append(row);
    const value = calculateExpression(rowData.expression);
    if (value === null) {
      result.textContent = rowData.expression ? "Fehler" : "–";
      if (rowData.expression) {
        row.classList.add("invalid");
        valid = false;
      }
    } else {
      result.textContent = numberForDisplay(value, 3);
      total += value;
    }
  });
  calculationTotal.textContent = valid ? numberForDisplay(total, 3) : "–";
}

function renderCalculationTotalsOnly() {
  let total = 0;
  let valid = true;
  [...calculationRows.children].forEach((row, index) => {
    const value = calculateExpression(state.calculationDraftRows[index].expression);
    const result = row.querySelector(".calc-result");
    row.classList.toggle(
      "invalid",
      value === null && Boolean(state.calculationDraftRows[index].expression),
    );
    if (value === null) {
      result.textContent = state.calculationDraftRows[index].expression ? "Fehler" : "–";
      if (state.calculationDraftRows[index].expression) valid = false;
    } else {
      result.textContent = numberForDisplay(value, 3);
      total += value;
    }
  });
  calculationTotal.textContent = valid ? numberForDisplay(total, 3) : "–";
}

function loadCalculationBilling(entry = null) {
  state.calculationBillingId = entry?.public_id || null;
  calculationInvoice.value = entry?.invoice_number || "1";
  calculationNote.value = entry?.notes || "";
  state.calculationDraftRows = Array.isArray(entry?.calculation_rows)
    ? entry.calculation_rows.map((row) => ({
      expression: row.expression || "",
      note: row.note || "",
    }))
    : [];
  renderCalculationRows();
}

function renderCalculationStandPicker() {
  calculationBillingSelect.replaceChildren();
  for (const entry of state.calculationBillings) {
    const option = document.createElement("option");
    option.value = entry.public_id;
    option.textContent = `Rechnung ${entry.invoice_number}`;
    calculationBillingSelect.append(option);
  }
  calculationStandField.hidden = !state.calculationBillings.length;
  if (state.calculationBillings.length) {
    const selected = state.calculationBillings.find(
      (entry) => entry.public_id === state.calculationBillingId,
    ) || state.calculationBillings[0];
    calculationBillingSelect.value = selected.public_id;
    loadCalculationBilling(selected);
  } else {
    loadCalculationBilling();
  }
}

async function selectCalculationItem(item, preferredBillingId = null) {
  state.selectedCalculationItemId = item.public_id;
  renderItems();
  calculationEmpty.hidden = true;
  calculationForm.hidden = false;
  calculationTitle.textContent = item.ordinal_number || "Position";
  calculationSubtitle.textContent = item.short_text || "";
  calculationUnit.textContent = item.unit || "–";
  try {
    const response = await api(`/items/${encodeURIComponent(item.public_id)}/billings`);
    const payload = await response.json();
    state.calculationBillings = Array.isArray(payload.items) ? payload.items : [];
    state.calculationBillingId = state.calculationBillings.find(
      (entry) => entry.public_id === preferredBillingId,
    )?.public_id || (
      state.calculationBillings[0]?.public_id || null
    );
    renderCalculationStandPicker();
  } catch (error) {
    setNotice(error.message, true);
  }
}

async function saveCalculation(event) {
  event.preventDefault();
  const item = selectedCalculationItem();
  if (!item) return;
  const rows = state.calculationDraftRows
    .map((row) => ({
      expression: asText(row.expression).trim(),
      note: asText(row.note).trim(),
    }))
    .filter((row) => row.expression);
  if (!rows.length) {
    setNotice("Füge mindestens eine gültige Rechenzeile hinzu.", true);
    return;
  }
  if (rows.some((row) => calculateExpression(row.expression) === null)) {
    setNotice("Mindestens eine Rechenzeile ist ungültig.", true);
    return;
  }
  try {
    const response = await api(`/items/${encodeURIComponent(item.public_id)}/billings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_id: state.calculationBillingId,
        invoice_number: calculationInvoice.value.trim(),
        notes: calculationNote.value.trim(),
        calculation_rows: rows,
      }),
    });
    const saved = await response.json();
    state.calculationBillingId = saved.public_id;
    await loadItems();
    const refreshedItem = state.items.find(
      (candidate) => candidate.public_id === item.public_id,
    );
    if (refreshedItem) await selectCalculationItem(refreshedItem, saved.public_id);
    setNotice("Rechenweg und Aufmaßmenge gespeichert.");
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
  const hasCalculation = Boolean(entry?.calculation_rows?.length);
  billingForm.elements.billed_quantity.readOnly = hasCalculation;
  billingQuantityHint.textContent = hasCalculation
    ? "Die Menge wird aus dem Rechenweg rechts gebildet."
    : "";
  state.attachments = Array.isArray(entry?.attachments)
    ? entry.attachments.map((attachment) => ({ ...attachment }))
    : [];
  billingFiles.value = "";
  renderAttachments();
}

function renderBillingChooser(preferredId = null) {
  billingEntrySelect.replaceChildren();
  for (const entry of state.billings) {
    const option = document.createElement("option");
    option.value = entry.public_id;
    option.textContent = `Rechnung ${entry.invoice_number}`;
    billingEntrySelect.append(option);
  }
  existingBillingRow.hidden = !state.billings.length;
  if (state.billings.length) {
    const selected = state.billings.find((entry) => entry.public_id === preferredId)
      || state.billings[0];
    billingEntrySelect.value = selected.public_id;
    loadBillingIntoForm(selected);
  } else {
    loadBillingIntoForm();
    billingForm.elements.invoice_number.value = "1";
  }
}

async function openBillingDialog(item, preferredId = null) {
  hideContextMenu();
  state.billingItemId = item.public_id;
  billingForm.elements.item_id.value = item.public_id;
  billingDialogTitle.textContent = `${item.ordinal_number || "Position"} · ${item.short_text || ""}`;
  try {
    const response = await api(`/items/${encodeURIComponent(item.public_id)}/billings`);
    const payload = await response.json();
    state.billings = Array.isArray(payload.items) ? payload.items : [];
    renderBillingChooser(preferredId);
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
    const response = await api(
      `/items/${encodeURIComponent(state.billingItemId)}/billings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const saved = await response.json();
    billingDialog.close();
    await loadItems();
    if (state.mode === "billing") {
      const item = state.items.find(
        (candidate) => candidate.public_id === state.billingItemId,
      );
      if (item) {
        await selectCalculationItem(item, saved.public_id);
      }
    }
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
      `${report.imported_count} GAEB-Einträge importiert, ${report.skipped_count} übersprungen.`,
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
    const objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.download = match?.[1] || "leistungsverzeichnis.X84";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setNotice("GAEB DA XML 3.3 (X84) wurde exportiert.");
  } catch (error) {
    setNotice(error.message, true);
  }
}

async function handleContextAction(action) {
  const item = state.items.find(
    (candidate) => candidate.public_id === state.contextTargetId,
  ) || null;
  const parentId = item?.item_type === "title"
    ? item.public_id
    : (item?.parent_public_id || "");
  hideContextMenu();
  if (action === "add-title") openItemDialog("title");
  if (action === "add-section") {
    const sectionParentId = item?.item_type === "title"
      ? item.public_id
      : (item?.item_type === "section" ? item.parent_public_id : "");
    if (!sectionParentId) {
      setNotice("Lege zuerst einen Titel für den Teilbereich an.", true);
    } else {
      openItemDialog("section", null, sectionParentId);
    }
  }
  if (action === "add-position") openItemDialog("position", null, parentId);
  if (action === "add-text") openItemDialog("text", null, parentId);
  if (action === "edit" && item) openItemDialog(item.item_type, item);
  if (action === "bill" && item?.item_type === "position") openBillingDialog(item);
  if (action === "move-up" && item) await moveItemRelative(item, -1);
  if (action === "move-down" && item) await moveItemRelative(item, 1);
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
document.querySelectorAll("[data-context-action]").forEach((button) => {
  button.addEventListener("click", () => handleContextAction(button.dataset.contextAction));
});
document.addEventListener("click", (event) => {
  if (!contextMenu.contains(event.target)) hideContextMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
});
tablePane.addEventListener("contextmenu", (event) => {
  if (!event.target.closest("tr[data-item-id]")) showContextMenu(event);
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
    await api(`/lvs/${encodeURIComponent(created.public_id)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_type: "title",
        short_text: "Allgemeine Leistungen",
      }),
    });
    await loadItems();
    setNotice("Leistungsverzeichnis mit 01_TITEL angelegt.");
  } catch (error) {
    setNotice(error.message, true);
  }
});

lvSelect.addEventListener("change", async () => {
  state.selectedLvId = lvSelect.value;
  state.selectedCalculationItemId = null;
  searchInput.value = "";
  try {
    await loadItems();
  } catch (error) {
    setNotice(error.message, true);
  }
});
addTitleButton.addEventListener("click", () => openItemDialog("title"));
addSectionButton.addEventListener("click", () => {
  const firstTitle = titles()[0];
  if (!firstTitle) {
    setNotice("Lege zuerst einen Titel für den Teilbereich an.", true);
    return;
  }
  openItemDialog("section", null, firstTitle.public_id);
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
calculationForm.addEventListener("submit", saveCalculation);
addCalculationRowButton.addEventListener("click", () => {
  state.calculationDraftRows.push({ expression: "", note: "" });
  renderCalculationRows();
  calculationRows.querySelector(".calculation-row:last-child .calc-expression")?.focus();
});
calculationBillingSelect.addEventListener("change", () => {
  const entry = state.calculationBillings.find(
    (candidate) => candidate.public_id === calculationBillingSelect.value,
  );
  loadCalculationBilling(entry || null);
});
closeCalculationButton.addEventListener("click", () => {
  state.selectedCalculationItemId = null;
  calculationForm.hidden = true;
  calculationEmpty.hidden = false;
  renderItems();
});
openBillingDetailsButton.addEventListener("click", () => {
  const item = selectedCalculationItem();
  if (item) openBillingDialog(item, state.calculationBillingId);
});
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
