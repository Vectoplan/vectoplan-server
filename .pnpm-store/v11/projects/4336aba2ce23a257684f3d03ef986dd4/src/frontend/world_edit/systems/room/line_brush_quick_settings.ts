import "./line_brush_quick_settings.css";

import {
  BUILDING_PROGRAM_TYPES,
  DEFAULT_BUILDING_PROGRAM_TEMPLATE_ID,
  buildBuildingProgramMarketplacePageUrl,
  createBuildingProgramTemplateCatalog,
  loadBuildingProgramTemplateCatalog,
  type BuildingProgramTemplateCatalog,
  type BuildingProgramTypeId,
  type LineBrushBuildingProgramTemplate,
} from "./line_brush_building_programs";
import {
  DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
  MAXIMUM_LINE_BRUSH_STOREY_COUNT,
  MINIMUM_LINE_BRUSH_STOREY_COUNT,
  buildingProgramTemplatesForType,
  createLineBrushBuildingGenerationRequest,
  createLineBrushQuickSettingsSnapshot,
  normalizeLineBrushQuickSettingsState,
  reduceLineBrushQuickSettingsState,
  type LineBrushBuildingGenerationRequest,
  type LineBrushQuickSettingsSnapshot,
  type LineBrushQuickSettingsState,
} from "./line_brush_quick_settings_state";

export type LineBrushBuildingProgramCatalogLoader = (
  typeId: BuildingProgramTypeId,
  signal: AbortSignal,
) => Promise<BuildingProgramTemplateCatalog>;

export interface LineBrushQuickSettingsOptions {
  readonly root: HTMLElement;
  readonly initialState?: Partial<LineBrushQuickSettingsState> | null;
  readonly initialCatalog?: BuildingProgramTemplateCatalog | null;
  readonly loadCatalog?: LineBrushBuildingProgramCatalogLoader;
  readonly onChange?: (snapshot: LineBrushQuickSettingsSnapshot) => void;
  readonly onTemplateSelect?: (snapshot: LineBrushQuickSettingsSnapshot) => void;
  readonly onGenerate: (request: LineBrushBuildingGenerationRequest) => void | Promise<void>;
  readonly onMarketplaceOpen?: (
    url: string,
    template: LineBrushBuildingProgramTemplate | null,
  ) => void;
  readonly onError?: (error: unknown, stage: "catalog" | "generate") => void;
  readonly onClose?: (restoreInput: boolean) => void;
}

export interface LineBrushQuickSettingsHandle {
  readonly element: HTMLElement;
  readonly libraryElement: HTMLElement;
  readonly isOpen: () => boolean;
  readonly isLibraryOpen: () => boolean;
  readonly open: (state?: Partial<LineBrushQuickSettingsState> | null) => void;
  readonly close: (restoreInput?: boolean) => void;
  readonly sync: (state: Partial<LineBrushQuickSettingsState>) => void;
  readonly getState: () => LineBrushQuickSettingsState;
  readonly getSnapshot: () => LineBrushQuickSettingsSnapshot;
  readonly getCatalog: () => BuildingProgramTemplateCatalog;
  readonly setCatalog: (catalog: BuildingProgramTemplateCatalog) => void;
  readonly openLibrary: () => Promise<void>;
  readonly closeLibrary: () => void;
  readonly reloadCatalog: () => Promise<BuildingProgramTemplateCatalog>;
  readonly destroy: () => void;
}

async function defaultCatalogLoader(
  typeId: BuildingProgramTypeId,
  signal: AbortSignal,
): Promise<BuildingProgramTemplateCatalog> {
  const loaded = await loadBuildingProgramTemplateCatalog({ typeId, signal });
  return loaded.catalog;
}

function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function stopWorkspaceInput(event: Event): void {
  event.stopPropagation();
}

export function createLineBrushQuickSettings(
  options: LineBrushQuickSettingsOptions,
): LineBrushQuickSettingsHandle {
  let catalog = options.initialCatalog ?? createBuildingProgramTemplateCatalog();
  let state = normalizeLineBrushQuickSettingsState(
    options.initialState ?? DEFAULT_LINE_BRUSH_QUICK_SETTINGS_STATE,
    catalog,
  );
  let catalogAbortController: AbortController | null = null;
  let catalogSequence = 0;
  let catalogLoading = false;
  let catalogError: string | null = null;
  let destroyed = false;

  const element = document.createElement("section");
  element.className = "editor-line-brush-quick-settings";
  element.dataset.editorLineBrushQuickSettings = "true";
  element.dataset.editorUiInteractive = "true";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "false");
  element.setAttribute("aria-label", "Gebäude mit dem Linien-Brush einstellen");
  element.hidden = true;
  element.innerHTML = `
    <header class="editor-line-brush-quick-settings__header">
      <div><span>Linien-Brush</span><strong>Gebäude einstellen</strong></div>
      <button type="button" data-line-brush-close aria-label="Gebäudeeinstellungen schließen">×</button>
    </header>
    <div class="editor-line-brush-quick-settings__body">
      <label class="editor-line-brush-quick-settings__field">
        <span>Gebäudetyp</span>
        <select data-line-brush-type aria-label="Gebäudetyp">
          ${BUILDING_PROGRAM_TYPES.map((type) => `<option value="${type.id}">${type.label}</option>`).join("")}
        </select>
        <small data-line-brush-type-description></small>
      </label>
      <div class="editor-line-brush-quick-settings__storeys">
        <div><span>Geschosse</span><strong data-line-brush-storey-title>1 Geschoss</strong></div>
        <div class="editor-line-brush-quick-settings__stepper">
          <button type="button" data-line-brush-storey-decrease aria-label="Ein Geschoss weniger">−</button>
          <input type="number" min="${MINIMUM_LINE_BRUSH_STOREY_COUNT}" max="${MAXIMUM_LINE_BRUSH_STOREY_COUNT}" step="1" value="1" data-line-brush-storey-count aria-label="Anzahl der Geschosse">
          <button type="button" data-line-brush-storey-increase aria-label="Ein Geschoss mehr">+</button>
        </div>
        <small><b data-line-brush-storey-height>2,645 m</b> je Geschoss · Gesamt <b data-line-brush-total-height>2,645 m</b></small>
      </div>
      <div class="editor-line-brush-quick-settings__template">
        <span>Gebäudemuster</span>
        <strong data-line-brush-template-title>Standard</strong>
        <small data-line-brush-template-source>VECTOPLAN Standard</small>
      </div>
      <button type="button" class="editor-line-brush-quick-settings__library" data-line-brush-library-open>
        <span aria-hidden="true">▦</span><b>Muster aus Bibliothek</b><small>Installierte und Marketplace-Vorlagen</small>
      </button>
      <button type="button" class="editor-line-brush-quick-settings__generate" data-line-brush-generate>Gebäude erzeugen</button>
    </div>
  `;

  const libraryElement = document.createElement("section");
  libraryElement.className = "editor-line-brush-library-dialog";
  libraryElement.dataset.editorLineBrushLibraryDialog = "true";
  libraryElement.dataset.editorUiInteractive = "true";
  libraryElement.setAttribute("role", "dialog");
  libraryElement.setAttribute("aria-modal", "false");
  libraryElement.setAttribute("aria-label", "Gebäudemuster auswählen");
  libraryElement.hidden = true;
  libraryElement.innerHTML = `
    <header class="editor-line-brush-library-dialog__header">
      <div><span>Bibliothek & Marketplace</span><strong>Gebäudemuster auswählen</strong><small data-line-brush-library-filter></small></div>
      <button type="button" data-line-brush-library-close aria-label="Musterauswahl schließen">×</button>
    </header>
    <div class="editor-line-brush-library-dialog__body">
      <p class="editor-line-brush-library-dialog__status" data-line-brush-library-status role="status"></p>
      <section>
        <div class="editor-line-brush-library-dialog__section-title"><strong>Im Editor verfügbar</strong><span data-line-brush-installed-count></span></div>
        <div class="editor-line-brush-library-dialog__grid" data-line-brush-installed-list></div>
      </section>
      <section>
        <div class="editor-line-brush-library-dialog__section-title"><strong>Marketplace</strong><span data-line-brush-market-count></span></div>
        <div class="editor-line-brush-library-dialog__grid" data-line-brush-market-list></div>
      </section>
    </div>
    <footer class="editor-line-brush-library-dialog__footer">
      <button type="button" data-line-brush-marketplace-filtered>Gefilterten Marketplace öffnen ↗</button>
      <button type="button" class="is-primary" data-line-brush-library-done>Fertig</button>
    </footer>
  `;

  options.root.append(element, libraryElement);

  const typeSelect = element.querySelector<HTMLSelectElement>("[data-line-brush-type]")!;
  const typeDescription = element.querySelector<HTMLElement>("[data-line-brush-type-description]")!;
  const storeyInput = element.querySelector<HTMLInputElement>("[data-line-brush-storey-count]")!;
  const storeyTitle = element.querySelector<HTMLElement>("[data-line-brush-storey-title]")!;
  const storeyHeight = element.querySelector<HTMLElement>("[data-line-brush-storey-height]")!;
  const totalHeight = element.querySelector<HTMLElement>("[data-line-brush-total-height]")!;
  const templateTitle = element.querySelector<HTMLElement>("[data-line-brush-template-title]")!;
  const templateSource = element.querySelector<HTMLElement>("[data-line-brush-template-source]")!;
  const generateButton = element.querySelector<HTMLButtonElement>("[data-line-brush-generate]")!;
  const libraryStatus = libraryElement.querySelector<HTMLElement>("[data-line-brush-library-status]")!;
  const libraryFilter = libraryElement.querySelector<HTMLElement>("[data-line-brush-library-filter]")!;
  const installedList = libraryElement.querySelector<HTMLElement>("[data-line-brush-installed-list]")!;
  const marketplaceList = libraryElement.querySelector<HTMLElement>("[data-line-brush-market-list]")!;
  const installedCount = libraryElement.querySelector<HTMLElement>("[data-line-brush-installed-count]")!;
  const marketplaceCount = libraryElement.querySelector<HTMLElement>("[data-line-brush-market-count]")!;

  const snapshot = (): LineBrushQuickSettingsSnapshot =>
    createLineBrushQuickSettingsSnapshot(state, catalog);

  const publishChange = (): void => {
    options.onChange?.(snapshot());
  };

  const templateSourceLabel = (template: LineBrushBuildingProgramTemplate): string => {
    if (template.source === "library") return "Installierte VPLIB-Vorlage";
    if (template.source === "marketplace") return "Marketplace · Installation erforderlich";
    return "VECTOPLAN Standard";
  };

  const renderMain = (): void => {
    const current = snapshot();
    typeSelect.value = current.typeId;
    typeDescription.textContent = current.type.description;
    storeyInput.value = String(current.storeyCount);
    storeyTitle.textContent = `${current.storeyCount} ${current.storeyCount === 1 ? "Geschoss" : "Geschosse"}`;
    storeyHeight.textContent = current.storeyHeightLabel;
    totalHeight.textContent = current.totalHeightLabel;
    templateTitle.textContent = current.selection.selectedTemplate.title;
    templateSource.textContent = templateSourceLabel(current.selection.selectedTemplate);
    generateButton.disabled = !current.canGenerate;
    generateButton.textContent = current.canGenerate
      ? "Gebäude erzeugen"
      : "Vorlage zuerst installieren";
  };

  const emptyCard = (message: string): HTMLElement =>
    createTextElement("p", "editor-line-brush-library-dialog__empty", message);

  const openMarketplace = (
    template: LineBrushBuildingProgramTemplate | null,
  ): void => {
    const url = template?.marketplace?.productUrl
      ?? buildBuildingProgramMarketplacePageUrl(state.typeId);
    if (options.onMarketplaceOpen) {
      options.onMarketplaceOpen(url, template);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const availableTemplateCard = (
    template: LineBrushBuildingProgramTemplate,
    selectedTemplateId: string,
  ): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "editor-line-brush-library-dialog__card";
    button.classList.toggle("is-selected", template.id === selectedTemplateId);
    button.setAttribute("aria-pressed", String(template.id === selectedTemplateId));
    if (template.thumbnailUrl) {
      const image = document.createElement("img");
      image.src = template.thumbnailUrl;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
    } else {
      button.append(createTextElement("span", "editor-line-brush-library-dialog__placeholder", "⌂"));
    }
    const copy = document.createElement("span");
    copy.className = "editor-line-brush-library-dialog__card-copy";
    copy.append(
      createTextElement("strong", "", template.title),
      createTextElement("small", "", templateSourceLabel(template)),
    );
    button.append(copy);
    button.addEventListener("click", () => {
      state = reduceLineBrushQuickSettingsState(
        state,
        { type: "select-template", templateId: template.id },
        catalog,
      );
      renderMain();
      renderLibrary();
      const current = snapshot();
      options.onTemplateSelect?.(current);
      options.onChange?.(current);
      closeLibrary();
    });
    return button;
  };

  const marketplaceTemplateCard = (
    template: LineBrushBuildingProgramTemplate,
  ): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "editor-line-brush-library-dialog__card editor-line-brush-library-dialog__card--market";
    if (template.thumbnailUrl) {
      const image = document.createElement("img");
      image.src = template.thumbnailUrl;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
    } else {
      button.append(createTextElement("span", "editor-line-brush-library-dialog__placeholder", "▦"));
    }
    const copy = document.createElement("span");
    copy.className = "editor-line-brush-library-dialog__card-copy";
    copy.append(
      createTextElement("strong", "", template.title),
      createTextElement("small", "", "Marketplace öffnen · Installation erforderlich ↗"),
    );
    button.append(copy);
    button.addEventListener("click", () => openMarketplace(template));
    return button;
  };

  const renderLibrary = (): void => {
    const current = snapshot();
    const templates = buildingProgramTemplatesForType(catalog, current.typeId);
    const available = templates.filter((template) => template.executable);
    const marketplace = templates.filter((template) => template.source === "marketplace");
    libraryFilter.textContent = `Filter: ${current.type.label}`;
    installedCount.textContent = String(available.length);
    marketplaceCount.textContent = String(marketplace.length);
    installedList.replaceChildren(
      ...(available.length
        ? available.map((template) => availableTemplateCard(template, current.templateId))
        : [emptyCard("Für diesen Gebäudetyp ist noch kein Muster installiert.")]),
    );
    marketplaceList.replaceChildren(
      ...(marketplace.length
        ? marketplace.map(marketplaceTemplateCard)
        : [emptyCard(catalogLoading
          ? "Marketplace wird geladen …"
          : "Keine passenden Marketplace-Muster gefunden.")]),
    );
    libraryStatus.hidden = !catalogLoading && !catalogError;
    libraryStatus.textContent = catalogLoading
      ? "Bibliothek und Marketplace werden aktualisiert …"
      : catalogError ?? "";
    if (catalogError) libraryStatus.dataset.kind = "warning";
    else delete libraryStatus.dataset.kind;
    libraryElement.setAttribute("aria-busy", String(catalogLoading));
  };

  const closeLibrary = (): void => {
    if (libraryElement.hidden) return;
    libraryElement.hidden = true;
    delete options.root.dataset.editorLineBrushLibraryOpen;
  };

  const setCatalog = (nextCatalog: BuildingProgramTemplateCatalog): void => {
    const previousTemplateId = state.templateId;
    catalog = nextCatalog;
    state = normalizeLineBrushQuickSettingsState(state, catalog);
    renderMain();
    renderLibrary();
    if (state.templateId !== previousTemplateId) publishChange();
  };

  const reloadCatalog = async (): Promise<BuildingProgramTemplateCatalog> => {
    catalogAbortController?.abort();
    const abortController = new AbortController();
    catalogAbortController = abortController;
    const sequence = ++catalogSequence;
    catalogLoading = true;
    catalogError = null;
    renderLibrary();
    try {
      const nextCatalog = await (options.loadCatalog ?? defaultCatalogLoader)(
        state.typeId,
        abortController.signal,
      );
      if (destroyed || abortController.signal.aborted || sequence !== catalogSequence) return catalog;
      setCatalog(nextCatalog);
      return catalog;
    } catch (error) {
      if (destroyed || abortController.signal.aborted || sequence !== catalogSequence) return catalog;
      catalogError = "Bibliothek oder Marketplace konnte nicht vollständig geladen werden. Standard bleibt verfügbar.";
      options.onError?.(error, "catalog");
      return catalog;
    } finally {
      if (!destroyed && sequence === catalogSequence) {
        catalogLoading = false;
        if (libraryStatus.dataset.kind !== "warning") libraryStatus.hidden = true;
        renderLibrary();
      }
      if (catalogAbortController === abortController) catalogAbortController = null;
    }
  };

  const openLibrary = async (): Promise<void> => {
    libraryElement.hidden = false;
    options.root.dataset.editorLineBrushLibraryOpen = "true";
    delete libraryStatus.dataset.kind;
    renderLibrary();
    await reloadCatalog();
  };

  const close = (restoreInput = true): void => {
    if (element.hidden) return;
    closeLibrary();
    element.hidden = true;
    delete options.root.dataset.editorLineBrushSettingsOpen;
    options.onClose?.(restoreInput);
  };

  const changeStoreyCount = (value: number): void => {
    state = reduceLineBrushQuickSettingsState(
      state,
      { type: "set-storey-count", storeyCount: value },
      catalog,
    );
    renderMain();
    publishChange();
  };

  typeSelect.addEventListener("change", () => {
    state = reduceLineBrushQuickSettingsState(
      state,
      { type: "set-building-type", typeId: typeSelect.value },
      catalog,
    );
    renderMain();
    renderLibrary();
    publishChange();
    if (!libraryElement.hidden) void reloadCatalog();
  });
  storeyInput.addEventListener("change", () => changeStoreyCount(Number(storeyInput.value)));
  element.querySelector("[data-line-brush-storey-decrease]")?.addEventListener("click", () => {
    changeStoreyCount(state.storeyCount - 1);
  });
  element.querySelector("[data-line-brush-storey-increase]")?.addEventListener("click", () => {
    changeStoreyCount(state.storeyCount + 1);
  });
  element.querySelector("[data-line-brush-close]")?.addEventListener("click", () => close());
  element.querySelector("[data-line-brush-library-open]")?.addEventListener("click", () => {
    void openLibrary();
  });
  generateButton.addEventListener("click", async () => {
    const request = createLineBrushBuildingGenerationRequest(state, catalog);
    generateButton.disabled = true;
    element.dataset.generating = "true";
    try {
      await options.onGenerate(request);
    } catch (error) {
      options.onError?.(error, "generate");
    } finally {
      delete element.dataset.generating;
      renderMain();
    }
  });
  libraryElement.querySelector("[data-line-brush-library-close]")?.addEventListener("click", closeLibrary);
  libraryElement.querySelector("[data-line-brush-library-done]")?.addEventListener("click", closeLibrary);
  libraryElement.querySelector("[data-line-brush-marketplace-filtered]")?.addEventListener("click", () => {
    openMarketplace(null);
  });

  [element, libraryElement].forEach((target) => {
    target.addEventListener("pointerdown", stopWorkspaceInput);
    target.addEventListener("mousedown", stopWorkspaceInput);
    target.addEventListener("wheel", stopWorkspaceInput);
    target.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!libraryElement.hidden) closeLibrary();
      else close();
    });
  });

  renderMain();
  renderLibrary();

  return {
    element,
    libraryElement,
    isOpen: () => !element.hidden,
    isLibraryOpen: () => !libraryElement.hidden,
    open(nextState): void {
      if (nextState) state = normalizeLineBrushQuickSettingsState({ ...state, ...nextState }, catalog);
      renderMain();
      element.hidden = false;
      options.root.dataset.editorLineBrushSettingsOpen = "true";
    },
    close,
    sync(nextState): void {
      state = normalizeLineBrushQuickSettingsState({ ...state, ...nextState }, catalog);
      renderMain();
      renderLibrary();
    },
    getState: () => ({ ...state }),
    getSnapshot: snapshot,
    getCatalog: () => catalog,
    setCatalog,
    openLibrary,
    closeLibrary,
    reloadCatalog,
    destroy(): void {
      destroyed = true;
      catalogSequence += 1;
      catalogAbortController?.abort();
      catalogAbortController = null;
      delete options.root.dataset.editorLineBrushSettingsOpen;
      delete options.root.dataset.editorLineBrushLibraryOpen;
      element.remove();
      libraryElement.remove();
    },
  };
}
