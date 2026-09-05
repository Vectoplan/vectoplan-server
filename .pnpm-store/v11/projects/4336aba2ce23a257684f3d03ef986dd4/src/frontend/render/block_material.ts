import * as THREE from "three";
import type { RuntimeChunkPaletteEntry } from "@runtime/world/chunk_content";
import { LOD2_EXISTING_WALL_COLOR } from "@scene/lod2_existing_appearance";
import { safeString } from "@utils/safe";
import { applyMaterialAppearance, fallbackMaterialAppearance, getMaterialAppearance } from "./material_appearance_registry";

type BlockPalette = Pick<RuntimeChunkPaletteEntry, "blockTypeId"> & Partial<Pick<RuntimeChunkPaletteEntry, "color">>;

function paletteColor(entry: BlockPalette | null): THREE.Color {
  const blockTypeId = safeString(entry?.blockTypeId, "runtime-block");
  if (blockTypeId === "lod2_exterior_wall") return new THREE.Color(LOD2_EXISTING_WALL_COLOR);
  if (blockTypeId.startsWith("system_terrain")) return new THREE.Color("#f8fafc");
  const color = safeString(entry?.color, "");
  if (color) return new THREE.Color(color);
  let hash = 0;
  for (let index = 0; index < blockTypeId.length; index++) hash = ((hash << 5) - hash + blockTypeId.charCodeAt(index)) | 0;
  return new THREE.Color().setHSL(Math.abs(hash % 360) / 360, 0.52, 0.48);
}

/** The same material for committed chunks and a draft awaiting scene reload. */
export function createBlockMaterial(entry: BlockPalette | null): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: paletteColor(entry), roughness: 0.88, metalness: 0.02 });
  if (entry?.blockTypeId !== "lod2_exterior_wall") {
    applyMaterialAppearance(material, getMaterialAppearance(entry?.blockTypeId) ?? fallbackMaterialAppearance(entry?.blockTypeId));
  }
  return material;
}
