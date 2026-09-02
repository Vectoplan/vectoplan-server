export const VISUAL_LAYER_RESOLUTION_SCHEMA = "geodata-visual-layer-resolution.v1" as const;
export const VISUAL_LAYER_ORDER = ["photorealistic", "lod3", "lod2"] as const;

export type VisualLayerKind = typeof VISUAL_LAYER_ORDER[number];

export interface VisualLayerCandidateSnapshot {
  readonly kind: VisualLayerKind;
  readonly datasetId: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly status: string;
  readonly itemIds: readonly string[];
  readonly provenance: Readonly<Record<string, unknown>>;
  readonly supported: boolean;
}

export interface VisualLayerResolutionSnapshot {
  readonly schemaVersion: typeof VISUAL_LAYER_RESOLUTION_SCHEMA;
  readonly source: "server" | "derived";
  readonly policy: string;
  readonly order: readonly VisualLayerKind[];
  readonly requestedKind: VisualLayerKind | null;
  readonly selectedKind: VisualLayerKind | null;
  readonly selectedItemIds: readonly string[];
  readonly fallbackUsed: boolean;
  readonly layers: readonly VisualLayerCandidateSnapshot[];
}

const PRIORITY: Readonly<Record<VisualLayerKind, number>> = {
  photorealistic: 300,
  lod3: 200,
  lod2: 100,
};

const DATASET: Readonly<Record<VisualLayerKind, string>> = {
  photorealistic: "3d-reality-mesh",
  lod3: "3d-gebaeudedaten",
  lod2: "3d-gebaeudedaten",
};

function record(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function kind(value: unknown): VisualLayerKind | null {
  const normalized = text(value).toLowerCase();
  return VISUAL_LAYER_ORDER.includes(normalized as VisualLayerKind)
    ? normalized as VisualLayerKind
    : null;
}

/** Classify metadata only. This function never follows an asset reference. */
export function visualLayerKind(value: unknown): VisualLayerKind | null {
  const item = record(value);
  if (!item) return null;
  const explicit = kind(item.visualLayerKind);
  if (explicit) return explicit;
  const renderMode = text(item.renderMode).toLowerCase();
  const datasetId = text(item.datasetId).toLowerCase();
  if (datasetId === "3d-reality-mesh" || [
    "photorealistic-mesh", "textured-mesh", "textured-mesh-tile", "3d-tiles",
  ].includes(renderMode)) return "photorealistic";
  const source = record(item.source);
  const lod = Number(source?.lod);
  if (lod === 3) return "lod3";
  if (lod === 2 || (datasetId === "3d-gebaeudedaten" && renderMode === "building-meshes")) return "lod2";
  return null;
}

function itemId(item: Record<string, any>, index: number): string {
  return text(item.id) || `${text(item.datasetId) || "overlay"}:${index}`;
}

function classifiedItems(contract: Record<string, any>): Readonly<Record<VisualLayerKind, readonly string[]>> {
  const grouped: Record<VisualLayerKind, string[]> = { photorealistic: [], lod3: [], lod2: [] };
  const items = Array.isArray(contract.items) ? contract.items : [];
  items.forEach((raw: unknown, index: number) => {
    const item = record(raw);
    const itemKind = visualLayerKind(item);
    if (item && itemKind) grouped[itemKind].push(itemId(item, index));
  });
  return grouped;
}

function derivedLayers(
  itemIds: Readonly<Record<VisualLayerKind, readonly string[]>>,
  supported: ReadonlySet<VisualLayerKind>,
): VisualLayerCandidateSnapshot[] {
  return VISUAL_LAYER_ORDER.map((layerKind) => ({
    kind: layerKind,
    datasetId: DATASET[layerKind],
    priority: PRIORITY[layerKind],
    enabled: layerKind !== "photorealistic",
    status: layerKind === "photorealistic"
      ? "license_required"
      : itemIds[layerKind].length > 0 ? "ready" : "unavailable",
    itemIds: itemIds[layerKind],
    provenance: layerKind === "photorealistic"
      ? { licenseState: "license_required", retrieval: "blocked_until_explicit_license_approval" }
      : {},
    supported: supported.has(layerKind),
  }));
}

/**
 * Resolve the highest ready layer that this editor build can actually render.
 * Server metadata remains authoritative for license/enabled state. Missing or
 * legacy metadata fails closed for photorealistic assets and keeps LoD2 usable.
 */
export function resolveVisualLayer(
  value: unknown,
  supportedKinds: readonly VisualLayerKind[] = VISUAL_LAYER_ORDER,
): VisualLayerResolutionSnapshot {
  const contract = record(value) ?? {};
  const supported = new Set<VisualLayerKind>(supportedKinds);
  const ids = classifiedItems(contract);
  const rawResolution = record(contract.visualLayerResolution);
  const serverContract = rawResolution?.schemaVersion === VISUAL_LAYER_RESOLUTION_SCHEMA;
  let layers = derivedLayers(ids, supported);

  if (serverContract) {
    const rawLayers = Array.isArray(rawResolution.layers) ? rawResolution.layers : [];
    layers = VISUAL_LAYER_ORDER.map((layerKind) => {
      const raw = rawLayers.map(record).find((candidate) => kind(candidate?.kind) === layerKind);
      if (!raw) return derivedLayers(ids, supported).find((candidate) => candidate.kind === layerKind)!;
      const advertisedIds = Array.isArray(raw.itemIds)
        ? raw.itemIds.map(text).filter(Boolean)
        : [];
      // The selection can only refer to items carried by this same chunk
      // contract; a status object alone must never make a renderer fetch data.
      const availableIds = advertisedIds.filter((id) => ids[layerKind].includes(id));
      return {
        kind: layerKind,
        datasetId: text(raw.datasetId) || DATASET[layerKind],
        priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : PRIORITY[layerKind],
        enabled: raw.enabled === true,
        status: text(raw.status) || "unavailable",
        itemIds: availableIds,
        provenance: record(raw.provenance) ?? {},
        supported: supported.has(layerKind),
      };
    });
  }

  layers.sort((left, right) => right.priority - left.priority);
  const selected = layers.find((layer) => (
    layer.enabled && layer.status === "ready" && layer.supported && layer.itemIds.length > 0
  )) ?? null;
  const advertisedSelected = kind(record(rawResolution?.selected)?.kind);
  return {
    schemaVersion: VISUAL_LAYER_RESOLUTION_SCHEMA,
    source: serverContract ? "server" : "derived",
    policy: text(rawResolution?.policy) || "photorealistic-lod3-lod2.v1",
    order: VISUAL_LAYER_ORDER,
    requestedKind: advertisedSelected,
    selectedKind: selected?.kind ?? null,
    selectedItemIds: selected?.itemIds ?? [],
    fallbackUsed: selected !== null && selected.kind !== "photorealistic",
    layers,
  };
}
