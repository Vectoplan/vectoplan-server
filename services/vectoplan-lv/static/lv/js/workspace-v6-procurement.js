/* Sixth editor iteration: focused supplier inquiries and offer responses. */

const procurementView = document.querySelector("#procurement-view");
const inquiryPositionList = document.querySelector("#inquiry-position-list");
const inquirySelectedCount = document.querySelector("#inquiry-selected-count");
const inquiryHistoryCount = document.querySelector("#inquiry-history-count");
const inquiryList = document.querySelector("#inquiry-list");
const createInquiryButton = document.querySelector("#create-inquiry");
const openInquiryWorkspaceButton = document.querySelector(
  "#open-inquiry-workspace",
);
const selectAllInquiryPositionsButton = document.querySelector(
  "#select-all-inquiry-positions",
);
const clearInquiryPositionsButton = document.querySelector(
  "#clear-inquiry-positions",
);
const refreshInquiriesButton = document.querySelector("#refresh-inquiries");
const inquiryDialog = document.querySelector("#inquiry-dialog");
const inquiryForm = document.querySelector("#inquiry-form");
const inquirySelectionSummary = document.querySelector(
  "#inquiry-selection-summary",
);
const inquiryRecipientList = document.querySelector("#inquiry-recipient-list");
const addInquiryRecipientButton = document.querySelector(
  "#add-inquiry-recipient",
);
const inquirySuggestionStatus = document.querySelector(
  "#inquiry-suggestion-status",
);
const responseDialog = document.querySelector("#inquiry-response-dialog");
const responseForm = document.querySelector("#inquiry-response-form");
const responseCompany = document.querySelector("#response-company");

state.inquiries = [];
state.inquirySelectedIds = new Set();
state.inquiriesLoading = false;
state.inquiriesAvailable = true;

const INQUIRY_STATUS = {
  draft: "Entwurf",
  queued: "Versand vorgemerkt",
  sent: "Zugestellt",
  offers_received: "Angebote eingegangen",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

const RECIPIENT_STATUS = {
  queued: "Übergabe ausstehend",
  sent: "Zugestellt",
  responded: "Angebot erhalten",
  declined: "Abgesagt",
  failed: "Versand fehlgeschlagen",
};

function procurementPositionItems() {
  return orderedItems().filter((item) => item.item_type === "position");
}

function displayDate(value) {
  if (!value) return "ohne Frist";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return asText(value);
  return new Intl.DateTimeFormat("de-DE").format(parsed);
}

function element(tagName, className = "", text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function positionPath(item) {
  const parent = state.items.find(
    (candidate) => candidate.public_id === item.parent_public_id,
  );
  if (!parent) return "Ohne Gliederung";
  const grandparent = state.items.find(
    (candidate) => candidate.public_id === parent.parent_public_id,
  );
  return [grandparent?.short_text, parent.short_text]
    .filter(Boolean)
    .join(" / ");
}

function updateInquirySelection() {
  const count = state.inquirySelectedIds.size;
  inquirySelectedCount.textContent = `${count} ${
    count === 1 ? "Position ausgewählt" : "Positionen ausgewählt"
  }`;
  createInquiryButton.disabled = (
    count === 0 || state.inquiriesAvailable === false
  );
  clearInquiryPositionsButton.disabled = count === 0;
}

function renderInquiryPositions() {
  inquiryPositionList.replaceChildren();
  const positions = procurementPositionItems();
  openInquiryWorkspaceButton.disabled = !state.selectedLvId || !positions.length;
  if (!state.selectedLvId || !positions.length) {
    const empty = element("div", "procurement-empty");
    empty.append(
      element(
        "strong",
        "",
        state.selectedLvId
          ? "Noch keine anfragbaren Positionen"
          : "Noch kein Leistungsverzeichnis ausgewählt",
      ),
      element(
        "span",
        "",
        state.selectedLvId
          ? "Lege im LV zuerst mindestens eine Position an."
          : "Wähle oder erstelle ein LV, um Anfragen vorzubereiten.",
      ),
    );
    inquiryPositionList.append(empty);
    updateInquirySelection();
    return;
  }

  const availableIds = new Set(positions.map((item) => item.public_id));
  state.inquirySelectedIds = new Set(
    [...state.inquirySelectedIds].filter((publicId) =>
      availableIds.has(publicId)
    ),
  );
  for (const item of positions) {
    const row = element("label", "inquiry-position-row");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.inquirySelectedIds.has(item.public_id);
    checkbox.setAttribute(
      "aria-label",
      `${item.ordinal_number || "Position"} auswählen`,
    );
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.inquirySelectedIds.add(item.public_id);
      } else {
        state.inquirySelectedIds.delete(item.public_id);
      }
      row.classList.toggle("selected", checkbox.checked);
      updateInquirySelection();
    });

    const copy = element("span", "inquiry-position-copy");
    const titleLine = element("span", "inquiry-position-title");
    titleLine.append(
      element("strong", "", item.ordinal_number || "–"),
      element("span", "", item.short_text || "Ohne Kurztext"),
    );
    copy.append(
      titleLine,
      element("small", "", positionPath(item)),
    );
    const quantity = element(
      "span",
      "inquiry-position-quantity",
      `${numberForDisplay(item.quantity, 3)} ${item.unit || ""}`.trim(),
    );
    row.classList.toggle("selected", checkbox.checked);
    row.append(checkbox, copy, quantity);
    inquiryPositionList.append(row);
  }
  updateInquirySelection();
}

function assessmentBlock(offer) {
  const block = element("div", "llm-assessment");
  const assessment = offer?.llm_assessment;
  if (!assessment) {
    block.classList.add("pending");
    block.append(
      element("span", "llm-mark", "KI"),
      element("span", "", "Analyse ausstehend"),
    );
    return block;
  }
  const recommendation = asText(
    assessment.recommendation || assessment.classification || "Bewertet",
  );
  const score = assessment.score !== undefined
    ? ` · ${assessment.score}/100`
    : "";
  block.append(
    element("span", "llm-mark", "KI"),
    element("strong", "", `${recommendation}${score}`),
  );
  if (assessment.summary) {
    block.append(element("p", "", assessment.summary));
  }
  return block;
}

function openInquiryResponse(inquiry, recipient) {
  responseForm.reset();
  responseForm.elements.inquiry_public_id.value = inquiry.public_id;
  responseForm.elements.recipient_public_id.value = recipient.public_id;
  responseCompany.textContent = `${recipient.company_name} · ${recipient.contact_email}`;
  const offer = recipient.offer;
  responseForm.elements.response_type.value = (
    recipient.status === "declined" ? "declined" : "offer"
  );
  responseForm.elements.total_amount.value = offer?.total_amount || "";
  responseForm.elements.delivery_days.value = offer?.delivery_days ?? "";
  responseForm.elements.valid_until.value = offer?.valid_until || "";
  responseForm.elements.message.value = offer?.message || "";
  toggleOfferResponseFields();
  responseDialog.showModal();
}

function renderInquiryRecipient(inquiry, recipient) {
  const row = element("div", "inquiry-recipient");
  const company = element("div", "recipient-company");
  company.append(
    element("strong", "", recipient.company_name),
    element("span", "", recipient.contact_email),
  );
  if (recipient.distance_km) {
    company.append(
      element("small", "", `${numberForDisplay(recipient.distance_km, 0)} km`),
    );
  }

  const stateBlock = element("div", "recipient-state");
  const status = element(
    "span",
    `status-badge status-${recipient.status}`,
    RECIPIENT_STATUS[recipient.status] || recipient.status,
  );
  stateBlock.append(status);
  if (recipient.delivery_error) {
    stateBlock.append(
      element("small", "delivery-error", recipient.delivery_error),
    );
  }

  const response = element("div", "recipient-offer");
  if (recipient.offer) {
    response.append(
      element(
        "strong",
        "offer-amount",
        currencyForDisplay(recipient.offer.total_amount),
      ),
    );
    const offerMeta = [];
    if (recipient.offer.delivery_days !== null) {
      offerMeta.push(`${recipient.offer.delivery_days} Tage`);
    }
    if (recipient.offer.valid_until) {
      offerMeta.push(`gültig bis ${displayDate(recipient.offer.valid_until)}`);
    }
    if (offerMeta.length) {
      response.append(element("span", "", offerMeta.join(" · ")));
    }
    response.append(assessmentBlock(recipient.offer));
  } else if (recipient.status === "declined") {
    response.append(element("span", "muted", "Kein Angebot abgegeben"));
  } else {
    response.append(element("span", "muted", "Noch keine Antwort"));
  }

  const action = makeButton(
    recipient.offer || recipient.status === "declined"
      ? "Antwort bearbeiten"
      : "Antwort erfassen",
    "recipient-response-action",
    () => openInquiryResponse(inquiry, recipient),
  );
  row.append(company, stateBlock, response, action);
  return row;
}

function renderInquiries() {
  inquiryList.replaceChildren();
  const count = state.inquiries.length;
  inquiryHistoryCount.textContent = `${count} ${
    count === 1 ? "Anfrage" : "Anfragen"
  }`;
  if (!state.selectedLvId) {
    const empty = element("div", "procurement-empty");
    empty.append(
      element("strong", "", "Kein LV ausgewählt"),
      element("span", "", "Wähle links oben ein Leistungsverzeichnis."),
    );
    inquiryList.append(empty);
    return;
  }
  if (state.inquiriesAvailable === false) {
    const empty = element("div", "procurement-empty");
    empty.append(
      element("strong", "", "Anfragefunktion wird vorbereitet"),
      element(
        "span",
        "",
        "Nach dem nächsten Backend-Start ist der Versand hier verfügbar.",
      ),
    );
    inquiryList.append(empty);
    return;
  }
  if (state.inquiriesLoading) {
    inquiryList.append(
      element("div", "procurement-empty", "Anfragen werden geladen …"),
    );
    return;
  }
  if (!count) {
    const empty = element("div", "procurement-empty");
    empty.append(
      element("strong", "", "Noch keine Anfrage"),
      element(
        "span",
        "",
        "Wähle links Positionen aus und sende sie gemeinsam zur Anfrage.",
      ),
    );
    inquiryList.append(empty);
    return;
  }

  for (const inquiry of state.inquiries) {
    const card = element("article", "inquiry-card");
    const header = element("header", "inquiry-card-header");
    const heading = element("div");
    heading.append(
      element("h2", "", inquiry.title),
      element(
        "p",
        "",
        `${inquiry.item_count} ${
          inquiry.item_count === 1 ? "Position" : "Positionen"
        } · ${inquiry.recipient_count} ${
          inquiry.recipient_count === 1 ? "Empfänger" : "Empfänger"
        } · Frist ${displayDate(inquiry.due_date)}`,
      ),
    );
    header.append(
      heading,
      element(
        "span",
        `status-badge status-${inquiry.status}`,
        INQUIRY_STATUS[inquiry.status] || inquiry.status,
      ),
    );

    const itemSummary = element("div", "inquiry-item-summary");
    inquiry.items.slice(0, 4).forEach((item) => {
      itemSummary.append(
        element(
          "span",
          "",
          `${item.ordinal_number || "–"} · ${item.short_text || "Position"}`,
        ),
      );
    });
    if (inquiry.items.length > 4) {
      itemSummary.append(
        element("span", "more-items", `+${inquiry.items.length - 4} weitere`),
      );
    }
    card.append(header, itemSummary);
    if (inquiry.message) {
      card.append(element("p", "inquiry-message", inquiry.message));
    }

    const recipients = element("div", "inquiry-recipient-list");
    if (!inquiry.recipients.length) {
      recipients.append(
        element(
          "div",
          "inquiry-recipient-empty",
          "Entwurf ohne Empfänger",
        ),
      );
    } else {
      inquiry.recipients.forEach((recipient) => {
        recipients.append(renderInquiryRecipient(inquiry, recipient));
      });
    }
    card.append(recipients);
    inquiryList.append(card);
  }
}

async function loadInquiries() {
  if (!state.selectedLvId) {
    state.inquiries = [];
    state.inquiriesLoading = false;
    renderInquiries();
    return;
  }
  setNotice("");
  state.inquiriesLoading = true;
  renderInquiries();
  try {
    const response = await fetch(
      `${state.apiBase}/lvs/${encodeURIComponent(state.selectedLvId)}/inquiries`,
      { headers: projectHeaders() },
    );
    if (response.status === 404) {
      state.inquiries = [];
      state.inquiriesAvailable = false;
      return;
    }
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
    const payload = await response.json();
    state.inquiriesAvailable = true;
    state.inquiries = Array.isArray(payload.items) ? payload.items : [];
  } catch (error) {
    state.inquiries = [];
    setNotice(error.message, true);
  } finally {
    state.inquiriesLoading = false;
    renderInquiries();
    updateInquirySelection();
  }
}

function addRecipientRow(suggestion = null) {
  const row = element("div", "recipient-form-row");
  row.dataset.source = suggestion?.source || (
    suggestion ? "suggestion" : "manual"
  );
  row.dataset.externalCompanyId = suggestion?.external_company_id || "";
  row.dataset.distanceKm = suggestion?.distance_km || "";
  row.dataset.matchedServices = JSON.stringify(
    suggestion?.matched_services || [],
  );
  row.dataset.matchReasons = JSON.stringify(suggestion?.match_reasons || []);

  const company = document.createElement("input");
  company.name = "recipient_company_name";
  company.placeholder = "Unternehmen";
  company.value = suggestion?.company_name || "";
  company.maxLength = 250;
  company.required = true;
  company.setAttribute("aria-label", "Unternehmen");

  const email = document.createElement("input");
  email.type = "email";
  email.name = "recipient_contact_email";
  email.placeholder = "E-Mail";
  email.value = suggestion?.contact_email || "";
  email.maxLength = 320;
  email.required = true;
  email.setAttribute("aria-label", "Empfänger-E-Mail");

  const contact = document.createElement("input");
  contact.name = "recipient_contact_name";
  contact.placeholder = "Ansprechperson (optional)";
  contact.value = suggestion?.contact_name || "";
  contact.maxLength = 250;
  contact.setAttribute("aria-label", "Ansprechperson");

  const remove = makeButton(
    "×",
    "remove-recipient",
    () => {
      row.remove();
      if (!inquiryRecipientList.children.length) addRecipientRow();
    },
    "Empfänger entfernen",
  );
  row.append(company, email, contact, remove);
  inquiryRecipientList.append(row);
}

function selectedInquiryItems() {
  return procurementPositionItems().filter((item) =>
    state.inquirySelectedIds.has(item.public_id)
  );
}

async function loadRecipientSuggestions() {
  inquirySuggestionStatus.textContent =
    "Automatische Unternehmensvorschläge werden geprüft …";
  const query = [...state.inquirySelectedIds]
    .map((publicId) => `item_public_id=${encodeURIComponent(publicId)}`)
    .join("&");
  try {
    const response = await api(
      `/lvs/${encodeURIComponent(state.selectedLvId)}/recipient-suggestions?${query}`,
    );
    const payload = await response.json();
    const suggestions = Array.isArray(payload.items) ? payload.items : [];
    if (suggestions.length) {
      inquiryRecipientList.replaceChildren();
      suggestions.forEach((suggestion) => addRecipientRow(suggestion));
      inquirySuggestionStatus.textContent =
        `${suggestions.length} passende Unternehmen automatisch vorgeschlagen.`;
    } else {
      inquirySuggestionStatus.textContent =
        "Firmenverzeichnis noch nicht verbunden · Empfänger vorübergehend manuell ergänzen.";
    }
  } catch (error) {
    inquirySuggestionStatus.textContent =
      "Unternehmensvorschläge konnten nicht geladen werden.";
  }
}

function openInquiryDialog() {
  const selected = selectedInquiryItems();
  if (!selected.length) {
    setNotice("Wähle mindestens eine Position für die Anfrage aus.", true);
    return;
  }
  inquiryForm.reset();
  inquiryRecipientList.replaceChildren();
  addRecipientRow();
  const label = selected.length === 1
    ? `${selected[0].ordinal_number || "Position"} · ${selected[0].short_text || ""}`
    : `${selected.length} ausgewählte LV-Positionen`;
  inquirySelectionSummary.textContent = label;
  inquiryForm.elements.title.value = selected.length === 1
    ? `Preisanfrage · ${selected[0].short_text || selected[0].ordinal_number}`
    : `Preisanfrage · ${selected.length} LV-Positionen`;
  const due = new Date();
  due.setDate(due.getDate() + 14);
  inquiryForm.elements.due_date.value = due.toISOString().slice(0, 10);
  inquiryForm.elements.message.value =
    "Bitte senden Sie uns Ihr Angebot für die aufgeführten Leistungen bis zum genannten Termin.";
  inquiryDialog.showModal();
  loadRecipientSuggestions();
}

function recipientPayloads() {
  return [...inquiryRecipientList.querySelectorAll(".recipient-form-row")]
    .map((row) => ({
      external_company_id: row.dataset.externalCompanyId || null,
      company_name: row.querySelector(
        '[name="recipient_company_name"]',
      ).value.trim(),
      contact_name: row.querySelector(
        '[name="recipient_contact_name"]',
      ).value.trim() || null,
      contact_email: row.querySelector(
        '[name="recipient_contact_email"]',
      ).value.trim(),
      source: row.dataset.source || "manual",
      distance_km: row.dataset.distanceKm || null,
      matched_services: JSON.parse(row.dataset.matchedServices || "[]"),
      match_reasons: JSON.parse(row.dataset.matchReasons || "[]"),
    }));
}

async function saveInquiry(event) {
  event.preventDefault();
  const recipients = recipientPayloads();
  const data = new FormData(inquiryForm);
  try {
    const response = await api(
      `/lvs/${encodeURIComponent(state.selectedLvId)}/inquiries`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_public_ids: [...state.inquirySelectedIds],
          title: asText(data.get("title")),
          due_date: asText(data.get("due_date")) || null,
          message: asText(data.get("message")),
          recipients,
          queue_for_delivery: true,
        }),
      },
    );
    const created = await response.json();
    inquiryDialog.close();
    state.inquirySelectedIds.clear();
    renderInquiryPositions();
    await loadInquiries();
    setNotice(
      `Anfrage für ${created.recipient_count} ${
        created.recipient_count === 1 ? "Empfänger" : "Empfänger"
      } vorgemerkt. Die Zustellung startet nach Anschluss des E-Mail-Dienstes.`,
    );
  } catch (error) {
    setNotice(error.message, true);
  }
}

function toggleOfferResponseFields() {
  const isOffer = responseForm.elements.response_type.value === "offer";
  responseForm.querySelectorAll(".offer-response-field").forEach((field) => {
    field.hidden = !isOffer;
  });
  responseForm.elements.total_amount.required = isOffer;
}

async function saveInquiryResponse(event) {
  event.preventDefault();
  const data = new FormData(responseForm);
  const inquiryId = asText(data.get("inquiry_public_id"));
  try {
    await api(`/inquiries/${encodeURIComponent(inquiryId)}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_public_id: asText(data.get("recipient_public_id")),
        response_type: asText(data.get("response_type")),
        total_amount: decimalForApi(data.get("total_amount")),
        delivery_days: asText(data.get("delivery_days")) || null,
        valid_until: asText(data.get("valid_until")) || null,
        message: asText(data.get("message")),
      }),
    });
    responseDialog.close();
    await loadInquiries();
    setNotice(
      data.get("response_type") === "declined"
        ? "Absage wurde erfasst."
        : "Angebot wurde erfasst. Die KI-Analyse ist vorgemerkt.",
    );
  } catch (error) {
    setNotice(error.message, true);
  }
}

const loadItemsBeforeV6 = loadItems;
loadItems = async function loadItemsV6() {
  await loadItemsBeforeV6();
  renderInquiryPositions();
  if (state.mode === "procurement") await loadInquiries();
};

const setModeBeforeV6 = setMode;
setMode = function setModeV6(mode) {
  setModeBeforeV6(mode);
  const procurementMode = mode === "procurement";
  editorShell.hidden = procurementMode;
  procurementView.hidden = !procurementMode;
  searchInput.closest(".search").hidden = procurementMode;
  if (procurementMode) {
    setNotice("");
    workspaceTitle.textContent = "Anfragen & Angebote";
    workspaceEyebrow.textContent = "Automatisierte Vergabevorbereitung";
    interactionHint.textContent =
      "Positionen wählen · gemeinsam anfragen · Angebote vergleichen";
    selectedLvMeta.textContent = selectedLv()
      ? `${selectedLv().name} · Empfänger und Zustellung werden integrationsbereit gespeichert`
      : "Wähle ein LV, um eine Anfrage vorzubereiten.";
    renderInquiryPositions();
    loadInquiries();
  } else {
    if (state.inquiriesAvailable === false) {
      setNotice("");
    }
    renderLvSelection();
    renderItems();
  }
};

openInquiryWorkspaceButton.addEventListener("click", () => {
  const selected = selectedCalculationItem();
  if (selected?.item_type === "position") {
    state.inquirySelectedIds.add(selected.public_id);
  }
  setMode("procurement");
});
selectAllInquiryPositionsButton.addEventListener("click", () => {
  state.inquirySelectedIds = new Set(
    procurementPositionItems().map((item) => item.public_id),
  );
  renderInquiryPositions();
});
clearInquiryPositionsButton.addEventListener("click", () => {
  state.inquirySelectedIds.clear();
  renderInquiryPositions();
});
createInquiryButton.addEventListener("click", openInquiryDialog);
refreshInquiriesButton.addEventListener("click", loadInquiries);
addInquiryRecipientButton.addEventListener("click", () => addRecipientRow());
inquiryForm.addEventListener("submit", saveInquiry);
responseForm.addEventListener("submit", saveInquiryResponse);
responseForm.elements.response_type.addEventListener(
  "change",
  toggleOfferResponseFields,
);
lvSelect.addEventListener("change", () => {
  state.inquirySelectedIds.clear();
});

setMode(state.mode);
