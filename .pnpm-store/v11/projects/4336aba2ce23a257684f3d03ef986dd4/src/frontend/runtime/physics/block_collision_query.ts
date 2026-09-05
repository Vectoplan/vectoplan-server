// services/vectoplan-editor/src/frontend/runtime/physics/block_collision_query.ts

import type {
  CollisionCellKind,
  CollisionCellRef,
  CollisionQueryResult,
  CollisionResolutionPolicy,
  CollisionTrace,
  PhysicsAabb,
} from "./physics_models";

import {
  createCollisionQueryResult,
  sanitizePhysicsBoolean,
  sanitizePhysicsNumber,
  sanitizePhysicsString,
} from "./physics_models";

import type { AabbCellRange, AabbCellRef } from "./aabb";

import {
  AABB_DEFAULT_SKIN_WIDTH,
  AABB_MAX_ITERATED_CELLS,
  aabbIntersects,
  cloneAabb,
  collectCellsInAabbRange,
  createBlockAabb,
  forEachCellInAabbRange,
  getAabbCellRange,
  getAabbCellRangeSize,
  isAabbCellRangeReasonable,
  normalizeAabbCellRange,
} from "./aabb";

import {
  DEFAULT_PHYSICS_MISSING_CHUNK_CONFIG,
  normalizeCollisionResolutionPolicy,
} from "./physics_defaults";

/**
 * Collision query adapter between physics and the currently loaded voxel/chunk world.
 *
 * This file must not import ChunkRegistry/WorldRuntime directly.
 * Instead, WorldRuntime should later expose a small reader that implements
 * BlockCollisionWorldReader.
 *
 * Design rule:
 * - Physics asks this query layer about cells.
 * - This query layer asks a reader about loaded world data.
 * - Chunk loading, HTTP calls and remeshing stay outside this file.
 *
 * Version 2 collision rules:
 * - Loaded Air is always non-solid, even if a reader reports contradictory flags.
 * - Loaded solid cells are always solid.
 * - Reader isCellLoaded() is an advisory hint, never an authoritative early return.
 * - getCollisionCell() is the source of truth whenever it returns usable data.
 * - Missing cells/chunks follow the configured missing-chunk policy.
 * - Contact-only voxel candidates are filtered with a small tolerance so floor
 *   contact cannot become a false horizontal wall.
 */

export type BlockCollisionMissingCellReason =
  | "chunk_missing"
  | "cell_missing"
  | "reader_unavailable"
  | "reader_failed"
  | "out_of_bounds"
  | "unknown";

export interface BlockCollisionWorldCellInput {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BlockCollisionWorldCellResult {
  readonly kind?: CollisionCellKind | null;
  readonly solid?: boolean | null;
  readonly loaded?: boolean | null;
  readonly blockTypeId?: string | null;
  readonly policy?: CollisionResolutionPolicy | null;
  readonly missingReason?: BlockCollisionMissingCellReason | null;
  readonly source?: string | null;
}

export interface BlockCollisionWorldReader {
  /** Optional shape bounds over the queried footprint (null means no solid volume). */
  readonly getBlockingBounds?: (cell: BlockCollisionWorldCellInput, query: PhysicsAabb) => PhysicsAabb | null;
  /**
   * Return collision data for one world cell.
   *
   * Expected behavior:
   * - loaded air cell:
   *   { kind: "air", solid: false, loaded: true }
   *
   * - loaded solid cell:
   *   { kind: "solid", solid: true, loaded: true, blockTypeId: "debug_grass" }
   *
   * - missing chunk/cell:
   *   { kind: "unknown", loaded: false, missingReason: "chunk_missing" }
   *
   * This method should be fast and must not perform network requests.
   */
  readonly getCollisionCell?: (
    cell: BlockCollisionWorldCellInput,
  ) => BlockCollisionWorldCellResult | CollisionQueryResult | null | undefined;

  /**
   * Optional faster presence check. If omitted, getCollisionCell() is used.
   */
  readonly isCellLoaded?: (cell: BlockCollisionWorldCellInput) => boolean;

  /**
   * Optional world bounds check. If omitted, all coordinates are considered in range.
   */
  readonly isCellInBounds?: (cell: BlockCollisionWorldCellInput) => boolean;

  /**
   * Optional source label for diagnostics.
   */
  readonly sourceName?: string;
}

export interface BlockCollisionQueryConfig {
  readonly missingCellPolicy: CollisionResolutionPolicy;
  readonly treatUnknownAsSolid: boolean;
  readonly treatNonSolidKindAsSolid: boolean;
  readonly includeTraceCells: boolean;
  readonly maxCellsPerQuery: number;
  readonly contactEpsilon: number;
  readonly minY: number | null;
  readonly maxY: number | null;
}

export interface BlockCollisionQueryConfigPatch {
  readonly missingCellPolicy?: unknown;
  readonly treatUnknownAsSolid?: unknown;
  readonly treatNonSolidKindAsSolid?: unknown;
  readonly includeTraceCells?: unknown;
  readonly maxCellsPerQuery?: unknown;
  readonly contactEpsilon?: unknown;
  readonly minY?: unknown;
  readonly maxY?: unknown;
}

export interface BlockCollisionCellDiagnostics {
  readonly readerLoadedHint: boolean | null;
  readonly readerReportedLoaded: boolean | null;
  readonly inferredLoadedFromContent: boolean;
  readonly loadedHintMismatch: boolean;
  readonly normalizedAirSolidConflict: boolean;
  readonly normalizedSolidKindConflict: boolean;
  readonly warnings: readonly string[];
}

export interface BlockCollisionQueryCellResult extends CollisionQueryResult {
  readonly cell: AabbCellRef;
  readonly missingReason?: BlockCollisionMissingCellReason | null;
  readonly source?: string | null;
  readonly diagnostics?: BlockCollisionCellDiagnostics;
}

export interface BlockCollisionCellsResult {
  readonly ok: boolean;
  readonly range: AabbCellRange;
  readonly checkedCellCount: number;
  readonly solidCellCount: number;
  readonly missingCellCount: number;
  readonly cells: readonly BlockCollisionQueryCellResult[];
  readonly solidCells: readonly BlockCollisionQueryCellResult[];
  readonly trace: CollisionTrace;
  readonly warnings: readonly string[];
}

export interface BlockCollisionAabbResult {
  readonly collides: boolean;
  readonly blockingAabbs: readonly PhysicsAabb[];
  readonly cellsResult: BlockCollisionCellsResult;
  readonly candidateSolidCellCount?: number;
  readonly contactOnlyCellCount?: number;
}

export interface BlockCollisionQuerySnapshot {
  readonly config: BlockCollisionQueryConfig;
  readonly readerAvailable: boolean;
  readonly readerSourceName: string;
  readonly lastWarnings: readonly string[];
  readonly queryCount: number;
  readonly readerFailureCount: number;
  readonly loadedHintMismatchCount: number;
  readonly canonicalAirCorrectionCount: number;
  readonly canonicalSolidCorrectionCount: number;
  readonly revision: number;
}

export const BLOCK_COLLISION_QUERY_VERSION = "0.2.0" as const;
export const BLOCK_COLLISION_QUERY_CONTRACT_VERSION =
  "block-collision-query-contract.v2" as const;

export const DEFAULT_BLOCK_COLLISION_QUERY_CONFIG: BlockCollisionQueryConfig = Object.freeze({
  missingCellPolicy: DEFAULT_PHYSICS_MISSING_CHUNK_CONFIG.policy,
  treatUnknownAsSolid: true,
  treatNonSolidKindAsSolid: false,
  includeTraceCells: false,
  maxCellsPerQuery: AABB_MAX_ITERATED_CELLS,
  contactEpsilon: AABB_DEFAULT_SKIN_WIDTH,
  minY: null,
  maxY: null,
});

export const EMPTY_BLOCK_COLLISION_CELLS_RESULT: BlockCollisionCellsResult = Object.freeze({
  ok: false,
  range: {
    minX: 0,
    minY: 0,
    minZ: 0,
    maxX: 0,
    maxY: 0,
    maxZ: 0,
  },
  checkedCellCount: 0,
  solidCellCount: 0,
  missingCellCount: 0,
  cells: [],
  solidCells: [],
  trace: {
    checkedCellCount: 0,
    solidCellCount: 0,
    missingCellCount: 0,
    cells: [],
  },
  warnings: [],
});

function createWarning(message: string): string {
  try {
    return sanitizePhysicsString(message, "Unknown collision-query warning");
  } catch {
    return "Unknown collision-query warning";
  }
}

function normalizeCellCoordinate(value: unknown, fallback = 0): number {
  try {
    return Math.floor(
      sanitizePhysicsNumber(value, fallback, {
        min: -Number.MAX_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER,
      }),
    );
  } catch {
    return fallback;
  }
}

function normalizeOptionalBound(value: unknown): number | null {
  try {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return Math.floor(
      sanitizePhysicsNumber(value, 0, {
        min: -Number.MAX_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER,
      }),
    );
  } catch {
    return null;
  }
}

function normalizeContactEpsilon(value: unknown): number {
  try {
    return sanitizePhysicsNumber(
      value,
      DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.contactEpsilon,
      {
        min: 0,
        max: 0.05,
      },
    );
  } catch {
    return DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.contactEpsilon;
  }
}

function normalizeSourceName(value: unknown): string | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    const text = sanitizePhysicsString(value, "").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function normalizeCollisionCellKind(value: unknown, fallback: CollisionCellKind = "unknown"): CollisionCellKind {
  try {
    if (
      value === "unknown" ||
      value === "air" ||
      value === "solid" ||
      value === "non_solid" ||
      value === "liquid" ||
      value === "trigger"
    ) {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeMissingReason(
  value: unknown,
  fallback: BlockCollisionMissingCellReason = "unknown",
): BlockCollisionMissingCellReason {
  try {
    if (
      value === "chunk_missing" ||
      value === "cell_missing" ||
      value === "reader_unavailable" ||
      value === "reader_failed" ||
      value === "out_of_bounds" ||
      value === "unknown"
    ) {
      return value;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeBlockTypeId(value: unknown): string | null {
  try {
    if (value === null || value === undefined) {
      return null;
    }

    const text = sanitizePhysicsString(value, "");
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function isSystemAirBlockTypeId(value: unknown): boolean {
  return normalizeBlockTypeId(value)?.toLowerCase() === "system_air";
}

function isCellInsideOptionalBounds(
  cell: AabbCellRef,
  config: BlockCollisionQueryConfig,
): boolean {
  try {
    if (config.minY !== null && cell.y < config.minY) {
      return false;
    }

    if (config.maxY !== null && cell.y > config.maxY) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

export function createBlockCollisionQueryConfig(
  patch: BlockCollisionQueryConfigPatch | null | undefined = undefined,
): BlockCollisionQueryConfig {
  try {
    let minY = normalizeOptionalBound(patch?.minY);
    let maxY = normalizeOptionalBound(patch?.maxY);

    if (minY !== null && maxY !== null && minY > maxY) {
      const previousMinY = minY;
      minY = maxY;
      maxY = previousMinY;
    }

    return {
      missingCellPolicy: normalizeCollisionResolutionPolicy(
        patch?.missingCellPolicy,
        DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.missingCellPolicy,
      ),
      treatUnknownAsSolid: sanitizePhysicsBoolean(
        patch?.treatUnknownAsSolid,
        DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.treatUnknownAsSolid,
      ),
      treatNonSolidKindAsSolid: sanitizePhysicsBoolean(
        patch?.treatNonSolidKindAsSolid,
        DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.treatNonSolidKindAsSolid,
      ),
      includeTraceCells: sanitizePhysicsBoolean(
        patch?.includeTraceCells,
        DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.includeTraceCells,
      ),
      maxCellsPerQuery: Math.max(
        1,
        Math.floor(
          sanitizePhysicsNumber(
            patch?.maxCellsPerQuery,
            DEFAULT_BLOCK_COLLISION_QUERY_CONFIG.maxCellsPerQuery,
            {
              min: 1,
              max: AABB_MAX_ITERATED_CELLS,
            },
          ),
        ),
      ),
      contactEpsilon: normalizeContactEpsilon(patch?.contactEpsilon),
      minY,
      maxY,
    };
  } catch {
    return { ...DEFAULT_BLOCK_COLLISION_QUERY_CONFIG };
  }
}

export function mergeBlockCollisionQueryConfig(
  base: BlockCollisionQueryConfig | null | undefined,
  patch: BlockCollisionQueryConfigPatch | null | undefined,
): BlockCollisionQueryConfig {
  try {
    return createBlockCollisionQueryConfig({
      ...(base ?? DEFAULT_BLOCK_COLLISION_QUERY_CONFIG),
      ...(patch ?? {}),
    });
  } catch {
    return createBlockCollisionQueryConfig(patch);
  }
}

export function createCellRef(
  x: unknown,
  y: unknown,
  z: unknown,
): AabbCellRef {
  try {
    return {
      x: normalizeCellCoordinate(x),
      y: normalizeCellCoordinate(y),
      z: normalizeCellCoordinate(z),
    };
  } catch {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }
}

export function cellRefToKey(cell: AabbCellRef): string {
  try {
    return `${normalizeCellCoordinate(cell.x)}:${normalizeCellCoordinate(cell.y)}:${normalizeCellCoordinate(cell.z)}`;
  } catch {
    return "0:0:0";
  }
}

export function createCollisionCellRef(
  cell: AabbCellRef,
  result: BlockCollisionQueryCellResult,
): CollisionCellRef {
  try {
    return {
      worldX: cell.x,
      worldY: cell.y,
      worldZ: cell.z,
      kind: result.kind,
      blockTypeId: result.blockTypeId ?? null,
      chunkLoaded: result.loaded,
    };
  } catch {
    return {
      worldX: 0,
      worldY: 0,
      worldZ: 0,
      kind: "unknown",
      blockTypeId: null,
      chunkLoaded: false,
    };
  }
}

export function resolveSolidFromKind(
  kind: CollisionCellKind,
  config: BlockCollisionQueryConfig,
): boolean {
  try {
    if (kind === "solid") {
      return true;
    }

    if (kind === "air") {
      return false;
    }

    if (kind === "unknown") {
      return config.treatUnknownAsSolid;
    }

    if (kind === "non_solid" || kind === "liquid" || kind === "trigger") {
      return config.treatNonSolidKindAsSolid;
    }

    return config.treatUnknownAsSolid;
  } catch {
    return true;
  }
}

export function resolveSolidFromMissingPolicy(
  policy: CollisionResolutionPolicy,
): boolean {
  try {
    if (policy === "treat_as_air" || policy === "allow") {
      return false;
    }

    if (policy === "block" || policy === "request_chunk" || policy === "treat_as_solid") {
      return true;
    }

    return true;
  } catch {
    return true;
  }
}

export function normalizeWorldCellResult(
  cell: AabbCellRef,
  rawResult: BlockCollisionWorldCellResult | CollisionQueryResult | null | undefined,
  config: BlockCollisionQueryConfig,
  fallback: {
    readonly loaded?: boolean;
    readonly loadedHint?: boolean | null;
    readonly missingReason?: BlockCollisionMissingCellReason;
    readonly source?: string | null;
    readonly policy?: CollisionResolutionPolicy;
  } = {},
): BlockCollisionQueryCellResult {
  try {
    const rawKind = normalizeCollisionCellKind(rawResult?.kind, "unknown");
    const rawBlockTypeId = normalizeBlockTypeId(rawResult?.blockTypeId);
    const explicitSystemAir = isSystemAirBlockTypeId(rawBlockTypeId);
    const readerReportedLoaded =
      typeof rawResult?.loaded === "boolean"
        ? rawResult.loaded
        : null;
    const readerReportedSolid =
      typeof (rawResult as BlockCollisionWorldCellResult | null | undefined)?.solid === "boolean"
        ? Boolean((rawResult as BlockCollisionWorldCellResult).solid)
        : null;
    const readerLoadedHint =
      typeof fallback.loadedHint === "boolean"
        ? fallback.loadedHint
        : null;

    const inferredLoadedFromContent = Boolean(
      rawResult &&
      (
        rawKind !== "unknown" ||
        readerReportedSolid !== null ||
        rawBlockTypeId !== null
      )
    );

    /**
     * getCollisionCell() is authoritative when it reports an explicit loaded
     * flag or usable cell semantics. isCellLoaded() is only a hint because
     * registry visibility and cell data can become briefly out of sync while
     * chunks are inserted or replaced.
     */
    const loaded =
      readerReportedLoaded ??
      (inferredLoadedFromContent
        ? true
        : typeof fallback.loaded === "boolean"
          ? fallback.loaded
          : readerLoadedHint ?? false);

    const kind = explicitSystemAir ? "air" : loaded ? rawKind : "unknown";
    const policy = loaded
      ? rawResult?.policy ?? undefined
      : rawResult?.policy ??
        fallback.policy ??
        config.missingCellPolicy;

    const normalizedAirSolidConflict =
      loaded &&
      kind === "air" &&
      readerReportedSolid === true;
    const normalizedSolidKindConflict =
      loaded &&
      kind === "solid" &&
      readerReportedSolid === false;

    const solid = explicitSystemAir
      ? false
      : !loaded
      ? resolveSolidFromMissingPolicy(policy ?? config.missingCellPolicy)
      : kind === "air"
        ? false
        : kind === "solid"
          ? true
          : readerReportedSolid !== null
            ? readerReportedSolid
            : resolveSolidFromKind(kind, config);

    const loadedHintMismatch =
      readerLoadedHint !== null &&
      readerLoadedHint !== loaded;

    const warnings: string[] = [];

    if (loadedHintMismatch) {
      warnings.push(
        createWarning(
          `Reader loaded hint (${readerLoadedHint}) disagreed with normalized cell data (${loaded}) at ${cellRefToKey(cell)}.`,
        ),
      );
    }

    if (normalizedAirSolidConflict) {
      warnings.push(
        createWarning(
          `Loaded Air was reported solid at ${cellRefToKey(cell)} and was normalized to non-solid.`,
        ),
      );
    }

    if (normalizedSolidKindConflict) {
      warnings.push(
        createWarning(
          `Loaded solid cell was reported non-solid at ${cellRefToKey(cell)} and was normalized to solid.`,
        ),
      );
    }

    if (
      readerReportedLoaded === false &&
      inferredLoadedFromContent
    ) {
      warnings.push(
        createWarning(
          `Reader returned loaded=false together with concrete cell content at ${cellRefToKey(cell)}; explicit loaded=false was kept.`,
        ),
      );
    }

    const blockTypeId =
      loaded && kind !== "air"
        ? rawBlockTypeId
        : null;

    return {
      ...createCollisionQueryResult({
        kind,
        loaded,
        blockTypeId,
        policy,
      }),
      cell,
      kind,
      loaded,
      solid,
      blockTypeId,
      policy,
      missingReason: loaded
        ? null
        : normalizeMissingReason(
            (rawResult as BlockCollisionWorldCellResult | null | undefined)?.missingReason,
            fallback.missingReason ?? "unknown",
          ),
      source: normalizeSourceName(
        (rawResult as BlockCollisionWorldCellResult | null | undefined)?.source ??
          fallback.source,
      ),
      diagnostics: {
        readerLoadedHint,
        readerReportedLoaded,
        inferredLoadedFromContent,
        loadedHintMismatch,
        normalizedAirSolidConflict,
        normalizedSolidKindConflict,
        warnings,
      },
    };
  } catch {
    return {
      ...createCollisionQueryResult({
        kind: "unknown",
        loaded: false,
        blockTypeId: null,
        policy: config.missingCellPolicy,
      }),
      cell,
      kind: "unknown",
      loaded: false,
      solid: resolveSolidFromMissingPolicy(config.missingCellPolicy),
      blockTypeId: null,
      policy: config.missingCellPolicy,
      missingReason: "unknown",
      source: null,
      diagnostics: {
        readerLoadedHint:
          typeof fallback.loadedHint === "boolean"
            ? fallback.loadedHint
            : null,
        readerReportedLoaded: null,
        inferredLoadedFromContent: false,
        loadedHintMismatch: false,
        normalizedAirSolidConflict: false,
        normalizedSolidKindConflict: false,
        warnings: [
          createWarning(
            `Collision cell normalization failed at ${cellRefToKey(cell)}.`,
          ),
        ],
      },
    };
  }
}

export function createMissingCellResult(
  cell: AabbCellRef,
  config: BlockCollisionQueryConfig,
  reason: BlockCollisionMissingCellReason,
  source: string | null = null,
): BlockCollisionQueryCellResult {
  try {
    return normalizeWorldCellResult(
      cell,
      {
        kind: "unknown",
        loaded: false,
        solid: resolveSolidFromMissingPolicy(config.missingCellPolicy),
        blockTypeId: null,
        policy: config.missingCellPolicy,
        missingReason: reason,
        source,
      },
      config,
      {
        loaded: false,
        missingReason: reason,
        source,
        policy: config.missingCellPolicy,
      },
    );
  } catch {
    return normalizeWorldCellResult(cell, null, config, {
      loaded: false,
      missingReason: reason,
      source,
      policy: config.missingCellPolicy,
    });
  }
}

export function createAirCellResult(
  cell: AabbCellRef,
  source: string | null = null,
): BlockCollisionQueryCellResult {
  try {
    return {
      ...createCollisionQueryResult({
        kind: "air",
        loaded: true,
        blockTypeId: null,
      }),
      cell,
      kind: "air",
      loaded: true,
      solid: false,
      blockTypeId: null,
      policy: undefined,
      missingReason: null,
      source,
    };
  } catch {
    return {
      ...createCollisionQueryResult({
        kind: "air",
        loaded: true,
        blockTypeId: null,
      }),
      cell,
      kind: "air",
      loaded: true,
      solid: false,
      blockTypeId: null,
      policy: undefined,
      missingReason: null,
      source,
    };
  }
}

export function createSolidCellResult(
  cell: AabbCellRef,
  blockTypeId: string | null = null,
  source: string | null = null,
): BlockCollisionQueryCellResult {
  try {
    return {
      ...createCollisionQueryResult({
        kind: "solid",
        loaded: true,
        blockTypeId,
      }),
      cell,
      kind: "solid",
      loaded: true,
      solid: true,
      blockTypeId: normalizeBlockTypeId(blockTypeId),
      policy: undefined,
      missingReason: null,
      source,
    };
  } catch {
    return normalizeWorldCellResult(
      cell,
      {
        kind: "solid",
        loaded: true,
        solid: true,
        blockTypeId,
        source,
      },
      DEFAULT_BLOCK_COLLISION_QUERY_CONFIG,
    );
  }
}

export class BlockCollisionQuery {
  private reader: BlockCollisionWorldReader | null;
  private config: BlockCollisionQueryConfig;
  private lastWarnings: string[];
  private queryCount: number;
  private readerFailureCount: number;
  private loadedHintMismatchCount: number;
  private canonicalAirCorrectionCount: number;
  private canonicalSolidCorrectionCount: number;
  private revision: number;

  public constructor(
    reader: BlockCollisionWorldReader | null | undefined = null,
    config: BlockCollisionQueryConfigPatch | null | undefined = undefined,
  ) {
    this.reader = reader ?? null;
    this.config = createBlockCollisionQueryConfig(config);
    this.lastWarnings = [];
    this.queryCount = 0;
    this.readerFailureCount = 0;
    this.loadedHintMismatchCount = 0;
    this.canonicalAirCorrectionCount = 0;
    this.canonicalSolidCorrectionCount = 0;
    this.revision = 0;
  }

  public setReader(reader: BlockCollisionWorldReader | null | undefined): void {
    try {
      this.reader = reader ?? null;
      this.revision += 1;
    } catch {
      this.reader = null;
      this.revision += 1;
    }
  }

  public updateConfig(config: BlockCollisionQueryConfigPatch | null | undefined): BlockCollisionQueryConfig {
    try {
      this.config = mergeBlockCollisionQueryConfig(this.config, config);
      this.revision += 1;
      return this.config;
    } catch {
      this.config = createBlockCollisionQueryConfig(config);
      this.revision += 1;
      return this.config;
    }
  }

  public getConfig(): BlockCollisionQueryConfig {
    try {
      return { ...this.config };
    } catch {
      return createBlockCollisionQueryConfig();
    }
  }

  public queryCell(
    x: unknown,
    y: unknown,
    z: unknown,
  ): BlockCollisionQueryCellResult {
    try {
      this.queryCount += 1;

      const cell = createCellRef(x, y, z);
      const source = this.reader?.sourceName ?? null;

      if (!isCellInsideOptionalBounds(cell, this.config)) {
        return createMissingCellResult(
          cell,
          this.config,
          "out_of_bounds",
          source,
        );
      }

      if (!this.reader || typeof this.reader.getCollisionCell !== "function") {
        this.readerFailureCount += 1;
        this.recordWarnings([
          createWarning(
            `Collision reader was unavailable for ${cellRefToKey(cell)}.`,
          ),
        ]);

        return createMissingCellResult(
          cell,
          this.config,
          "reader_unavailable",
          source,
        );
      }

      if (typeof this.reader.isCellInBounds === "function") {
        try {
          if (!this.reader.isCellInBounds(cell)) {
            return createMissingCellResult(
              cell,
              this.config,
              "out_of_bounds",
              source,
            );
          }
        } catch {
          this.readerFailureCount += 1;
          this.recordWarnings([
            createWarning(
              `Collision reader bounds check failed for ${cellRefToKey(cell)}.`,
            ),
          ]);

          return createMissingCellResult(
            cell,
            this.config,
            "reader_failed",
            source,
          );
        }
      }

      /**
       * isCellLoaded() is deliberately advisory. A registry can publish the
       * concrete cell data before a secondary loaded/visible index has caught
       * up. Returning early here used to turn valid Air into fail-closed solid
       * Missing cells and could block every horizontal movement axis.
       */
      let loadedHint: boolean | null = null;

      if (typeof this.reader.isCellLoaded === "function") {
        try {
          loadedHint = Boolean(this.reader.isCellLoaded(cell));
        } catch {
          loadedHint = null;
          this.readerFailureCount += 1;
          this.recordWarnings([
            createWarning(
              `Collision reader loaded hint failed for ${cellRefToKey(cell)}.`,
            ),
          ]);
        }
      }

      let raw:
        | BlockCollisionWorldCellResult
        | CollisionQueryResult
        | null
        | undefined = null;

      try {
        raw = this.reader.getCollisionCell(cell);
      } catch {
        this.readerFailureCount += 1;
        this.recordWarnings([
          createWarning(
            `Collision reader cell query failed for ${cellRefToKey(cell)}.`,
          ),
        ]);

        return createMissingCellResult(
          cell,
          this.config,
          "reader_failed",
          source,
        );
      }

      if (!raw) {
        return createMissingCellResult(
          cell,
          this.config,
          loadedHint === false
            ? "chunk_missing"
            : "cell_missing",
          source,
        );
      }

      const result = normalizeWorldCellResult(
        cell,
        raw,
        this.config,
        {
          loaded:
            loadedHint === null
              ? undefined
              : loadedHint,
          loadedHint,
          missingReason:
            loadedHint === false
              ? "chunk_missing"
              : "unknown",
          source,
          policy: this.config.missingCellPolicy,
        },
      );

      this.recordCellDiagnostics(result);
      return result;
    } catch {
      this.readerFailureCount += 1;

      return createMissingCellResult(
        {
          x: 0,
          y: 0,
          z: 0,
        },
        this.config,
        "reader_failed",
        this.reader?.sourceName ?? null,
      );
    }
  }

  public isSolidBlockAtCell(
    x: unknown,
    y: unknown,
    z: unknown,
  ): boolean {
    try {
      return this.queryCell(x, y, z).solid;
    } catch {
      return true;
    }
  }

  public isCellLoaded(
    x: unknown,
    y: unknown,
    z: unknown,
  ): boolean {
    try {
      return this.queryCell(x, y, z).loaded;
    } catch {
      return false;
    }
  }

  public getCollisionCellsForRange(
    range: AabbCellRange,
    options: {
      readonly includeAirCells?: boolean;
      readonly stopAtFirstSolid?: boolean;
      readonly includeTraceCells?: boolean;
      readonly maxCells?: number;
    } = {},
  ): BlockCollisionCellsResult {
    try {
      const warnings: string[] = [];
      const safeRange = normalizeAabbCellRange(range);
      const maxCells = Math.max(
        1,
        Math.floor(
          sanitizePhysicsNumber(options.maxCells, this.config.maxCellsPerQuery, {
            min: 1,
            max: AABB_MAX_ITERATED_CELLS,
          }),
        ),
      );

      if (!isAabbCellRangeReasonable(safeRange, maxCells)) {
        warnings.push(createWarning("Collision cell range was too large and has been rejected."));

        const size = getAabbCellRangeSize(safeRange);

        const trace = this.createTrace({
          checkedCellCount: 0,
          solidCellCount: 0,
          missingCellCount: 0,
          cells: [],
          includeCells: Boolean(options.includeTraceCells ?? this.config.includeTraceCells),
        });

        return {
          ok: false,
          range: safeRange,
          checkedCellCount: 0,
          solidCellCount: 0,
          missingCellCount: 0,
          cells: [],
          solidCells: [],
          trace,
          warnings: [
            ...warnings,
            createWarning(`Rejected range contained up to ${size.cellCount} cells.`),
          ],
        };
      }

      const cells: BlockCollisionQueryCellResult[] = [];
      const solidCells: BlockCollisionQueryCellResult[] = [];
      let checkedCellCount = 0;
      let missingCellCount = 0;

      const includeAirCells = sanitizePhysicsBoolean(options.includeAirCells, false);
      const stopAtFirstSolid = sanitizePhysicsBoolean(options.stopAtFirstSolid, false);

      const iteration = forEachCellInAabbRange(
        safeRange,
        (cell) => {
          const result = this.queryCell(cell.x, cell.y, cell.z);

          checkedCellCount += 1;

          if (!result.loaded) {
            missingCellCount += 1;
          }

          if (result.solid) {
            solidCells.push(result);
          }

          if (includeAirCells || result.solid || !result.loaded) {
            cells.push(result);
          }

          if (stopAtFirstSolid && result.solid) {
            return false;
          }

          return true;
        },
        maxCells,
      );

      if (iteration.aborted && !(stopAtFirstSolid && solidCells.length > 0)) {
        warnings.push(createWarning("Collision cell iteration was aborted before completion."));
      }

      const trace = this.createTrace({
        checkedCellCount,
        solidCellCount: solidCells.length,
        missingCellCount,
        cells,
        includeCells: Boolean(options.includeTraceCells ?? this.config.includeTraceCells),
      });

      this.recordWarnings(warnings);

      return {
        ok: iteration.completed || (stopAtFirstSolid && solidCells.length > 0),
        range: safeRange,
        checkedCellCount,
        solidCellCount: solidCells.length,
        missingCellCount,
        cells,
        solidCells,
        trace,
        warnings,
      };
    } catch (error) {
      const warnings = [
        createWarning(
          error instanceof Error
            ? error.message
            : "Collision cell range query failed.",
        ),
      ];

      this.recordWarnings(warnings);

      return {
        ...EMPTY_BLOCK_COLLISION_CELLS_RESULT,
        range: normalizeAabbCellRange(range),
        warnings,
      };
    }
  }

  public getCollisionCellsForAabb(
    aabb: PhysicsAabb,
    options: {
      readonly includeAirCells?: boolean;
      readonly stopAtFirstSolid?: boolean;
      readonly includeTraceCells?: boolean;
      readonly maxCells?: number;
    } = {},
  ): BlockCollisionCellsResult {
    try {
      const range = getAabbCellRange(aabb);
      return this.getCollisionCellsForRange(range, options);
    } catch {
      return {
        ...EMPTY_BLOCK_COLLISION_CELLS_RESULT,
        warnings: [createWarning("Collision AABB query failed.")],
      };
    }
  }

  public getSolidCellsForAabb(
    aabb: PhysicsAabb,
    options: {
      readonly maxCells?: number;
      readonly includeTraceCells?: boolean;
    } = {},
  ): readonly BlockCollisionQueryCellResult[] {
    try {
      return this.getCollisionCellsForAabb(aabb, {
        includeAirCells: false,
        stopAtFirstSolid: false,
        includeTraceCells: options.includeTraceCells,
        maxCells: options.maxCells,
      }).solidCells;
    } catch {
      return [];
    }
  }

  public hasSolidCollision(aabb: PhysicsAabb): boolean {
    try {
      const result = this.getCollisionCellsForAabb(aabb, {
        includeAirCells: false,
        stopAtFirstSolid: true,
        includeTraceCells: false,
      });

      return result.solidCells.length > 0;
    } catch {
      return true;
    }
  }

  public getFirstSolidCollision(aabb: PhysicsAabb): BlockCollisionQueryCellResult | null {
    try {
      const result = this.getCollisionCellsForAabb(aabb, {
        includeAirCells: false,
        stopAtFirstSolid: true,
        includeTraceCells: false,
      });

      return result.solidCells[0] ?? null;
    } catch {
      return null;
    }
  }

  public getBlockingBlockAabbsForAabb(
    aabb: PhysicsAabb,
    options: {
      readonly maxCells?: number;
      readonly includeTraceCells?: boolean;
    } = {},
  ): BlockCollisionAabbResult {
    try {
      const safeAabb = cloneAabb(aabb);
      const candidateCellsResult = this.getCollisionCellsForAabb(
        safeAabb,
        {
          includeAirCells: false,
          stopAtFirstSolid: false,
          includeTraceCells: options.includeTraceCells,
          maxCells: options.maxCells,
        },
      );

      const blockingAabbs: PhysicsAabb[] = [];
      const blockingCells: BlockCollisionQueryCellResult[] = [];
      const blockingKeys = new Set<string>();
      let contactOnlyCellCount = 0;

      for (const cell of candidateCellsResult.solidCells) {
        const blockAabb = this.reader?.getBlockingBounds
          ? this.reader.getBlockingBounds(cell.cell, safeAabb)
          : createBlockAabb(cell.cell.x, cell.cell.y, cell.cell.z);
        if (!blockAabb) continue;

        /**
         * A cell-range query is intentionally coarse. At exact voxel faces or
         * after tiny floating-point drift it can include a floor/neighbor cell
         * that does not meaningfully penetrate the player AABB. Filtering by
         * actual AABB overlap prevents floor contact from being reinterpreted
         * as an X/Z wall.
         */
        if (
          aabbIntersects(
            safeAabb,
            blockAabb,
            this.config.contactEpsilon,
          )
        ) {
          const key = cellRefToKey(cell.cell);

          if (!blockingKeys.has(key)) {
            blockingKeys.add(key);
            blockingCells.push(cell);
            blockingAabbs.push(blockAabb);
          }
        } else {
          contactOnlyCellCount += 1;
        }
      }

      const filteredCells = candidateCellsResult.cells.filter(
        (cell) =>
          !cell.solid ||
          blockingKeys.has(cellRefToKey(cell.cell)),
      );

      const cellsResult: BlockCollisionCellsResult = {
        ...candidateCellsResult,
        solidCellCount: blockingCells.length,
        cells: filteredCells,
        solidCells: blockingCells,
        trace: {
          ...candidateCellsResult.trace,
          solidCellCount: blockingCells.length,
        },
      };

      return {
        collides: blockingAabbs.length > 0,
        blockingAabbs,
        cellsResult,
        candidateSolidCellCount:
          candidateCellsResult.solidCells.length,
        contactOnlyCellCount,
      };
    } catch {
      this.readerFailureCount += 1;
      const warning = createWarning(
        "Blocking AABB query failed.",
      );
      this.recordWarnings([warning]);

      return {
        collides: true,
        blockingAabbs: [cloneAabb(aabb)],
        cellsResult: {
          ...EMPTY_BLOCK_COLLISION_CELLS_RESULT,
          solidCellCount: 1,
          missingCellCount: 1,
          trace: {
            checkedCellCount: 0,
            solidCellCount: 1,
            missingCellCount: 1,
            cells: [],
          },
          warnings: [warning],
        },
        candidateSolidCellCount: 1,
        contactOnlyCellCount: 0,
      };
    }
  }

  public getCellsForDebugRange(
    range: AabbCellRange,
    maxCells = 512,
  ): readonly CollisionCellRef[] {
    try {
      const safeMaxCells = Math.max(1, Math.floor(sanitizePhysicsNumber(maxCells, 512)));
      const result = this.getCollisionCellsForRange(range, {
        includeAirCells: true,
        includeTraceCells: true,
        maxCells: safeMaxCells,
      });

      return result.cells.map((cell) => createCollisionCellRef(cell.cell, cell));
    } catch {
      return [];
    }
  }

  public collectRawCellRefsForAabb(
    aabb: PhysicsAabb,
    maxCells = 512,
  ): readonly AabbCellRef[] {
    try {
      return collectCellsInAabbRange(getAabbCellRange(aabb), maxCells);
    } catch {
      return [];
    }
  }

  public snapshot(): BlockCollisionQuerySnapshot {
    try {
      return {
        config: { ...this.config },
        readerAvailable: Boolean(
          this.reader &&
          typeof this.reader.getCollisionCell === "function"
        ),
        readerSourceName: this.reader?.sourceName ?? "unknown",
        lastWarnings: [...this.lastWarnings],
        queryCount: this.queryCount,
        readerFailureCount: this.readerFailureCount,
        loadedHintMismatchCount: this.loadedHintMismatchCount,
        canonicalAirCorrectionCount: this.canonicalAirCorrectionCount,
        canonicalSolidCorrectionCount: this.canonicalSolidCorrectionCount,
        revision: this.revision,
      };
    } catch {
      return {
        config: createBlockCollisionQueryConfig(),
        readerAvailable: false,
        readerSourceName: "unknown",
        lastWarnings: [],
        queryCount: 0,
        readerFailureCount: 0,
        loadedHintMismatchCount: 0,
        canonicalAirCorrectionCount: 0,
        canonicalSolidCorrectionCount: 0,
        revision: 0,
      };
    }
  }

  private recordWarnings(warnings: readonly string[]): void {
    try {
      if (!Array.isArray(warnings) || warnings.length === 0) {
        return;
      }

      const merged = [
        ...this.lastWarnings,
        ...warnings
          .map((warning) => createWarning(warning))
          .filter((warning) => warning.length > 0),
      ];

      this.lastWarnings = Array.from(new Set(merged)).slice(-32);
    } catch {
      this.lastWarnings = [];
    }
  }

  private recordCellDiagnostics(
    result: BlockCollisionQueryCellResult,
  ): void {
    try {
      const diagnostics = result.diagnostics;

      if (!diagnostics) {
        return;
      }

      if (diagnostics.loadedHintMismatch) {
        this.loadedHintMismatchCount += 1;
      }

      if (diagnostics.normalizedAirSolidConflict) {
        this.canonicalAirCorrectionCount += 1;
      }

      if (diagnostics.normalizedSolidKindConflict) {
        this.canonicalSolidCorrectionCount += 1;
      }

      this.recordWarnings(diagnostics.warnings);
    } catch {
      // Diagnostics must never change collision behavior.
    }
  }

  private createTrace(params: {
    readonly checkedCellCount: number;
    readonly solidCellCount: number;
    readonly missingCellCount: number;
    readonly cells: readonly BlockCollisionQueryCellResult[];
    readonly includeCells: boolean;
  }): CollisionTrace {
    try {
      return {
        checkedCellCount: Math.max(0, Math.floor(params.checkedCellCount)),
        solidCellCount: Math.max(0, Math.floor(params.solidCellCount)),
        missingCellCount: Math.max(0, Math.floor(params.missingCellCount)),
        cells: params.includeCells
          ? params.cells.map((cell) => createCollisionCellRef(cell.cell, cell))
          : undefined,
      };
    } catch {
      return {
        checkedCellCount: 0,
        solidCellCount: 0,
        missingCellCount: 0,
        cells: params.includeCells ? [] : undefined,
      };
    }
  }
}

export function createBlockCollisionQuery(
  reader: BlockCollisionWorldReader | null | undefined = null,
  config: BlockCollisionQueryConfigPatch | null | undefined = undefined,
): BlockCollisionQuery {
  try {
    return new BlockCollisionQuery(reader, config);
  } catch {
    return new BlockCollisionQuery(null, undefined);
  }
}

export function createStaticBlockCollisionReader(
  solidCells: Iterable<AabbCellRef> | null | undefined,
  options: {
    readonly sourceName?: string;
    readonly defaultLoaded?: boolean;
  } = {},
): BlockCollisionWorldReader {
  try {
    const solidKeys = new Set<string>();

    for (const cell of solidCells ?? []) {
      solidKeys.add(cellRefToKey(cell));
    }

    const sourceName = sanitizePhysicsString(options.sourceName, "static-collision-reader");
    const defaultLoaded = sanitizePhysicsBoolean(options.defaultLoaded, true);

    return {
      sourceName,
      isCellLoaded: () => defaultLoaded,
      getCollisionCell: (cell) => {
        const key = cellRefToKey(cell);

        if (solidKeys.has(key)) {
          return {
            kind: "solid",
            loaded: true,
            solid: true,
            blockTypeId: "static_solid",
            source: sourceName,
          };
        }

        return {
          kind: "air",
          loaded: defaultLoaded,
          solid: false,
          blockTypeId: null,
          source: sourceName,
        };
      },
    };
  } catch {
    return {
      sourceName: "static-collision-reader-fallback",
      getCollisionCell: () => ({
        kind: "unknown",
        loaded: false,
        solid: true,
        policy: "block",
        missingReason: "reader_failed",
      }),
    };
  }
}

export function createEmptyBlockCollisionReader(
  options: {
    readonly sourceName?: string;
    readonly loaded?: boolean;
  } = {},
): BlockCollisionWorldReader {
  try {
    const sourceName = sanitizePhysicsString(options.sourceName, "empty-collision-reader");
    const loaded = sanitizePhysicsBoolean(options.loaded, true);

    return {
      sourceName,
      isCellLoaded: () => loaded,
      getCollisionCell: () => ({
        kind: loaded ? "air" : "unknown",
        loaded,
        solid: !loaded,
        blockTypeId: null,
        policy: loaded ? undefined : "block",
        missingReason: loaded ? null : "chunk_missing",
        source: sourceName,
      }),
    };
  } catch {
    return {
      sourceName: "empty-collision-reader-fallback",
      getCollisionCell: () => ({
        kind: "air",
        loaded: true,
        solid: false,
      }),
    };
  }
}
