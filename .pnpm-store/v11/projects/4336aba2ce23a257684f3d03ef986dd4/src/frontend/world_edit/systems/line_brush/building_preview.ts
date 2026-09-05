import * as THREE from "three";
import { createConstructionCellMesh, constructionCellKey, constructionCellMaterialGroups } from "../../../scene/construction_cell_rendering";
import { createBlockMaterial } from "@render/block_material";
import { STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID } from "./building_programs";

import { createRoofCalculationMeshes } from "../../../scene/roof_calculation_rendering";
import type { RoofCalculationResult } from "../roof/contracts";
import type { StoreyTargetScope } from "../storey/quick_settings";
import type { LineBrushBuildingStoreyGeometry, LineBrushBuildingBlockCell } from "./building_geometry";

/**
 * Scene-only preview adapter for the line-brush building contract.
 * It consumes the exact storey geometry and Roof WorldEdit calculation that
 * persistence consumes; it never contains a second wall or roof algorithm.
 */

export const LINE_BRUSH_BUILDING_PREVIEW_GROUP_NAME =
  "vectoplan_world_edit_line_brush_building_preview" as const;

export interface LineBrushBuildingPreviewStorey {
  readonly scope: StoreyTargetScope;
  readonly storey: LineBrushBuildingStoreyGeometry;
}

export interface LineBrushBuildingPreviewRoof {
  readonly scope: StoreyTargetScope;
  readonly calculation: RoofCalculationResult;
  readonly wallCells?: readonly LineBrushBuildingBlockCell[];
}

export interface LineBrushBuildingPreviewInput {
  readonly storeys: readonly LineBrushBuildingPreviewStorey[];
  readonly selectedScope: StoreyTargetScope;
  readonly editable?: boolean;
  readonly wallBlockTypeId?: string;
}

function instanceMesh(
  cells: readonly LineBrushBuildingBlockCell[],
  material: THREE.Material,
  name: string,
): THREE.Mesh | null {
  const unique = [...new Map(cells.map((cell) => [constructionCellKey(cell), cell])).values()];
  if (unique.length === 0) return null;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  if (unique.some((cell) => cell.footprintPolygons)) {
    geometry.dispose();
    const mesh = createConstructionCellMesh(unique, material);
    if (mesh) { mesh.name = name; mesh.renderOrder = 84; mesh.userData.lineBrushBuildingPreview = true; }
    return mesh;
  }
  const mesh = new THREE.InstancedMesh(geometry, material, unique.length);
  const matrix = new THREE.Matrix4();
  unique.forEach((cell, index) => {
    matrix.makeTranslation(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = name;
  mesh.renderOrder = 84;
  mesh.frustumCulled = false;
  mesh.userData = { lineBrushBuildingPreview: true };
  return mesh;
}

function appendCells(group: THREE.Group, cells: readonly LineBrushBuildingBlockCell[],
  selected: boolean, name: string, editable: boolean, blockTypeId: string, slab = false): void {
  const batches = editable ? new Map([[blockTypeId, cells]]) : constructionCellMaterialGroups(cells, blockTypeId);
  for (const [materialId, batch] of batches) {
    const material = editable
      ? new THREE.MeshStandardMaterial({ color: selected ? (slab ? 0x2387c4 : 0x3ba7e8) : 0x94c9e8,
        transparent: false, opacity: 1, depthWrite: true, roughness: 0.86 })
      : createBlockMaterial({ blockTypeId: materialId });
    const mesh = instanceMesh(batch, material, batches.size === 1 ? name : `${name}:${materialId}`);
    if (mesh) { mesh.userData.lineBrushEditable = editable; group.add(mesh); }
    else material.dispose();
  }
}

export function createLineBrushBuildingStructurePreview(
  input: LineBrushBuildingPreviewInput,
): THREE.Group {
  const group = new THREE.Group();
  group.name = LINE_BRUSH_BUILDING_PREVIEW_GROUP_NAME;
  group.userData = {
    lineBrushBuildingPreview: true,
    selectedScope: input.selectedScope,
    lineBrushEditable: input.editable !== false,
  };

  const selectedStoreys = input.storeys.filter(({ scope }) => scope === input.selectedScope);
  const ordinaryStoreys = input.storeys.filter(({ scope }) => scope !== input.selectedScope);
  const append = (
    storeys: readonly LineBrushBuildingPreviewStorey[],
    selected: boolean,
  ): void => {
    const walls = storeys.flatMap(({ storey }) => storey.wallCells);
    const slabs = storeys.flatMap(({ storey }) => storey.slabCells);
    appendCells(group, walls, selected, `line-brush-preview:${selected ? "selected" : "all"}:walls`,
      input.editable !== false, input.wallBlockTypeId ?? "lod2_exterior_wall");
    appendCells(group, slabs, selected, `line-brush-preview:${selected ? "selected" : "all"}:slabs`,
      input.editable !== false, STANDARD_FLOOR_SLAB_RUNTIME_BLOCK_TYPE_ID, true);
  };
  append(ordinaryStoreys, false);
  append(selectedStoreys, true);
  return group;
}

function makeRoofMaterialEditable(material: THREE.Material, selected: boolean): void {
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  const colored = material as THREE.Material & { color?: THREE.Color };
  colored.color?.set(selected ? 0x3ba7e8 : 0xa9d8ef);
  material.needsUpdate = true;
}

/** Append only meshes produced by the canonical Roof WorldEdit renderer. */
export function appendLineBrushBuildingRoofPreview(
  group: THREE.Group,
  roofs: readonly LineBrushBuildingPreviewRoof[],
  selectedScope: StoreyTargetScope,
  appearance: Readonly<{ editable?: boolean; wallBlockTypeId?: string }> = {},
): void {
  for (const [index, roof] of roofs.entries()) {
    const rendered = createRoofCalculationMeshes(roof.calculation, {
      preview: appearance.editable !== false,
      objectInstanceId: `line-brush-live-preview-${index}`,
    });
    const selected = roof.scope === selectedScope;
    appendCells(group, roof.wallCells ?? [], selected, `line-brush-preview:roof-walls:${index}`,
      appearance.editable !== false, appearance.wallBlockTypeId ?? "lod2_exterior_wall");
    if (appearance.editable !== false) rendered.materials.forEach((material) => makeRoofMaterialEditable(material, selected));
    rendered.meshes.forEach((mesh) => {
      mesh.name = `line-brush-preview:${selected ? "selected" : "all"}:roof:${index}:${mesh.name}`;
      mesh.userData = {
        ...mesh.userData,
        lineBrushBuildingPreview: true,
        lineBrushRoofPreview: true,
        lineBrushScope: roof.scope,
        lineBrushEditable: appearance.editable !== false,
      };
      group.add(mesh);
    });
  }
}
