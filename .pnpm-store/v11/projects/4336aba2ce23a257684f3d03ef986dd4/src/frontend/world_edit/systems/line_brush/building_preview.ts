import * as THREE from "three";

import { createRoofCalculationMeshes } from "../../../scene/roof_calculation_rendering";
import type { RoofCalculationResult } from "../roof/contracts";
import type { StoreyTargetScope } from "../storey/quick_settings";
import type { LineBrushBuildingStoreyGeometry } from "./building_geometry";

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
}

export interface LineBrushBuildingPreviewInput {
  readonly storeys: readonly LineBrushBuildingPreviewStorey[];
  readonly selectedScope: StoreyTargetScope;
}

function cellKey(cell: Readonly<{ x: number; y: number; z: number }>): string {
  return `${cell.x}:${cell.y}:${cell.z}`;
}

function instanceMesh(
  cells: readonly Readonly<{ x: number; y: number; z: number }>[],
  color: number,
  opacity: number,
  name: string,
): THREE.InstancedMesh | null {
  const unique = [...new Map(cells.map((cell) => [cellKey(cell), cell])).values()];
  if (unique.length === 0) return null;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.86,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
  });
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

export function createLineBrushBuildingStructurePreview(
  input: LineBrushBuildingPreviewInput,
): THREE.Group {
  const group = new THREE.Group();
  group.name = LINE_BRUSH_BUILDING_PREVIEW_GROUP_NAME;
  group.userData = {
    lineBrushBuildingPreview: true,
    selectedScope: input.selectedScope,
  };

  const selectedStoreys = input.storeys.filter(({ scope }) => scope === input.selectedScope);
  const ordinaryStoreys = input.storeys.filter(({ scope }) => scope !== input.selectedScope);
  const append = (
    storeys: readonly LineBrushBuildingPreviewStorey[],
    selected: boolean,
  ): void => {
    const walls = storeys.flatMap(({ storey }) => storey.wallCells);
    const slabs = storeys.flatMap(({ storey }) => storey.slabCells);
    const wallMesh = instanceMesh(
      walls,
      selected ? 0x3ba7e8 : 0xcfe9f8,
      selected ? 0.44 : 0.29,
      `line-brush-preview:${selected ? "selected" : "all"}:walls`,
    );
    const slabMesh = instanceMesh(
      slabs,
      selected ? 0x1876b8 : 0x8ebfdc,
      selected ? 0.34 : 0.2,
      `line-brush-preview:${selected ? "selected" : "all"}:slabs`,
    );
    if (wallMesh) group.add(wallMesh);
    if (slabMesh) group.add(slabMesh);
  };
  append(ordinaryStoreys, false);
  append(selectedStoreys, true);
  return group;
}

function makeRoofMaterialTransparent(material: THREE.Material, selected: boolean): void {
  material.transparent = true;
  material.opacity = selected ? 0.42 : 0.25;
  material.depthWrite = false;
  const colored = material as THREE.Material & { color?: THREE.Color };
  colored.color?.set(selected ? 0x3ba7e8 : 0xa9d8ef);
  material.needsUpdate = true;
}

/** Append only meshes produced by the canonical Roof WorldEdit renderer. */
export function appendLineBrushBuildingRoofPreview(
  group: THREE.Group,
  roofs: readonly LineBrushBuildingPreviewRoof[],
  selectedScope: StoreyTargetScope,
): void {
  for (const [index, roof] of roofs.entries()) {
    const rendered = createRoofCalculationMeshes(roof.calculation, {
      preview: true,
      objectInstanceId: `line-brush-live-preview-${index}`,
    });
    const selected = roof.scope === selectedScope;
    rendered.materials.forEach((material) => makeRoofMaterialTransparent(material, selected));
    rendered.meshes.forEach((mesh) => {
      mesh.name = `line-brush-preview:${selected ? "selected" : "all"}:roof:${index}:${mesh.name}`;
      mesh.userData = {
        ...mesh.userData,
        lineBrushBuildingPreview: true,
        lineBrushRoofPreview: true,
        lineBrushScope: roof.scope,
      };
      group.add(mesh);
    });
  }
}
