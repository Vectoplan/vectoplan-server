/* Fifth editor iteration: clean LV table, comments and block-safe title moves. */

const setModeBeforeV5 = setMode;
setMode = function setModeV5(mode) {
  root.dataset.workspaceMode = mode;
  setModeBeforeV5(mode);
};

const setNoticeBeforeV5 = setNotice;
setNotice = function setNoticeV5(message, isError = false) {
  const cleaned = asText(message).replaceAll("_TITEL", "");
  setNoticeBeforeV5(cleaned, isError);
};

const renderTitleRowBeforeV5 = renderTitleRow;
renderTitleRow = function renderTitleRowV5(title) {
  const row = renderTitleRowBeforeV5(title);
  row.cells[1].textContent = title.ordinal_number || "00";
  return row;
};

const populateParentSelectBeforeV5 = populateParentSelect;
populateParentSelect = function populateParentSelectV5(itemType, selected = "") {
  populateParentSelectBeforeV5(itemType, selected);
  for (const option of itemForm.elements.parent_public_id.options) {
    option.textContent = option.textContent
      .replaceAll("_TITEL", "")
      .replaceAll("_TEILBEREICH", "");
  }
};

function titleBlockOrderV5(titleOrder) {
  const ordered = orderedItems();
  const result = [];
  const included = new Set();
  const append = (item) => {
    if (!item || included.has(item.public_id)) return;
    included.add(item.public_id);
    result.push(item);
  };

  for (const title of titleOrder) {
    append(title);
    const children = ordered.filter(
      (item) => item.parent_public_id === title.public_id,
    );
    for (const child of children) {
      append(child);
      if (child.item_type === "section") {
        ordered
          .filter((item) => item.parent_public_id === child.public_id)
          .forEach(append);
      }
    }
  }
  ordered.forEach(append);
  return result;
}

async function moveTitleRelativeV5(item, direction) {
  const titleOrder = titles();
  const currentIndex = titleOrder.findIndex(
    (candidate) => candidate.public_id === item.public_id,
  );
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= titleOrder.length) {
    setNotice(
      direction < 0
        ? "Der Titel steht bereits ganz oben."
        : "Der Titel steht bereits ganz unten.",
    );
    return;
  }
  [titleOrder[currentIndex], titleOrder[targetIndex]] = [
    titleOrder[targetIndex],
    titleOrder[currentIndex],
  ];
  await persistOrder(titleBlockOrderV5(titleOrder));
}

const moveItemRelativeBeforeV5 = moveItemRelative;
moveItemRelative = async function moveItemRelativeV5(item, direction) {
  if (item.item_type === "title") {
    await moveTitleRelativeV5(item, direction);
    return;
  }
  await moveItemRelativeBeforeV5(item, direction);
};

const moveByDropBeforeV5 = moveByDrop;
moveByDrop = async function moveByDropV5(draggedId, target) {
  const dragged = state.items.find((item) => item.public_id === draggedId);
  if (dragged?.item_type !== "title" || target.item_type !== "title") {
    await moveByDropBeforeV5(draggedId, target);
    return;
  }
  const titleOrder = titles();
  const from = titleOrder.findIndex((item) => item.public_id === draggedId);
  const to = titleOrder.findIndex(
    (item) => item.public_id === target.public_id,
  );
  if (from < 0 || to < 0 || from === to) return;
  const [moving] = titleOrder.splice(from, 1);
  titleOrder.splice(to, 0, moving);
  await persistOrder(titleBlockOrderV5(titleOrder));
};

const calculationNoteFieldV5 = calculationNote.closest("label");
calculationNoteFieldV5.hidden = true;
calculationNoteFieldV5.classList.add("removed-calculation-note");

const renderCalculationRowsBeforeV5 = renderCalculationRows;
renderCalculationRows = function renderCalculationRowsV5() {
  renderCalculationRowsBeforeV5();
  const gridHeaders = calculationForm.querySelectorAll(
    ".calculation-grid-header span",
  );
  if (gridHeaders[3]) gridHeaders[3].textContent = "Kommentar";
  calculationRows.querySelectorAll(".calc-note").forEach((input, index) => {
    input.placeholder = "Kommentar zur Rechenzeile";
    input.setAttribute("aria-label", `Kommentar ${index + 1}`);
  });
};

setMode(state.mode);
renderCalculationRows();
