import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { roofCalculationVersionSnapshot } from "../world_edit/systems/roof/zones";
import {
  isUnmodifiedLod2RoofCalculation,
  LOD2_EXISTING_ROOF_COLOR,
  LOD2_EXISTING_ROOF_SEAM_COLOR,
} from "./lod2_existing_appearance";

export interface RoofCalculationRenderOptions {
  readonly scale?: number;
  readonly preview?: boolean;
  readonly semanticObjectRef?: unknown;
  readonly objectInstanceId?: string;
  /** Disable only for geometry regression comparisons; production batches parts. */
  readonly mergeParts?: boolean;
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

function direction3(value: unknown): THREE.Vector3 | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const coordinates = value.slice(0, 3).map(Number);
  if (!coordinates.every(Number.isFinite)) return null;
  const result = new THREE.Vector3(coordinates[0]!, coordinates[2]!, coordinates[1]!);
  return result.lengthSq() > 1e-12 ? result.normalize() : null;
}

function cleanFacePoints(points: readonly THREE.Vector3[]): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (const point of points) {
    if (!result.at(-1)?.equals(point)) result.push(point.clone());
  }
  if (result.length > 2 && result[0]!.equals(result.at(-1)!)) result.pop();
  return result;
}

function faceNormal(points: readonly THREE.Vector3[]): THREE.Vector3 | null {
  if (points.length < 3) return null;
  // Newell's method remains stable when the first three vertices happen to be
  // collinear (common on imported eaves with an intermediate point).
  const normal = new THREE.Vector3();
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  return normal.lengthSq() > 1e-12 ? normal.normalize() : null;
}

function triangulatedFaceIndices(
  points: readonly THREE.Vector3[],
  desiredNormal: THREE.Vector3,
): number[] {
  const absolute = [Math.abs(desiredNormal.x), Math.abs(desiredNormal.y), Math.abs(desiredNormal.z)];
  const droppedAxis = absolute.indexOf(Math.max(...absolute));
  const projected = points.map((point) => droppedAxis === 0
    ? new THREE.Vector2(point.y, point.z)
    : droppedAxis === 1
      ? new THREE.Vector2(point.x, point.z)
      : new THREE.Vector2(point.x, point.y));
  const triangles = THREE.ShapeUtils.triangulateShape(projected, []);
  const indices: number[] = [];
  for (const triangle of triangles) {
    let [first, second, third] = triangle;
    const normal = new THREE.Vector3().crossVectors(
      points[second]!.clone().sub(points[first]!),
      points[third]!.clone().sub(points[first]!),
    );
    if (normal.dot(desiredNormal) < 0) [second, third] = [third, second];
    indices.push(first, second, third);
  }
  return indices;
}

function faceGeometry(inputPoints: readonly THREE.Vector3[]): THREE.BufferGeometry | null {
  const points = cleanFacePoints(inputPoints);
  const normal = faceNormal(points);
  if (!normal) return null;
  const indices = triangulatedFaceIndices(points, normal);
  if (indices.length < 3) return null;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function solidFaceGeometry(
  inputTopPoints: readonly THREE.Vector3[],
  thickness: number,
): THREE.BufferGeometry | null {
  const topPoints = cleanFacePoints(inputTopPoints);
  if (topPoints.length < 3 || !Number.isFinite(thickness) || thickness <= 1e-6) {
    return faceGeometry(topPoints);
  }
  const rawNormal = faceNormal(topPoints);
  if (!rawNormal) return null;
  const outwardNormal = rawNormal.clone();
  if (outwardNormal.y < 0) outwardNormal.negate();
  const bottomPoints = topPoints.map((point) => point.clone().addScaledVector(outwardNormal, -thickness));
  const points = [...topPoints, ...bottomPoints];
  const count = topPoints.length;
  const topIndices = triangulatedFaceIndices(topPoints, outwardNormal);
  if (topIndices.length < 3) return null;
  const indices = [...topIndices];
  for (let index = 0; index < topIndices.length; index += 3) {
    indices.push(
      count + topIndices[index]!,
      count + topIndices[index + 2]!,
      count + topIndices[index + 1]!,
    );
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(index, next, count + next, index, count + next, count + index);
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function rawPoint3(value: unknown): readonly [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const coordinates = value.slice(0, 3).map(Number);
  return coordinates.every(Number.isFinite)
    ? coordinates as [number, number, number]
    : null;
}

function roofEdgeKey(first: readonly number[], second: readonly number[]): string {
  const encode = (point: readonly number[]): string => point.map((value) => value.toFixed(3)).join(":");
  const left = encode(first);
  const right = encode(second);
  return left <= right ? `${left}|${right}` : `${right}|${left}`;
}

interface MemberInterval {
  readonly start: number;
  readonly end: number;
  readonly depth: number;
}

function memberIntervals(member: Record<string, unknown>, length: number, scale: number): readonly MemberInterval[] {
  const raw = (Array.isArray(member.notches) ? member.notches : [])
    .map(asRecord)
    .map((notch) => {
      const centre = Math.max(0, Math.min(1, Number(notch.center_ratio ?? 0.5))) * length;
      const notchLength = Math.max(0, Number(notch.length_mm ?? 0) / 1000 * scale);
      return {
        start: Math.max(0, centre - notchLength / 2),
        end: Math.min(length, centre + notchLength / 2),
        depth: Math.max(0, Number(notch.depth_mm ?? 0) / 1000 * scale),
      };
    })
    .filter((interval) => interval.end - interval.start > 1e-6 && interval.depth > 1e-6)
    .sort((left, right) => left.start - right.start);
  const merged: MemberInterval[] = [];
  for (const interval of raw) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end + 1e-6) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, interval.end),
        depth: Math.max(previous.depth, interval.depth),
      };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function memberGeometries(member: Record<string, unknown>, scale: number): readonly THREE.BufferGeometry[] {
  const start = point3(member.start_3d_mm, scale);
  const end = point3(member.end_3d_mm, scale);
  if (!start || !end) return [];
  const section = asRecord(member.section_mm);
  const width = Math.max(0.015, Number(section.width ?? 80) / 1000) * scale;
  const height = Math.max(0.015, Number(section.height ?? 200) / 1000) * scale;
  const lengthAxis = end.clone().sub(start);
  const length = lengthAxis.length();
  if (!Number.isFinite(length) || length <= 1e-6) return [];
  lengthAxis.normalize();
  const verticalSection = member.section_orientation === "vertical"
    || String(member.role ?? "").toLowerCase().includes("purlin");
  let heightAxis = verticalSection
    ? new THREE.Vector3(0, 1, 0)
    : direction3(member.height_axis_3d) ?? new THREE.Vector3(0, 1, 0);
  if (!verticalSection) {
    heightAxis = heightAxis.addScaledVector(lengthAxis, -heightAxis.dot(lengthAxis));
    if (heightAxis.lengthSq() <= 1e-10) {
      heightAxis = new THREE.Vector3(0, 1, 0).addScaledVector(lengthAxis, -lengthAxis.y);
    }
  }
  heightAxis.normalize();
  const widthAxis = heightAxis.clone().cross(lengthAxis).normalize();
  const basis = new THREE.Matrix4().makeBasis(widthAxis, heightAxis, lengthAxis);
  const intervals = memberIntervals(member, length, scale);
  const boundaries = new Set<number>([0, length]);
  intervals.forEach(({ start: intervalStart, end: intervalEnd }) => {
    boundaries.add(intervalStart);
    boundaries.add(intervalEnd);
  });
  const positions = [...boundaries].sort((left, right) => left - right);
  const result: THREE.BufferGeometry[] = [];
  for (let index = 0; index < positions.length - 1; index += 1) {
    const intervalStart = positions[index]!;
    const intervalEnd = positions[index + 1]!;
    const segmentLength = intervalEnd - intervalStart;
    if (segmentLength <= 1e-6) continue;
    const middle = (intervalStart + intervalEnd) / 2;
    const notchDepth = intervals.find(({ start: notchStart, end: notchEnd }) => (
      middle >= notchStart - 1e-6 && middle <= notchEnd + 1e-6
    ))?.depth ?? 0;
    const segmentHeight = Math.max(0.01 * scale, height - Math.min(height - 0.01 * scale, notchDepth));
    const segmentCentre = start.clone()
      .addScaledVector(lengthAxis, middle)
      .addScaledVector(heightAxis, notchDepth / 2);
    const geometry = new THREE.BoxGeometry(width, segmentHeight, segmentLength);
    geometry.applyMatrix4(basis);
    geometry.translate(segmentCentre.x, segmentCentre.y, segmentCentre.z);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    result.push(geometry);
  }
  return result;
}

function shiftedMember(
  source: Record<string, unknown>,
  offsetMm: number,
  widthMm: number,
  heightMm: number,
): Record<string, unknown> {
  const axis = Array.isArray(source.height_axis_3d) ? source.height_axis_3d.map(Number) : [0, 0, 1];
  const shift = (point: unknown): unknown => Array.isArray(point) && point.length >= 3
    ? point.slice(0, 3).map((coordinate, index) => Number(coordinate) + Number(axis[index] ?? 0) * offsetMm)
    : point;
  return {
    ...source,
    start_3d_mm: shift(source.start_3d_mm),
    end_3d_mm: shift(source.end_3d_mm),
    section_mm: { width: widthMm, height: heightMm },
    notches: [],
  };
}

function roofPartRole(part: string): string {
  return ["counter-batten", "tile-batten", "tile-edge", "roof-cap", "tile-row", "tile-joint",
    "tiles", "insulation", "sheathing", "rafter", "purlin"]
    .find((role) => part.startsWith(`${role}-`)) ?? part;
}

function batchRoofParts(meshes: THREE.Mesh[], geometries: THREE.BufferGeometry[]): void {
  const groups = new Map<string, THREE.Mesh[]>();
  for (const mesh of meshes) {
    const material = mesh.material as THREE.Material;
    const role = roofPartRole(String(mesh.userData.roofPart));
    const attributes = Object.keys(mesh.geometry.attributes).sort()
      .map((name) => {
        const attribute = mesh.geometry.getAttribute(name);
        return `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`;
      })
      .join("|");
    // Keep transparent faces independently sortable. Opaque timber, battens and
    // tiles are all in world coordinates and can share one draw per part kind.
    const key = material.transparent ? mesh.uuid
      : `${material.id}:${role}:${Boolean(mesh.geometry.index)}:${attributes}`;
    const group = groups.get(key) ?? [];
    group.push(mesh);
    groups.set(key, group);
  }
  const batched: THREE.Mesh[] = [];
  for (const group of groups.values()) {
    const merged = group.length > 1 ? mergeGeometries(group.map((mesh) => mesh.geometry), false) : null;
    if (!merged) { batched.push(...group); continue; }
    let indexOffset = 0;
    const parts = group.map((mesh) => {
      const indexCount = mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count;
      const part = { part: mesh.userData.roofPart, indexOffset, indexCount };
      indexOffset += indexCount;
      return part;
    });
    const first = group[0]!;
    group.forEach((mesh) => mesh.geometry.dispose());
    first.geometry = merged;
    first.userData.roofPart = `${roofPartRole(String(first.userData.roofPart))}-batch`;
    // Retain the original semantic part names and index ranges for hit mapping.
    first.userData.roofParts = parts;
    first.name = `roof:${first.userData.objectInstanceId ?? "preview"}:${first.userData.roofPart}`;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    batched.push(first);
  }
  meshes.splice(0, meshes.length, ...batched);
  geometries.splice(0, geometries.length, ...batched.map((mesh) => mesh.geometry));
}

export function createRoofCalculationMeshes(
  calculationValue: unknown,
  options: RoofCalculationRenderOptions = {},
): RoofCalculationRenderResult {
  const calculation = asRecord(calculationValue);
  if (calculation.ok !== true) return { meshes: [], materials: [], geometries: [] };
  const calculationVersion = roofCalculationVersionSnapshot(calculation);
  const scale = Number.isFinite(options.scale) && Number(options.scale) > 0 ? Number(options.scale) : 1;
  const preview = options.preview === true;
  const existingLod2Roof = isUnmodifiedLod2RoofCalculation(
    calculationValue,
    options.semanticObjectRef,
  );
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: existingLod2Roof ? LOD2_EXISTING_ROOF_COLOR : 0xb9471c,
    roughness: 0.86,
    metalness: 0.01,
    // The editable roof zone remains visible around the roof, while the actual
    // tile plane must stay opaque so rafters and purlins cannot shine through.
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const tileSeamMaterial = new THREE.MeshStandardMaterial({
    color: existingLod2Roof ? LOD2_EXISTING_ROOF_SEAM_COLOR : 0x7f1d1d,
    roughness: 0.92,
  });
  const sheathingMaterial = new THREE.MeshStandardMaterial({ color: 0xd6b57a, roughness: 0.96, side: THREE.DoubleSide });
  const insulationMaterial = new THREE.MeshStandardMaterial({
    color: 0xeabf45,
    roughness: 1,
    transparent: true,
    opacity: preview ? 0.34 : 0.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rafterMaterial = new THREE.MeshStandardMaterial({ color: 0xb77946, roughness: 0.9 });
  const purlinMaterial = new THREE.MeshStandardMaterial({ color: 0x754225, roughness: 0.9 });
  const battenMaterial = new THREE.MeshStandardMaterial({ color: 0xd2a469, roughness: 0.92 });
  const materials: THREE.Material[] = [
    skinMaterial, tileSeamMaterial, sheathingMaterial, insulationMaterial,
    rafterMaterial, purlinMaterial, battenMaterial,
  ];
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
    mesh.userData.roofCalculationVersion = calculationVersion;
    mesh.userData.existingLod2Roof = existingLod2Roof;
    meshes.push(mesh);
    geometries.push(geometry);
  };

  const geometry = asRecord(calculation.geometry);
  const structuralFaces = Array.isArray(geometry.faces) ? geometry.faces : [];
  const buildUp = asRecord(calculation.roof_build_up);
  const layers = (Array.isArray(buildUp.layers) ? buildUp.layers : []).map(asRecord);
  const layer = (role: string): Record<string, unknown> => layers.find((candidate) => candidate.role === role) ?? {};
  const tileLayer = layer("roof_tile");
  const tileLayerOffsetsPresent = tileLayer.top_offset_mm !== undefined && tileLayer.bottom_offset_mm !== undefined;
  const tileThicknessMm = Number(tileLayer.thickness_mm ?? (
    tileLayerOffsetsPresent
      ? Number(tileLayer.top_offset_mm) - Number(tileLayer.bottom_offset_mm)
      : 20
  ));
  const tileThickness = Math.max(0.008, tileThicknessMm / 1000) * scale;
  const exteriorOffset = Number(buildUp.exterior_offset_mm ?? 0);
  const topFaces = Array.isArray(buildUp.top_faces) && buildUp.top_faces.length > 0
    ? buildUp.top_faces
    : structuralFaces;
  topFaces.forEach((value, index) => {
    const face = asRecord(value);
    const points = (Array.isArray(face.polygon_3d_mm) ? face.polygon_3d_mm : [])
      .map((point) => point3(point, scale))
      .filter((point): point is THREE.Vector3 => point !== null);
    const result = solidFaceGeometry(points, tileThickness);
    if (result) add(result, skinMaterial, `tiles-${String(face.face_ref ?? index + 1)}`);
  });

  // Close every outer roof edge from the structural plane up to the tile top.
  // This is the visible verge/eaves finish and prevents battens from showing
  // through what used to be an infinitely thin tile surface.
  const structuralByRef = new Map<string, Record<string, unknown>>(
    structuralFaces.map((value, index) => {
      const face = asRecord(value);
      return [String(face.face_ref ?? index + 1), face];
    }),
  );
  const edgeOccurrences = new Map<string, Array<{
    readonly topStart: THREE.Vector3;
    readonly topEnd: THREE.Vector3;
    readonly bottomStart: THREE.Vector3;
    readonly bottomEnd: THREE.Vector3;
  }>>();
  topFaces.forEach((value, index) => {
    const topFace = asRecord(value);
    const faceRef = String(topFace.face_ref ?? index + 1);
    const structuralFace = structuralByRef.get(faceRef);
    const rawTop = Array.isArray(topFace.polygon_3d_mm) ? topFace.polygon_3d_mm : [];
    const rawBottom = Array.isArray(structuralFace?.polygon_3d_mm) ? structuralFace.polygon_3d_mm : [];
    if (rawTop.length < 3 || rawTop.length !== rawBottom.length || exteriorOffset <= 1e-6) return;
    for (let edgeIndex = 0; edgeIndex < rawBottom.length; edgeIndex += 1) {
      const next = (edgeIndex + 1) % rawBottom.length;
      const keyStart = rawPoint3(rawBottom[edgeIndex]);
      const keyEnd = rawPoint3(rawBottom[next]);
      const topStart = point3(rawTop[edgeIndex], scale);
      const topEnd = point3(rawTop[next], scale);
      const bottomStart = point3(rawBottom[edgeIndex], scale);
      const bottomEnd = point3(rawBottom[next], scale);
      if (!keyStart || !keyEnd || !topStart || !topEnd || !bottomStart || !bottomEnd) continue;
      const key = roofEdgeKey(keyStart, keyEnd);
      const occurrences = edgeOccurrences.get(key) ?? [];
      occurrences.push({ topStart, topEnd, bottomStart, bottomEnd });
      edgeOccurrences.set(key, occurrences);
    }
  });
  let tileEdgeIndex = 0;
  edgeOccurrences.forEach((occurrences) => {
    if (occurrences.length !== 1) return;
    const edge = occurrences[0]!;
    const result = faceGeometry([edge.topStart, edge.topEnd, edge.bottomEnd, edge.bottomStart]);
    if (result) add(result, skinMaterial, `tile-edge-${++tileEdgeIndex}`);
  });

  const sheathing = layer("roof_sheathing");
  const insulation = layer("insulation");
  const addOffsetLayer = (source: Record<string, unknown>, material: THREE.Material, role: string): void => {
    const offset = (Number(source.bottom_offset_mm ?? 0) + Number(source.top_offset_mm ?? 0)) / 2;
    structuralFaces.forEach((faceValue, index) => {
      const face = asRecord(faceValue);
      const points = (Array.isArray(face.polygon_3d_mm) ? face.polygon_3d_mm : [])
        .map((point) => point3(point, scale))
        .filter((point): point is THREE.Vector3 => point !== null);
      if (points.length < 3) return;
      const normal = new THREE.Vector3().crossVectors(
        points[1]!.clone().sub(points[0]!),
        points[2]!.clone().sub(points[0]!),
      ).normalize();
      if (normal.y < 0) normal.negate();
      points.forEach((point) => point.addScaledVector(normal, offset / 1000 * scale));
      const result = faceGeometry(points);
      if (result) add(result, material, `${role}-${String(face.face_ref ?? index + 1)}`);
    });
  };
  if (Object.keys(insulation).length > 0) addOffsetLayer(insulation, insulationMaterial, "insulation");
  if (Object.keys(sheathing).length > 0) addOffsetLayer(sheathing, sheathingMaterial, "sheathing");

  const appendMembers = (values: unknown, material: THREE.Material, role: string): void => {
    (Array.isArray(values) ? values : []).slice(0, 8192).forEach((value, index) => {
      const member = asRecord(value);
      memberGeometries(member, scale).forEach((result, segmentIndex) => {
        add(result, material, `${role}-${String(member.member_ref ?? index + 1)}-${segmentIndex + 1}`);
      });
    });
  };
  const structure = asRecord(calculation.structure);
  appendMembers(structure.rafters, rafterMaterial, "rafter");
  appendMembers(structure.purlins, purlinMaterial, "purlin");
  appendMembers(buildUp.counter_battens, battenMaterial, "counter-batten");
  appendMembers(buildUp.tile_battens, battenMaterial, "tile-batten");
  appendMembers(buildUp.roof_caps, skinMaterial, "roof-cap");

  const tileBattenLayer = layer("tile_batten");
  const counterBattenLayer = layer("counter_batten");
  const tileBattenCentre = (Number(tileBattenLayer.bottom_offset_mm ?? 0) + Number(tileBattenLayer.top_offset_mm ?? 0)) / 2;
  const counterBattenCentre = (Number(counterBattenLayer.bottom_offset_mm ?? 0) + Number(counterBattenLayer.top_offset_mm ?? 0)) / 2;
  const tileRows = (Array.isArray(buildUp.tile_battens) ? buildUp.tile_battens : [])
    .map((value) => shiftedMember(asRecord(value), exteriorOffset - tileBattenCentre + 2, 14, 4));
  const tileJoints = (Array.isArray(buildUp.counter_battens) ? buildUp.counter_battens : [])
    .map((value) => shiftedMember(asRecord(value), exteriorOffset - counterBattenCentre + 2, 8, 3));
  appendMembers(tileRows, tileSeamMaterial, "tile-row");
  appendMembers(tileJoints, tileSeamMaterial, "tile-joint");

  if (options.mergeParts !== false && meshes.length > 1) batchRoofParts(meshes, geometries);
  if (meshes.length === 0) materials.forEach((material) => material.dispose());
  return { meshes, materials: meshes.length === 0 ? [] : materials, geometries };
}
