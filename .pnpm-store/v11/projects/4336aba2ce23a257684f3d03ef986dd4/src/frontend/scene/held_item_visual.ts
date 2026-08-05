import * as THREE from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { RealtimeHeldItem } from "./realtime_client";
import {
  applyMaterialAppearance,
  type MaterialAppearance,
} from "../render/material_appearance_registry";

export type HeldItemVisualMode = "first-person" | "avatar";

export interface HeldItemVisualHandle {
  readonly root: THREE.Group;
  setItem(item: RealtimeHeldItem | null | undefined): void;
  setVisible(visible: boolean): void;
  update(deltaSeconds: number, nowMs: number, movementSpeed?: number): void;
  getItem(): RealtimeHeldItem | null;
  destroy(): void;
}

const MODEL_LOADER = new GLTFLoader();
const MODEL_TEMPLATES = new Map<string, Promise<THREE.Group>>();
const FIRST_PERSON_BASE_POSITION = new THREE.Vector3(0.58, -0.5, -0.95);
const FIRST_PERSON_BASE_ROTATION = new THREE.Euler(-0.18, -0.64, 0.1, "YXZ");

function safeText(value: unknown, fallback: string, maximum = 180): string {
  try {
    const normalized = String(value ?? "").trim();
    return (normalized || fallback).slice(0, maximum);
  } catch {
    return fallback;
  }
}

function safeColor(value: unknown): THREE.Color {
  const color = new THREE.Color(0x68a38a);
  try {
    color.setStyle(safeText(value, "#68a38a", 64));
  } catch {
    // Keep the neutral architectural green fallback.
  }
  return color;
}

function safeModelUrl(value: unknown): string | null {
  const raw = safeText(value, "", 1_024);
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function itemSignature(item: RealtimeHeldItem | null | undefined): string {
  if (!item) return "";
  return [
    item.id,
    item.kind,
    item.color,
    item.modelUrl ?? "",
    item.textureKey ?? item.textureUrl ?? "",
    item.roughness,
    item.metalness,
  ].join("\u001f");
}

function appearanceFromHeldItem(item: RealtimeHeldItem): MaterialAppearance {
  return {
    textureUrl: item.textureUrl,
    textureKey: item.textureKey,
    color: item.color,
    materialType: null,
    roughness: item.roughness,
    metalness: item.metalness,
    anisotropy: 4,
    generateMipmaps: true,
  };
}

function configureMaterial<T extends THREE.Material>(material: T, mode: HeldItemVisualMode): T {
  material.transparent = false;
  material.depthTest = mode !== "first-person";
  material.depthWrite = mode !== "first-person";
  material.fog = mode !== "first-person";
  material.needsUpdate = true;
  return material;
}

function configureObject(object: THREE.Object3D, mode: HeldItemVisualMode): void {
  object.traverse((child) => {
    child.renderOrder = mode === "first-person" ? 20_000 : 0;
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = mode === "avatar";
    child.receiveShadow = false;
    child.frustumCulled = false;
  });
}

function createBlockContent(
  item: RealtimeHeldItem,
  mode: HeldItemVisualMode,
): { readonly object: THREE.Group; readonly dispose: () => void } {
  const group = new THREE.Group();
  group.name = `vectoplan-held-item-content:${safeText(item.id, "item", 180)}`;
  const color = safeColor(item.color);
  const mainMaterial = configureMaterial(new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.66,
    metalness: 0.02,
    clearcoat: 0.12,
    clearcoatRoughness: 0.72,
    emissive: color.clone().multiplyScalar(0.08),
    emissiveIntensity: mode === "first-person" ? 0.5 : 0.18,
  }), mode);
  const topMaterial = configureMaterial(new THREE.MeshStandardMaterial({
    color: color.clone().lerp(new THREE.Color(0xffffff), 0.2),
    roughness: 0.58,
    metalness: 0,
    emissive: color.clone().multiplyScalar(0.05),
    emissiveIntensity: mode === "first-person" ? 0.35 : 0.1,
  }), mode);
  const appearance = appearanceFromHeldItem(item);
  applyMaterialAppearance(mainMaterial, appearance);
  applyMaterialAppearance(topMaterial, appearance);
  const edgeMaterial = configureMaterial(new THREE.LineBasicMaterial({
    color: color.clone().lerp(new THREE.Color(0x08141f), 0.42),
    transparent: mode === "first-person",
    opacity: mode === "first-person" ? 0.78 : 0.62,
  }), mode);
  const geometry = new THREE.BoxGeometry(0.78, 0.78, 0.78);
  const cube = new THREE.Mesh(geometry, mainMaterial);
  cube.name = "vectoplan-held-block";
  const topGeometry = new THREE.BoxGeometry(0.6, 0.025, 0.6);
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.name = "vectoplan-held-block-top";
  top.position.y = 0.397;
  const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.79, 0.79, 0.79), 28);
  const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edges.name = "vectoplan-held-block-edges";
  group.add(cube, top, edges);
  configureObject(group, mode);
  return {
    object: group,
    dispose: () => {
      geometry.dispose();
      topGeometry.dispose();
      edgeGeometry.dispose();
      mainMaterial.userData.vectoplanDisposed = true;
      topMaterial.userData.vectoplanDisposed = true;
      mainMaterial.dispose();
      topMaterial.dispose();
      edgeMaterial.dispose();
    },
  };
}

function loadModelTemplate(url: string): Promise<THREE.Group> {
  const cached = MODEL_TEMPLATES.get(url);
  if (cached) return cached;
  const pending = MODEL_LOADER.loadAsync(url).then((gltf) => gltf.scene);
  MODEL_TEMPLATES.set(url, pending);
  return pending;
}

function createModelContent(
  template: THREE.Group,
  mode: HeldItemVisualMode,
): { readonly object: THREE.Group; readonly dispose: () => void } {
  const object = cloneSkeleton(template) as THREE.Group;
  const materials: THREE.Material[] = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const cloneMaterial = (material: THREE.Material): THREE.Material => {
      const clone = configureMaterial(material.clone(), mode);
      materials.push(clone);
      return clone;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(cloneMaterial)
      : cloneMaterial(child.material);
  });
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const maximum = Math.max(size.x, size.y, size.z);
  if (Number.isFinite(maximum) && maximum > 0.0001) {
    object.scale.multiplyScalar(0.8 / maximum);
  }
  object.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(object);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.name = "vectoplan-held-model";
  configureObject(object, mode);
  return {
    object,
    dispose: () => materials.forEach((material) => material.dispose()),
  };
}

export function createHeldItemVisual(
  parent: THREE.Object3D,
  mode: HeldItemVisualMode,
): HeldItemVisualHandle {
  const root = new THREE.Group();
  root.name = `vectoplan-held-item:${mode}`;
  root.visible = false;
  if (mode === "first-person") {
    root.position.copy(FIRST_PERSON_BASE_POSITION);
    root.rotation.copy(FIRST_PERSON_BASE_ROTATION);
    root.scale.setScalar(0.32);
  } else {
    root.position.set(0.015, -0.1, -0.12);
    root.rotation.set(-0.18, -0.7, 0.18, "YXZ");
    root.scale.setScalar(0.44);
  }
  parent.add(root);

  let currentItem: RealtimeHeldItem | null = null;
  let currentSignature = "";
  let currentContent: THREE.Object3D | null = null;
  let disposeContent: (() => void) | null = null;
  let visible = true;
  let destroyed = false;
  let bobPhase = 0;

  function clearContent(): void {
    if (currentContent) root.remove(currentContent);
    currentContent = null;
    disposeContent?.();
    disposeContent = null;
  }

  function installContent(content: { readonly object: THREE.Group; readonly dispose: () => void }): void {
    clearContent();
    currentContent = content.object;
    disposeContent = content.dispose;
    root.add(content.object);
    root.visible = visible && Boolean(currentItem);
  }

  function setItem(item: RealtimeHeldItem | null | undefined): void {
    if (destroyed) return;
    const next = item ?? null;
    const signature = itemSignature(next);
    if (signature === currentSignature) return;
    currentSignature = signature;
    currentItem = next;
    clearContent();
    root.visible = false;
    if (!next) return;

    installContent(createBlockContent(next, mode));
    const modelUrl = safeModelUrl(next.modelUrl);
    if (!modelUrl) return;
    void loadModelTemplate(modelUrl).then((template) => {
      if (destroyed || currentSignature !== signature) return;
      installContent(createModelContent(template, mode));
    }).catch(() => {
      // The immediately visible block representation remains the reliable fallback.
    });
  }

  return {
    root,
    setItem,
    setVisible(nextVisible): void {
      visible = nextVisible;
      root.visible = visible && Boolean(currentItem);
    },
    update(deltaSeconds, nowMs, movementSpeed = 0): void {
      if (mode !== "first-person" || !currentItem) return;
      const speedFactor = THREE.MathUtils.clamp(movementSpeed / 6.5, 0, 1);
      bobPhase += Math.max(0, deltaSeconds) * (2.4 + speedFactor * 8.2);
      const bob = Math.sin(bobPhase) * 0.014 * speedFactor;
      const sway = Math.cos(bobPhase * 0.5) * 0.01 * speedFactor;
      const idle = Math.sin(nowMs * 0.0014) * 0.004;
      root.position.set(
        FIRST_PERSON_BASE_POSITION.x + sway,
        FIRST_PERSON_BASE_POSITION.y + bob + idle,
        FIRST_PERSON_BASE_POSITION.z,
      );
      root.rotation.set(
        FIRST_PERSON_BASE_ROTATION.x + bob * 0.45,
        FIRST_PERSON_BASE_ROTATION.y + sway * 0.7,
        FIRST_PERSON_BASE_ROTATION.z - sway,
        "YXZ",
      );
    },
    getItem: () => currentItem,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearContent();
      parent.remove(root);
      currentItem = null;
      currentSignature = "";
    },
  };
}
