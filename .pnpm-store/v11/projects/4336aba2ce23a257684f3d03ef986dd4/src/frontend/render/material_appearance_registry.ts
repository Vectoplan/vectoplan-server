import * as THREE from "three";

export interface MaterialAppearance {
  readonly textureUrl: string | null;
  readonly textureKey: string | null;
  readonly color: string | null;
  readonly materialType: string | null;
  readonly roughness: number;
  readonly metalness: number;
  readonly anisotropy: number;
  readonly generateMipmaps: boolean;
}

const APPEARANCE_BY_BLOCK_TYPE = new Map<string, MaterialAppearance>();
const APPEARANCE_LISTENERS = new Set<(blockTypeId: string, appearance: MaterialAppearance) => void>();
const TEXTURE_PROMISE_BY_KEY = new Map<string, Promise<THREE.Texture>>();
const NORMALIZED_APPEARANCE_BY_SOURCE = new WeakMap<object, MaterialAppearance>();
const TEXTURE_LOADER = new THREE.TextureLoader();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string | null {
  try {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
  } catch {
    return null;
  }
}

function numberValue(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function absoluteHttpUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function fallbackFamilyTextureUrl(sources: readonly Record<string, unknown>[]): string | null {
  const identity = sources
    .flatMap((source) => [
      source.familyId,
      source.family_id,
      source.runtimeBlockTypeId,
      source.runtime_block_type_id,
      source.blockTypeId,
      source.block_type_id,
    ])
    .map((value) => text(value)?.toLowerCase() ?? "")
    .find(Boolean) ?? "";

  const filename = identity.includes("brettsperrholz") || identity.includes("_holz")
    ? "timber.webp"
    : identity.includes("stahlbeton") || identity.includes("kalksandstein") || identity.includes("porenbeton")
      ? "concrete.webp"
      : identity.includes("stahlverbund") || identity.includes("wand_stahl")
        ? "steel.webp"
        : identity.includes("mauerwerk")
          ? "masonry.webp"
          : null;
  if (!filename) return null;

  try {
    const editorRoot = document.querySelector<HTMLElement>(
      "[data-editor-root], [data-vectoplan-editor-root], #vectoplan-editor-root",
    );
    const windowRecord = window as unknown as Record<string, unknown>;
    const libraryConfig = asRecord(windowRecord.__VECTOPLAN_EDITOR_LIBRARY_CONFIG__);
    const configuredInventoryUrl = editorRoot?.dataset.creativeInventoryUrl
      ?? editorRoot?.dataset.userInventoryUrl
      ?? text(libraryConfig.creativeInventoryUrl)
      ?? text(libraryConfig.userInventoryUrl)
      ?? null;
    if (configuredInventoryUrl) {
      return new URL(`/static/textures/materials/${filename}`, configuredInventoryUrl).href;
    }

    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[src*="/creative-inventar"], iframe[src*="/user-inventar"]',
    );
    if (!frame?.src) return null;
    return new URL(`/static/textures/materials/${filename}`, frame.src).href;
  } catch {
    return null;
  }
}

export function fallbackMaterialAppearance(blockTypeId: unknown): MaterialAppearance | null {
  const textureUrl = fallbackFamilyTextureUrl([{ blockTypeId }]);
  if (!textureUrl) return null;
  const identity = text(blockTypeId)?.toLowerCase() ?? "";
  const steel = identity.includes("stahl") && !identity.includes("stahlbeton");
  return {
    textureUrl,
    textureKey: `vplib-family:${identity}`,
    color: null,
    materialType: steel ? "steel" : identity.includes("holz") ? "wood" : "concrete",
    roughness: steel ? 0.52 : identity.includes("holz") ? 0.76 : 0.88,
    metalness: steel ? 0.66 : 0.02,
    anisotropy: 4,
    generateMipmaps: true,
  };
}

function normalizeMaterialAppearanceUncached(input: unknown): MaterialAppearance | null {
  const record = asRecord(input);
  const raw = asRecord(record.raw);
  const rawItem = asRecord(record.rawItem);
  const rawSlot = asRecord(record.rawSlot);
  const nestedRawItem = asRecord(raw.rawItem);
  const nestedItem = asRecord(record.item);
  const sources = [record, raw, rawItem, rawSlot, nestedRawItem, nestedItem];
  const assetSources = sources.flatMap((source) => {
    const assetsValue = source.assets;
    const assets = asRecord(assetsValue);
    const itemValues = Array.isArray(assetsValue)
      ? assetsValue
      : Array.isArray(assets.items)
        ? assets.items
        : [];
    const itemSources = itemValues.flatMap((value) => {
      const item = asRecord(value);
      const payload = asRecord(item.payload);
      const nestedPayload = asRecord(payload.payload);
      return [item, payload, nestedPayload, asRecord(nestedPayload.payload)];
    });
    return [assets, asRecord(assets.raw), ...itemSources];
  });
  const candidates = sources.flatMap((source) => [
    asRecord(source.appearance),
    asRecord(asRecord(source.metadata).appearance),
    asRecord(asRecord(source.placement).appearance),
    asRecord(asRecord(source.assets).appearance),
    asRecord(asRecord(asRecord(source.assets).raw).appearance),
  ]);
  const appearance = candidates.find((candidate) => Object.keys(candidate).length > 0) ?? {};

  const firstAssetValue = (...keys: string[]): unknown => {
    for (const assetSource of assetSources) {
      for (const key of keys) {
        if (assetSource[key] !== undefined && assetSource[key] !== null) {
          return assetSource[key];
        }
      }
    }
    return undefined;
  };

  const firstSourceValue = (...keys: string[]): unknown => {
    for (const source of sources) {
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) {
          return source[key];
        }
      }
    }
    return undefined;
  };

  const textureUrl = absoluteHttpUrl(
    appearance.textureUrl
      ?? appearance.texture_url
      ?? firstAssetValue("textureUrl", "texture_url", "previewUrl", "preview_url", "uri", "url")
      ?? firstSourceValue("iconUrl", "icon_url"),
  ) ?? fallbackFamilyTextureUrl(sources);

  if (!textureUrl && Object.keys(appearance).length === 0) return null;

  const definitionCandidates = sources.flatMap((source) => {
    const metadata = asRecord(source.metadata);
    const payloadMetadata = asRecord(asRecord(source.payload).metadata);
    return [
      asRecord(metadata.definition_values),
      asRecord(metadata.definitionValues),
      asRecord(payloadMetadata.definition_values),
      asRecord(payloadMetadata.definitionValues),
    ];
  });
  const definitionValues = definitionCandidates.find(
    (candidate) => Object.keys(candidate).length > 0,
  ) ?? {};
  const runtime = assetSources
    .map((source) => asRecord(source.runtime))
    .find((candidate) => Object.keys(candidate).length > 0) ?? {};
  const materialType = text(
    appearance.materialType
      ?? appearance.material_type
      ?? definitionValues["material.type"]
      ?? definitionValues["material.subtype"],
  );
  const inferredMetalness = materialType?.includes("steel") ? 0.66 : 0.02;
  const inferredRoughness = materialType?.includes("steel")
    ? 0.52
    : materialType?.includes("wood") || materialType?.includes("timber")
      ? 0.76
      : 0.88;

  return {
    textureUrl,
    textureKey: text(
      appearance.textureKey
        ?? appearance.texture_key
        ?? firstAssetValue("textureKey", "texture_key", "sha256", "checksum")
        ?? textureUrl,
    ),
    color: text(appearance.color ?? definitionValues["material.color_hint"]),
    materialType,
    roughness: numberValue(appearance.roughness, inferredRoughness, 0, 1),
    metalness: numberValue(appearance.metalness, inferredMetalness, 0, 1),
    anisotropy: numberValue(appearance.anisotropy ?? runtime.anisotropy, 4, 1, 16),
    generateMipmaps: booleanValue(
      appearance.generateMipmaps ?? appearance.generate_mipmaps ?? runtime.generate_mipmaps,
      true,
    ),
  };
}

export function normalizeMaterialAppearance(input: unknown): MaterialAppearance | null {
  const source = input && typeof input === "object" ? input as object : null;
  if (source) {
    const cached = NORMALIZED_APPEARANCE_BY_SOURCE.get(source);
    if (cached) return cached;
  }
  const appearance = normalizeMaterialAppearanceUncached(input);
  if (source && appearance) NORMALIZED_APPEARANCE_BY_SOURCE.set(source, appearance);
  return appearance;
}

function appearancesEqual(left: MaterialAppearance, right: MaterialAppearance): boolean {
  return left.textureUrl === right.textureUrl
    && left.textureKey === right.textureKey
    && left.color === right.color
    && left.materialType === right.materialType
    && left.roughness === right.roughness
    && left.metalness === right.metalness
    && left.anisotropy === right.anisotropy
    && left.generateMipmaps === right.generateMipmaps;
}

export function registerMaterialAppearance(
  blockTypeId: unknown,
  source: unknown,
): MaterialAppearance | null {
  const id = text(blockTypeId);
  const appearance = normalizeMaterialAppearance(source) ?? fallbackMaterialAppearance(id);
  if (!id || !appearance) return appearance;
  const current = APPEARANCE_BY_BLOCK_TYPE.get(id);
  if (current && appearancesEqual(current, appearance)) return current;
  APPEARANCE_BY_BLOCK_TYPE.set(id, appearance);
  for (const listener of APPEARANCE_LISTENERS) {
    try {
      listener(id, appearance);
    } catch {
      // One consumer must not prevent other render paths from updating.
    }
  }
  return appearance;
}

export function subscribeMaterialAppearance(
  listener: (blockTypeId: string, appearance: MaterialAppearance) => void,
): () => void {
  APPEARANCE_LISTENERS.add(listener);
  return () => APPEARANCE_LISTENERS.delete(listener);
}

export function getMaterialAppearance(blockTypeId: unknown): MaterialAppearance | null {
  const id = text(blockTypeId);
  return id ? APPEARANCE_BY_BLOCK_TYPE.get(id) ?? null : null;
}

export function loadMaterialTexture(
  textureUrl: unknown,
  textureKey?: unknown,
  options?: {
    readonly anisotropy?: number;
    readonly generateMipmaps?: boolean;
  },
): Promise<THREE.Texture> | null {
  const url = absoluteHttpUrl(textureUrl);
  if (!url) return null;
  const key = text(textureKey) ?? url;
  const cached = TEXTURE_PROMISE_BY_KEY.get(key);
  if (cached) return cached;

  const pending = TEXTURE_LOADER.loadAsync(url).then((texture) => {
    texture.name = `vplib-texture:${key}`;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = options?.generateMipmaps ?? true;
    texture.anisotropy = numberValue(options?.anisotropy, 2, 1, 2);
    texture.needsUpdate = true;
    return texture;
  }).catch((error) => {
    TEXTURE_PROMISE_BY_KEY.delete(key);
    throw error;
  });

  TEXTURE_PROMISE_BY_KEY.set(key, pending);
  return pending;
}

export function applyMaterialAppearance(
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  appearance: MaterialAppearance | null | undefined,
): void {
  if (!appearance) return;
  const applicationKey = [
    appearance.textureKey ?? appearance.textureUrl ?? "no-texture",
    appearance.color ?? "no-color",
    appearance.roughness.toFixed(4),
    appearance.metalness.toFixed(4),
  ].join("|");
  if (material.userData.vectoplanAppearanceKey === applicationKey) return;
  material.userData.vectoplanAppearanceKey = applicationKey;
  if (appearance.color) {
    try {
      material.color.setStyle(appearance.color);
    } catch {
      // Keep the material fallback color.
    }
  }
  material.roughness = appearance.roughness;
  material.metalness = appearance.metalness;

  const pending = loadMaterialTexture(
    appearance.textureUrl,
    appearance.textureKey,
    {
      anisotropy: appearance.anisotropy,
      generateMipmaps: appearance.generateMipmaps,
    },
  );
  if (!pending) return;

  void pending.then((texture) => {
    if (material.userData.vectoplanDisposed === true) return;
    if (material.userData.vectoplanAppearanceKey !== applicationKey) return;
    if (material.map === texture) return;
    material.map = texture;
    material.needsUpdate = true;
  }).catch(() => {
    // The solid-color material remains a reliable fallback.
  });
}

export function materialAppearanceCacheSnapshot(): Record<string, number> {
  return {
    appearanceCount: APPEARANCE_BY_BLOCK_TYPE.size,
    textureCount: TEXTURE_PROMISE_BY_KEY.size,
    listenerCount: APPEARANCE_LISTENERS.size,
  };
}
