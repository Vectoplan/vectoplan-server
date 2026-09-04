import * as THREE from "three";

const SHARED_SOURCE_TEXTURE_KEY = "reconstructionPreviewSharedSourceTexture";

/** Mark the single source-plan texture as borrowed by review-panel materials. */
export function markSharedSourcePreviewTexture(texture: THREE.Texture): THREE.Texture {
  texture.userData[SHARED_SOURCE_TEXTURE_KEY] = true;
  return texture;
}

export function isSharedSourcePreviewTexture(texture: THREE.Texture | null | undefined): boolean {
  return texture?.userData[SHARED_SOURCE_TEXTURE_KEY] === true;
}

/** Dispose every GPU-backed resource owned by one isolated preview object. */
export function disposePreviewObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const renderable = child as THREE.Mesh | THREE.Line | THREE.Sprite;
    if ("geometry" in renderable && renderable.geometry instanceof THREE.BufferGeometry) {
      renderable.geometry.dispose();
    }
    if (!("material" in renderable)) return;
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.Material)) return;
      const mapped = material as THREE.Material & { map?: THREE.Texture | null };
      // Vertical section/elevation panels borrow the source page texture. Its
      // sole owner is the source plane, so removing one panel must never blank
      // the plan or the remaining panels.
      if (mapped.map && !isSharedSourcePreviewTexture(mapped.map)) mapped.map.dispose();
      material.dispose();
    });
  });
}
