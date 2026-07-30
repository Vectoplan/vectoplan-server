/* Third editor iteration: sections, dual calculation paths and larger editors. */

openItemDialog = function openItemDialogV3(
  itemType,
  item = null,
  parentId = "",
) {
  hideContextMenu();
  itemForm.reset();
  itemForm.elements.public_id.value = item?.public_id || "";
  itemForm.elements.item_type.value = itemType;
  itemForm.elements.ordinal_number.value = item?.ordinal_number || "";
  itemForm.elements.short_text.value = item?.short_text || "";
  itemForm.elements.long_text.value = item?.long_text || "";
  itemForm.elements.quantity.value = item?.quantity || "";
  itemForm.elements.unit_price.value = item?.unit_price || "";
  populateParentSelect(itemType, item?.parent_public_id || parentId);
  populateUnitSelect(itemForm.elements.unit, item?.unit || "");

  const isPosition = itemType === "position";
  const isTitle = itemType === "title";
  const isSection = itemType === "section";
  itemDialogTitle.textContent = isTitle
    ? "Titel"
    : (isSection ? "Teilbereich" : (isPosition ? "Position" : "Textzeile"));
  itemDialogEyebrow.textContent = item
    ? "Element bearbeiten"
    : "Element hinzufügen";
  parentFieldLabel.textContent = isSection
    ? "Übergeordneter Titel"
    : "Titel oder Teilbereich";
  itemForm.querySelectorAll(".position-field").forEach((field) => {
    field.classList.toggle("hidden", !isPosition);
  });
  itemForm.querySelectorAll(".parent-field").forEach((field) => {
    field.classList.toggle("hidden", isTitle);
  });
  itemForm.querySelectorAll(".ordinal-field").forEach((field) => {
    field.classList.toggle("hidden", itemType === "text");
  });
  itemForm.elements.parent_public_id.required = isSection;
  itemForm.elements.short_text.required = itemType !== "text";
  itemDialog.showModal();
};

showContextMenu = function showContextMenuV3(event, item = null) {
  event.preventDefault();
  event.stopPropagation();
  state.contextTargetId = item?.public_id || null;
  contextMenu.querySelectorAll(".target-only").forEach((element) => {
    element.hidden = !item;
  });
  contextMenu.querySelectorAll(".position-only").forEach((element) => {
    element.hidden = item?.item_type !== "position";
  });
  contextMenu.querySelector('[data-context-action="add-title"]').hidden = (
    Boolean(item && item.item_type !== "title")
  );
  contextMenu.querySelector('[data-context-action="add-section"]').hidden = (
    !item || !["title", "section"].includes(item.item_type)
  );
  const maxLeft = window.innerWidth - 250;
  const maxTop = window.innerHeight - 330;
  contextMenu.style.left = `${Math.max(8, Math.min(event.clientX, maxLeft))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(event.clientY, maxTop))}px`;
  contextMenu.hidden = false;
};

renderCalculationRows = function renderCalculationRowsV3() {
  calculationRows.replaceChildren();
  let total = 0;
  let valid = true;
  if (!state.calculationDraftRows.length) {
    state.calculationDraftRows.push({ expression: "", note: "" });
  }
  state.calculationDraftRows.forEach((rowData, rowIndex) => {
    const row = document.createElement("div");
    row.className = "calculation-row";
    const rowNumber = document.createElement("span");
    rowNumber.className = "calc-row-number";
    rowNumber.textContent = String(rowIndex + 1);
    const expression = document.createElement("input");
    expression.className = "calc-expression";
    expression.placeholder = "z. B. 2,50 × 4,00";
    expression.value = rowData.expression || "";
    expression.setAttribute("aria-label", `Rechenformel ${rowIndex + 1}`);
    const result = document.createElement("span");
    result.className = "calc-result";
    const note = document.createElement("input");
    note.className = "calc-note";
    note.placeholder = "Beschreibung";
    note.value = rowData.note || "";
    note.maxLength = 250;
    note.setAttribute("aria-label", `Erläuterung ${rowIndex + 1}`);
    const remove = makeButton(
      "×",
      "calc-remove",
      () => {
        state.calculationDraftRows.splice(rowIndex, 1);
        renderCalculationRows();
      },
      `Rechenzeile ${rowIndex + 1} entfernen`,
    );
    const update = () => {
      rowData.expression = expression.value;
      rowData.note = note.value;
      renderCalculationTotalsOnly();
    };
    expression.addEventListener("input", update);
    note.addEventListener("input", update);
    row.append(rowNumber, expression, result, note, remove);
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
};

function renderCalculationAttachments() {
  calculationAttachmentList.replaceChildren();
  for (const [index, attachment] of state.calculationAttachments.entries()) {
    const row = document.createElement("div");
    row.className = "attachment-row";
    const name = document.createElement("span");
    name.textContent = attachment.name;
    const size = document.createElement("span");
    size.textContent = attachment.size
      ? `${Math.max(1, Math.round(attachment.size / 1024))} KB`
      : "Metadaten";
    const remove = makeButton("Entfernen", "", () => {
      state.calculationAttachments.splice(index, 1);
      renderCalculationAttachments();
    });
    row.append(name, size, remove);
    calculationAttachmentList.append(row);
  }
}

function loadLvCalculation(item) {
  state.calculationBillingId = null;
  calculationNote.value = item.calculation_note || "";
  state.calculationDraftRows = Array.isArray(item.calculation_rows)
    ? item.calculation_rows.map((row) => ({
      expression: row.expression || "",
      note: row.note || "",
    }))
    : [];
  state.calculationAttachments = Array.isArray(item.calculation_attachments)
    ? item.calculation_attachments.map((attachment) => ({ ...attachment }))
    : [];
  calculationFiles.value = "";
  renderCalculationRows();
  renderCalculationAttachments();
}

loadCalculationBilling = function loadCalculationBillingV3(entry = null) {
  state.calculationBillingId = entry?.public_id || null;
  calculationInvoice.value = entry?.invoice_number || "1";
  calculationNote.value = entry?.notes || "";
  state.calculationDraftRows = Array.isArray(entry?.calculation_rows)
    ? entry.calculation_rows.map((row) => ({
      expression: row.expression || "",
      note: row.note || "",
    }))
    : [];
  state.calculationAttachments = Array.isArray(entry?.attachments)
    ? entry.attachments.map((attachment) => ({ ...attachment }))
    : [];
  calculationFiles.value = "";
  renderCalculationRows();
  renderCalculationAttachments();
};

selectCalculationItem = async function selectCalculationItemV3(
  item,
  preferredBillingId = null,
) {
  state.selectedCalculationItemId = item.public_id;
  renderItems();
  calculationEmpty.hidden = true;
  calculationForm.hidden = false;
  calculationTitle.textContent = item.ordinal_number || "Position";
  calculationSubtitle.textContent = item.short_text || "";
  calculationUnit.textContent = item.unit || "–";
  if (state.mode === "lv") {
    calculationStandField.hidden = true;
    loadLvCalculation(item);
    return;
  }
  try {
    const response = await api(
      `/items/${encodeURIComponent(item.public_id)}/billings`,
    );
    const payload = await response.json();
    state.calculationBillings = Array.isArray(payload.items)
      ? payload.items
      : [];
    state.calculationBillingId = state.calculationBillings.find(
      (entry) => entry.public_id === preferredBillingId,
    )?.public_id || (
      state.calculationBillings[0]?.public_id || null
    );
    renderCalculationStandPicker();
  } catch (error) {
    setNotice(error.message, true);
  }
};

async function saveCalculationV3(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const item = selectedCalculationItem();
  if (!item) return;
  const rows = state.calculationDraftRows
    .map((row) => ({
      expression: asText(row.expression).trim(),
      note: asText(row.note).trim(),
    }))
    .filter((row) => row.expression || row.note);
  if (rows.some(
    (row) => row.expression && calculateExpression(row.expression) === null,
  )) {
    setNotice("Mindestens eine Rechenzeile ist ungültig.", true);
    return;
  }
  try {
    if (state.mode === "lv") {
      const response = await api(
        `/items/${encodeURIComponent(item.public_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calculation_rows: rows,
            calculation_note: calculationNote.value.trim(),
            calculation_attachments: state.calculationAttachments,
          }),
        },
      );
      const saved = await response.json();
      state.items = state.items.map((candidate) =>
        candidate.public_id === saved.public_id ? saved : candidate
      );
      renderItems();
      loadLvCalculation(saved);
      setNotice("Kalkulationsrechenweg und LV-Menge gespeichert.");
      return;
    }

    const response = await api(
      `/items/${encodeURIComponent(item.public_id)}/billings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id: state.calculationBillingId,
          invoice_number: calculationInvoice.value.trim(),
          notes: calculationNote.value.trim(),
          calculation_rows: rows,
          attachments: state.calculationAttachments,
        }),
      },
    );
    const saved = await response.json();
    state.calculationBillingId = saved.public_id;
    await loadItems();
    const refreshedItem = state.items.find(
      (candidate) => candidate.public_id === item.public_id,
    );
    if (refreshedItem) {
      await selectCalculationItem(refreshedItem, saved.public_id);
    }
    setNotice("Rechenweg, Aufmaßmenge und Dokumente gespeichert.");
  } catch (error) {
    setNotice(error.message, true);
  }
}

calculationForm.addEventListener("submit", saveCalculationV3, true);
calculationFiles.addEventListener("change", () => {
  for (const file of calculationFiles.files || []) {
    state.calculationAttachments.push({
      name: file.name,
      size: file.size,
      content_type: file.type || "application/octet-stream",
    });
  }
  calculationFiles.value = "";
  renderCalculationAttachments();
});

handleContextAction = async function handleContextActionV3(action) {
  const item = state.items.find(
    (candidate) => candidate.public_id === state.contextTargetId,
  ) || null;
  const directParentId = item && ["title", "section"].includes(item.item_type)
    ? item.public_id
    : (item?.parent_public_id || "");
  hideContextMenu();

  if (action === "add-title") {
    openItemDialog("title");
  } else if (action === "add-section") {
    const titleId = item?.item_type === "title"
      ? item.public_id
      : (item?.item_type === "section"
        ? item.parent_public_id
        : item?.parent_public_id);
    openItemDialog("section", null, titleId || "");
  } else if (action === "add-position") {
    openItemDialog("position", null, directParentId);
  } else if (action === "add-text") {
    openItemDialog("text", null, directParentId);
  } else if (action === "edit" && item) {
    openItemDialog(item.item_type, item);
  } else if (action === "move-up" && item) {
    await moveItemRelative(item, -1);
  } else if (action === "move-down" && item) {
    await moveItemRelative(item, 1);
  } else if (action === "bill" && item?.item_type === "position") {
    openBillingDialog(item);
  }
};

setMode(state.mode);
