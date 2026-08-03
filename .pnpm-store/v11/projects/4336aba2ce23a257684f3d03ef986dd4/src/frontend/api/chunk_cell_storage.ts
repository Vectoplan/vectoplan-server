// services/vectoplan-editor/src/frontend/api/chunk_cell_storage.ts

/**
 * A chunk still behaves like a readonly number[] to existing callers, but the
 * backing store only keeps contiguous non-air spans. Numeric access is served
 * by a proxy, so collision and targeting code can continue to use cells[index]
 * without materializing thousands of zeroes.
 */

export interface ChunkCellSpan {
  readonly start: number;
  readonly end: number;
  readonly value: number;
}

export interface ChunkCellStorageInfo {
  readonly kind: "non-air-spans.v1" | "dense-array";
  readonly cellCount: number;
  readonly nonAirCellCount: number;
  readonly airCellCount: number;
  readonly spanCount: number;
}

interface ChunkCellSpanStorage {
  readonly cellCount: number;
  readonly starts: Uint32Array;
  readonly ends: Uint32Array;
  readonly values: readonly number[];
  readonly nonAirCellCount: number;
}

const AIR_CELL_VALUE = 0;
const MAX_ARRAY_INDEX = 4_294_967_294;
const storageByCells = new WeakMap<readonly number[], ChunkCellSpanStorage>();

function numericArrayIndex(property: PropertyKey): number | null {
  if (typeof property !== "string" || property.length === 0) {
    return null;
  }

  const numeric = Number(property);
  if (
    !Number.isInteger(numeric)
    || numeric < 0
    || numeric > MAX_ARRAY_INDEX
    || String(numeric) !== property
  ) {
    return null;
  }

  return numeric;
}

function readStoredCell(storage: ChunkCellSpanStorage, index: number): number {
  if (index < 0 || index >= storage.cellCount || storage.starts.length === 0) {
    return AIR_CELL_VALUE;
  }

  let low = 0;
  let high = storage.starts.length - 1;

  while (low <= high) {
    const middle = (low + high) >>> 1;
    const start = storage.starts[middle];
    const end = storage.ends[middle];

    if (index < start) {
      high = middle - 1;
    } else if (index >= end) {
      low = middle + 1;
    } else {
      return storage.values[middle] ?? AIR_CELL_VALUE;
    }
  }

  return AIR_CELL_VALUE;
}

function createCellIterator(storage: ChunkCellSpanStorage): IterableIterator<number> {
  let index = 0;
  let spanIndex = 0;

  return {
    next(): IteratorResult<number> {
      if (index >= storage.cellCount) {
        return { done: true, value: undefined };
      }

      while (spanIndex < storage.starts.length && index >= storage.ends[spanIndex]) {
        spanIndex += 1;
      }

      const value = spanIndex < storage.starts.length
        && index >= storage.starts[spanIndex]
        && index < storage.ends[spanIndex]
        ? storage.values[spanIndex] ?? AIR_CELL_VALUE
        : AIR_CELL_VALUE;

      index += 1;
      return { done: false, value };
    },
    [Symbol.iterator](): IterableIterator<number> {
      return this;
    },
  };
}

function normalizeSpans(
  cellCount: number,
  spans: readonly ChunkCellSpan[],
): ChunkCellSpanStorage {
  const normalized: ChunkCellSpan[] = [];

  for (const span of spans) {
    const start = Math.max(0, Math.min(cellCount, Math.trunc(span.start)));
    const end = Math.max(start, Math.min(cellCount, Math.trunc(span.end)));
    const value = Number.isSafeInteger(span.value) ? span.value : AIR_CELL_VALUE;

    if (value === AIR_CELL_VALUE || start >= end) {
      continue;
    }

    const previous = normalized[normalized.length - 1];
    if (previous && start < previous.end) {
      throw new RangeError("Chunk cell spans must be sorted and must not overlap.");
    }

    if (previous && start === previous.end && value === previous.value) {
      normalized[normalized.length - 1] = {
        start: previous.start,
        end,
        value,
      };
      continue;
    }

    normalized.push({ start, end, value });
  }

  const starts = new Uint32Array(normalized.length);
  const ends = new Uint32Array(normalized.length);
  const values: number[] = new Array(normalized.length);
  let nonAirCellCount = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const span = normalized[index];
    starts[index] = span.start;
    ends[index] = span.end;
    values[index] = span.value;
    nonAirCellCount += span.end - span.start;
  }

  return {
    cellCount,
    starts,
    ends,
    values,
    nonAirCellCount,
  };
}

function createProxyCells(storage: ChunkCellSpanStorage): readonly number[] {
  const target: number[] = [];

  const cells = new Proxy(target, {
    get(array, property, receiver) {
      if (property === "length") {
        return storage.cellCount;
      }

      if (property === Symbol.iterator) {
        return () => createCellIterator(storage);
      }

      const index = numericArrayIndex(property);
      if (index !== null) {
        return readStoredCell(storage, index);
      }

      return Reflect.get(array, property, receiver);
    },
    has(array, property) {
      const index = numericArrayIndex(property);
      if (index !== null) {
        return index < storage.cellCount;
      }

      return Reflect.has(array, property);
    },
    set() {
      return false;
    },
    deleteProperty() {
      return false;
    },
  }) as readonly number[];

  storageByCells.set(cells, storage);
  return cells;
}

export function createChunkCellsFromSpans(
  cellCount: number,
  spans: readonly ChunkCellSpan[],
): readonly number[] {
  const normalizedCellCount = Math.max(0, Math.min(MAX_ARRAY_INDEX, Math.trunc(cellCount)));
  return createProxyCells(normalizeSpans(normalizedCellCount, spans));
}

export function createChunkCellsFromRuns(
  cellCount: number,
  runs: readonly number[],
): readonly number[] {
  const normalizedCellCount = Math.max(0, Math.min(MAX_ARRAY_INDEX, Math.trunc(cellCount)));
  const spans: ChunkCellSpan[] = [];
  let cursor = 0;

  for (let index = 0; index + 1 < runs.length && cursor < normalizedCellCount; index += 2) {
    const value = runs[index] ?? AIR_CELL_VALUE;
    const count = Math.max(0, Math.trunc(runs[index + 1] ?? 0));
    const end = Math.min(normalizedCellCount, cursor + count);

    if (value !== AIR_CELL_VALUE && cursor < end) {
      spans.push({ start: cursor, end, value });
    }

    cursor = end;
  }

  if (cursor !== normalizedCellCount) {
    throw new RangeError(`Chunk cell run length mismatch. Expected ${normalizedCellCount}, received ${cursor}.`);
  }

  return createChunkCellsFromSpans(normalizedCellCount, spans);
}

export function createChunkCellsFromValues(
  values: ArrayLike<unknown>,
  cellCount: number,
  normalizeValue: (value: unknown) => number,
): readonly number[] {
  const normalizedCellCount = Math.max(0, Math.min(MAX_ARRAY_INDEX, Math.trunc(cellCount)));
  const spans: ChunkCellSpan[] = [];
  let spanStart = -1;
  let spanValue = AIR_CELL_VALUE;

  for (let index = 0; index < normalizedCellCount; index += 1) {
    const value = normalizeValue(values[index]);

    if (value === AIR_CELL_VALUE) {
      if (spanStart >= 0) {
        spans.push({ start: spanStart, end: index, value: spanValue });
        spanStart = -1;
      }
      continue;
    }

    if (spanStart >= 0 && value !== spanValue) {
      spans.push({ start: spanStart, end: index, value: spanValue });
      spanStart = index;
    } else if (spanStart < 0) {
      spanStart = index;
    }

    spanValue = value;
  }

  if (spanStart >= 0) {
    spans.push({ start: spanStart, end: normalizedCellCount, value: spanValue });
  }

  return createChunkCellsFromSpans(normalizedCellCount, spans);
}

export function isCompressedChunkCells(cells: unknown): cells is readonly number[] {
  return Array.isArray(cells) && storageByCells.has(cells);
}

export function getChunkCellValue(cells: readonly number[], index: number): number {
  const storage = storageByCells.get(cells);
  if (storage) {
    return readStoredCell(storage, index);
  }

  return cells[index] ?? AIR_CELL_VALUE;
}

export function forEachNonAirCellSpan(
  cells: readonly number[],
  callback: (start: number, end: number, value: number) => void,
): void {
  const storage = storageByCells.get(cells);
  if (storage) {
    for (let index = 0; index < storage.starts.length; index += 1) {
      callback(storage.starts[index], storage.ends[index], storage.values[index] ?? AIR_CELL_VALUE);
    }
    return;
  }

  let spanStart = -1;
  let spanValue = AIR_CELL_VALUE;
  for (let index = 0; index < cells.length; index += 1) {
    const value = cells[index] ?? AIR_CELL_VALUE;
    if (value === AIR_CELL_VALUE) {
      if (spanStart >= 0) {
        callback(spanStart, index, spanValue);
        spanStart = -1;
      }
    } else if (spanStart >= 0 && value !== spanValue) {
      callback(spanStart, index, spanValue);
      spanStart = index;
      spanValue = value;
    } else if (spanStart < 0) {
      spanStart = index;
      spanValue = value;
    }
  }

  if (spanStart >= 0) {
    callback(spanStart, cells.length, spanValue);
  }
}

export function getChunkCellStorageInfo(cells: readonly number[]): ChunkCellStorageInfo {
  const storage = storageByCells.get(cells);
  if (storage) {
    return {
      kind: "non-air-spans.v1",
      cellCount: storage.cellCount,
      nonAirCellCount: storage.nonAirCellCount,
      airCellCount: Math.max(0, storage.cellCount - storage.nonAirCellCount),
      spanCount: storage.starts.length,
    };
  }

  let nonAirCellCount = 0;
  let spanCount = 0;
  forEachNonAirCellSpan(cells, (start, end) => {
    nonAirCellCount += end - start;
    spanCount += 1;
  });

  return {
    kind: "dense-array",
    cellCount: cells.length,
    nonAirCellCount,
    airCellCount: Math.max(0, cells.length - nonAirCellCount),
    spanCount,
  };
}

export function cloneChunkCellsWithValue(
  cells: readonly number[],
  cellIndex: number,
  nextValue: number,
): readonly number[] {
  if (cellIndex < 0 || cellIndex >= cells.length) {
    return cells;
  }

  const currentValue = getChunkCellValue(cells, cellIndex);
  if (currentValue === nextValue) {
    return cells;
  }

  const spans: ChunkCellSpan[] = [];
  let inserted = false;

  forEachNonAirCellSpan(cells, (start, end, value) => {
    if (!inserted && cellIndex < start) {
      if (nextValue !== AIR_CELL_VALUE) {
        spans.push({ start: cellIndex, end: cellIndex + 1, value: nextValue });
      }
      inserted = true;
    }

    if (cellIndex < start || cellIndex >= end) {
      spans.push({ start, end, value });
      return;
    }

    if (start < cellIndex) {
      spans.push({ start, end: cellIndex, value });
    }
    if (nextValue !== AIR_CELL_VALUE) {
      spans.push({ start: cellIndex, end: cellIndex + 1, value: nextValue });
    }
    if (cellIndex + 1 < end) {
      spans.push({ start: cellIndex + 1, end, value });
    }
    inserted = true;
  });

  if (!inserted && nextValue !== AIR_CELL_VALUE) {
    spans.push({ start: cellIndex, end: cellIndex + 1, value: nextValue });
  }

  return createChunkCellsFromSpans(cells.length, spans);
}
