/* Fourth editor iteration: visual hierarchy and spreadsheet keyboard flow. */

function installCalculationLayoutV4() {
  if (calculationForm.querySelector(".calculation-sheet")) return;

  const heading = calculationForm.querySelector(".calculation-heading");
  const listHeading = calculationForm.querySelector(".calculation-list-heading");
  const gridHeader = calculationForm.querySelector(".calculation-grid-header");
  const total = calculationForm.querySelector(".calculation-total");
  const upload = calculationFiles.closest(".calculation-upload");
  const invoiceField = calculationInvoice.closest("label");
  const noteField = calculationNote.closest("label");

  const meta = document.createElement("div");
  meta.className = "calculation-meta";
  meta.setAttribute("aria-label", "Dokumente und Angaben");
  heading.after(meta);
  meta.append(
    upload,
    calculationAttachmentList,
    calculationStandField,
    invoiceField,
    noteField,
  );

  const sheet = document.createElement("section");
  sheet.className = "calculation-sheet";
  sheet.setAttribute("aria-label", "Excel-ähnlicher Rechenweg");
  meta.after(sheet);
  sheet.append(listHeading, gridHeader, calculationRows, total);
}

const renderItemRowBeforeV4 = renderItemRow;
renderItemRow = function renderItemRowV4(item) {
  const row = renderItemRowBeforeV4(item);
  const parent = state.items.find(
    (candidate) => candidate.public_id === item.parent_public_id,
  );
  const depth = parent?.item_type === "section"
    ? 2
    : (parent?.item_type === "title" ? 1 : 0);
  const depthClass = {
    0: "hierarchy-depth-0",
    1: "hierarchy-depth-1",
    2: "hierarchy-depth-2",
  }[depth];
  row.classList.add(depthClass);
  row.dataset.hierarchyDepth = String(depth);
  return row;
};

function focusCalculationCellV4(rowIndex, selector) {
  requestAnimationFrame(() => {
    const rows = calculationRows.querySelectorAll(".calculation-row");
    const target = rows[rowIndex]?.querySelector(selector);
    if (!target) return;
    target.focus();
    if (target.select) target.select();
    target.scrollIntoView({ block: "nearest" });
  });
}

renderCalculationRows = function renderCalculationRowsV4() {
  calculationRows.replaceChildren();
  let total = 0;
  let valid = true;
  if (!state.calculationDraftRows.length) {
    state.calculationDraftRows.push({ expression: "", note: "" });
  }

  state.calculationDraftRows.forEach((rowData, rowIndex) => {
    const row = document.createElement("div");
    row.className = "calculation-row";
    row.setAttribute("role", "row");

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
        focusCalculationCellV4(
          Math.max(0, Math.min(rowIndex, state.calculationDraftRows.length - 1)),
          ".calc-expression",
        );
      },
      `Rechenzeile ${rowIndex + 1} entfernen`,
    );
    remove.tabIndex = -1;

    const update = () => {
      rowData.expression = expression.value;
      rowData.note = note.value;
      renderCalculationTotalsOnly();
    };
    expression.addEventListener("input", update);
    note.addEventListener("input", update);

    expression.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      if (event.shiftKey) {
        if (rowIndex === 0) return;
        event.preventDefault();
        focusCalculationCellV4(rowIndex - 1, ".calc-note");
        return;
      }
      event.preventDefault();
      note.focus();
      note.select();
    });

    note.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      if (event.shiftKey) {
        expression.focus();
        expression.select();
        return;
      }
      if (rowIndex === state.calculationDraftRows.length - 1) {
        state.calculationDraftRows.push({ expression: "", note: "" });
        renderCalculationRows();
      }
      focusCalculationCellV4(rowIndex + 1, ".calc-expression");
    });

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

installCalculationLayoutV4();
renderItems();
renderCalculationRows();
