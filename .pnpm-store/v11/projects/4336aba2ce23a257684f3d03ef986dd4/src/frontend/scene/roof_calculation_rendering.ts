import * as THREE from "three";

export interface RoofCalculationRenderOptions {
  readonly scale?: number;
  readonly preview?: boolean;
  readonly semanticObjectRef?: unknown;
  readonly objectInstanceId?: string;
}

export interface RoofCalculationRenderResult {
  readonly meshes: readonly THREE.Mesh[];
  readonly materials: readonly THREE.Material[];
  readonly geometries: readonly THREE.BufferGeometry[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function point3(value: unknown, scale: number): THREE.Vector3 | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const coordinates = value.slice(0, 3).map(Number);
  if (!coordinates.every(Number.isFinite)) return null;
  return new THREE.Vector3(
    coordinates[0]! / 1000 * scale,
    coordinates[2]! / 1000 * scale,
    coordinates[1]! / 1000 * scale,
  );
}

function faceGeometry(points: readonly THREE.Vector3[]): THREE.BufferGeometry | null {
  if (points.length < 3) return null;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const indices: number[] = [];
  for (let index = 1; index < points.length - 1; index += 1) indices.push(0, index, index + 1);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function memberGeometry(
  member: Record<string, unknown>,
  scale: number,
): THREE.BufferGeometry | null {
  const start = point3(member.start_3d_mm, scale);
  const end = point3(member.end_3d_mm, scale);
  if (!start || !end) return null;
  const section = asRecord(member.section_mm);
  const width = Math.max(0.015, Number(section.width ?? 80) / 1000) * scale;
  const height = Math.max(0.015, Number(section.height ?? 200) / 1000) * scale;
  const length = start.distanceTo(end);
  if (!Number.isFinite(length) || length <= 1e-6) return null;
  const geometry = new THREE.BoxGeometry(width, length, height);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end.clone().sub(start).normalize(),
  ));
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createRoofCalculationMeshes(
  calculationValue: unknown,
  options: RoofCalculationRenderOptions = {},
): RoofCalculationRenderResult {
  const calculation = asRecord(calculationValue);
  if (calculation.ok !== true) return { meshes: [], materials: [], geometries: [] };
  const scale = Number.isFinite(options.scale) && Number(options.scale) > 0 ? Number(options.scale) : 1;
  const preview = options.preview === true;
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.82,
    metalness: 0.02,
    transparent: preview,
    opacity: preview ? 0.64 : 1,
    depthWrite: !preview,
    side: THREE.DoubleSide,
  });
  const rafterMaterial = new THREE.MeshStandardMaterial({
    color: 0xc08457,
    roughness: 0.9,
    transparent: preview,
    opacity: preview ? 0.78 : 1,
  });
  const purlinMaterial = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.88,
    transparent: preview,
    opacity: preview ? 0.82 : 1,
  });
  const materials: THREE.Material[] = [skinMaterial, rafterMaterial, purlinMaterial];
  const meshes: THREE.Mesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, part: string): void => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `roof:${options.objectInstanceId ?? "preview"}:${part}`;
    mesh.castShadow = !preview;
    mesh.receiveShadow = true;
    mesh.renderOrder = preview ? 86 : 0;
    mesh.userData.semanticRoof = true;
    mesh.userData.roofPart = part;
    mesh.userData.objectInstanceId = options.objectInstanceId;
    mesh.userData.semanticObjectRef = options.semanticObjectRef;
    meshes.push(mesh);
    geometries.push(geometry);
  };

  const geometry = asRecord(calculation.geometry);
  const faces = Array.isArray(geometry.faces) ? geometry.faces : [];
  faces.forEach((value, index) => {
    const face = asRecord(value);
    const points = (Array.isArray(face.polygon_3d_mm) ? face.polygon_3d_mm : [])
      .map((point) => point3(point, scale))
      .filter((point): point is THREE.Vector3 => point !== null);
    const result = faceGeometry(points);
    if (result) add(result, skinMaterial, `skin-${String(face.face_ref ?? index + 1)}`);
  });

  const structure = asRecord(calculation.structure);
  const appendMembers = (values: unknown, material: THREE.Material, role: string): void => {
    (Array.isArray(values) ? values : []).slice(0, 4096).forEach((value, index) => {
      const member = asRecord(value);
      const result = memberGeometry(member, scale);
      if (result) add(result, material, `${role}-${String(member.member_ref ?? index + 1)}`);
    });
  };
  appendMembers(structure.rafters, rafterMaterial, "rafter");
  appendMembers(structure.purlins, purlinMaterial, "purlin");
  if (meshes.length === 0) materials.forEach((material) => material.dispose());
  return { meshes, materials: meshes.length === 0 ? [] : materials, geometries };
}
