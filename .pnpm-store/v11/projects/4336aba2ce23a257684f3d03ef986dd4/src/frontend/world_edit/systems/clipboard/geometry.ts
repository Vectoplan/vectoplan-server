import type { WorldEditPosition } from "../contracts";

export interface ClipboardSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type ClipboardAxis = "x" | "y" | "z";

/**
 * Clipboard tools are deliberately unrestricted by the parcel selection.
 * Their capture and paste targets may cross or lie completely outside a
 * selected parcel, irrespective of the shared mask checkbox.
 */
export function clipboardParcelMaskEnabled(
  _requested: boolean | null | undefined,
  _selectedParcelCount: number,
): boolean {
  return false;
}

export function clipboardAnchorAlongAxis(
  anchor: WorldEditPosition,
  axis: ClipboardAxis,
  offset: number,
): WorldEditPosition {
  const result = { ...anchor };
  result[axis] += Math.round(Number.isFinite(offset) ? offset : 0);
  return result;
}

export function clipboardSelectionSize(first: WorldEditPosition, second: WorldEditPosition): ClipboardSize {
  return {
    x: Math.abs(second.x - first.x) + 1,
    y: Math.abs(second.y - first.y) + 1,
    z: Math.abs(second.z - first.z) + 1,
  };
}

export function clipboardBoundsAt(anchor: WorldEditPosition, size: ClipboardSize): Readonly<{
  first: WorldEditPosition;
  second: WorldEditPosition;
}> {
  return {
    first: { x: anchor.x, y: anchor.y, z: anchor.z },
    second: {
      x: anchor.x + Math.max(1, size.x) - 1,
      y: anchor.y + Math.max(1, size.y) - 1,
      z: anchor.z + Math.max(1, size.z) - 1,
    },
  };
}

export function clipboardEntryColor(blockTypeId: unknown): number {
  const value = String(blockTypeId ?? "air");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 0x4f78a8 ^ (hash & 0x2f7f7f);
}
