/** Immutable source facets; relative slope edits use the existing WorldEdit roof contract. */
export interface ImportedRoofSource {
  readonly schemaVersion: "lod2-roof-source.v1";
  readonly buildingId: string;
  readonly sourceSha256: string;
  readonly sourceTile: string;
  readonly baseY: number;
  readonly referencePitchDeg: number;
  readonly footprint: readonly (readonly (readonly number[])[])[];
  /** Classified GroundSurface rings in world X/Z; exterior first, holes after. */
  readonly groundFootprints?: readonly (readonly (readonly (readonly number[])[])[])[];
  readonly faces: readonly { readonly face_ref: string; readonly polygon_3d_mm: readonly (readonly number[])[] }[];
  readonly facadeSegments?: readonly {
    readonly start: readonly [number, number];
    readonly end: readonly [number, number];
    readonly minimumY: number;
    readonly maximumY: number;
  }[];
}

export function importedRoofSource(value: unknown): ImportedRoofSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as ImportedRoofSource;
  if (source.schemaVersion !== "lod2-roof-source.v1"
    || !Number.isFinite(source.baseY) || !Number.isFinite(source.referencePitchDeg)
    || source.referencePitchDeg < 0 || source.referencePitchDeg > 80
    || !Array.isArray(source.faces) || !source.faces.length || source.faces.length > 8192
    || !Array.isArray(source.footprint) || !source.footprint.length) return undefined;
  if (!source.faces.every((face) => face && Array.isArray(face.polygon_3d_mm) && face.polygon_3d_mm.length === 3
    && face.polygon_3d_mm.every((point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite)))) return undefined;
  if (!source.footprint.every((ring) => Array.isArray(ring) && ring.length >= 4
    && ring.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))) return undefined;
  if (source.facadeSegments !== undefined && (!Array.isArray(source.facadeSegments)
    || !source.facadeSegments.every((segment) => Array.isArray(segment?.start) && Array.isArray(segment?.end)
      && segment.start.length === 2 && segment.end.length === 2
      && segment.start.every(Number.isFinite) && segment.end.every(Number.isFinite)
      && Number.isFinite(segment.minimumY) && Number.isFinite(segment.maximumY)
      && segment.maximumY > segment.minimumY))) return undefined;
  if (source.groundFootprints !== undefined && (!Array.isArray(source.groundFootprints)
    || !source.groundFootprints.every((footprint) => Array.isArray(footprint) && footprint.length > 0
      && footprint.every((ring) => Array.isArray(ring) && ring.length >= 4
        && ring.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))))) return undefined;
  return source;
}

function sameOutline(left: readonly (readonly number[])[], right: readonly (readonly number[])[]): boolean {
  const open = (ring: readonly (readonly number[])[]) => ring.length > 1
    && Math.hypot(ring[0]![0]! - ring.at(-1)![0]!, ring[0]![1]! - ring.at(-1)![1]!) < .01 ? ring.slice(0, -1) : ring;
  const a = open(left), b = open(right);
  return a.length === b.length && a.every((p, i) => Math.hypot(p[0]! - b[i]![0]!, p[1]! - b[i]![1]!) < .01);
}

type PlanPointMm = readonly [number, number];

function openRingMm(value: readonly (readonly number[])[]): PlanPointMm[] {
  const points = value.map((point) => [Number(point[0]), Number(point[1])] as const);
  if (points.length > 1 && Math.hypot(
    points[0]![0] - points.at(-1)![0],
    points[0]![1] - points.at(-1)![1],
  ) < .01) points.pop();
  return points;
}

function ringAreaMm(ring: readonly PlanPointMm[]): number {
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length]!;
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function offsetRingMm(ring: readonly PlanPointMm[], distanceMm: number, openSide: 1 | -1): PlanPointMm[] {
  if (distanceMm <= 0 || ring.length < 3) return [...ring];
  const result: PlanPointMm[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const previous = ring[(index + ring.length - 1) % ring.length]!;
    const current = ring[index]!;
    const next = ring[(index + 1) % ring.length]!;
    const previousLength = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    const nextLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    if (previousLength < 1e-6 || nextLength < 1e-6) {
      result.push(current);
      continue;
    }
    const previousDirection: PlanPointMm = [
      (current[0] - previous[0]) / previousLength,
      (current[1] - previous[1]) / previousLength,
    ];
    const nextDirection: PlanPointMm = [
      (next[0] - current[0]) / nextLength,
      (next[1] - current[1]) / nextLength,
    ];
    // `openSide` is derived from ring role and winding, so the offset always
    // extends toward open space for both exterior edges and courtyard holes.
    const previousOrigin: PlanPointMm = [
      current[0] + previousDirection[1] * distanceMm * openSide,
      current[1] - previousDirection[0] * distanceMm * openSide,
    ];
    const nextOrigin: PlanPointMm = [
      current[0] + nextDirection[1] * distanceMm * openSide,
      current[1] - nextDirection[0] * distanceMm * openSide,
    ];
    const denominator = previousDirection[0] * nextDirection[1]
      - previousDirection[1] * nextDirection[0];
    let candidate: PlanPointMm;
    if (Math.abs(denominator) < 1e-9) {
      candidate = [(previousOrigin[0] + nextOrigin[0]) / 2, (previousOrigin[1] + nextOrigin[1]) / 2];
    } else {
      const deltaX = nextOrigin[0] - previousOrigin[0];
      const deltaZ = nextOrigin[1] - previousOrigin[1];
      const factor = (deltaX * nextDirection[1] - deltaZ * nextDirection[0]) / denominator;
      candidate = [
        previousOrigin[0] + previousDirection[0] * factor,
        previousOrigin[1] + previousDirection[1] * factor,
      ];
    }
    // Very acute source corners can otherwise create kilometre-long mitres.
    // A four-times-overhang cap remains an obvious roof extension while
    // keeping the editable geometry finite and local to the building.
    const maximumMiter = Math.max(distanceMm, distanceMm * 4);
    const miterDistance = Math.hypot(candidate[0] - current[0], candidate[1] - current[1]);
    if (miterDistance > maximumMiter + 1e-6) {
      const scale = maximumMiter / miterDistance;
      candidate = [
        current[0] + (candidate[0] - current[0]) * scale,
        current[1] + (candidate[1] - current[1]) * scale,
      ];
    }
    result.push(candidate);
  }
  return result;
}

function pointOnSegmentMm(point: PlanPointMm, start: PlanPointMm, end: PlanPointMm): number | null {
  const dx = end[0] - start[0], dz = end[1] - start[1];
  const squared = dx * dx + dz * dz;
  if (squared < 1e-9) return null;
  const factor = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared;
  if (factor < -1e-7 || factor > 1 + 1e-7) return null;
  const x = start[0] + dx * factor, z = start[1] + dz * factor;
  return Math.hypot(point[0] - x, point[1] - z) <= .5 ? Math.max(0, Math.min(1, factor)) : null;
}

function extendBoundaryPointMm(
  point: PlanPointMm,
  rings: readonly PlanPointMm[][],
  offsetRings: readonly PlanPointMm[][],
  openSides: readonly (1 | -1)[],
  distanceMm: number,
): PlanPointMm {
  if (distanceMm <= 0) return point;
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex]!, offset = offsetRings[ringIndex]!;
    for (let vertex = 0; vertex < ring.length; vertex += 1) {
      if (Math.hypot(point[0] - ring[vertex]![0], point[1] - ring[vertex]![1]) <= .5) {
        return offset[vertex]!;
      }
    }
    for (let edge = 0; edge < ring.length; edge += 1) {
      const start = ring[edge]!, end = ring[(edge + 1) % ring.length]!;
      const factor = pointOnSegmentMm(point, start, end);
      if (factor === null) continue;
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      const openSide = openSides[ringIndex] ?? 1;
      return [
        point[0] + (end[1] - start[1]) / length * distanceMm * openSide,
        point[1] - (end[0] - start[0]) / length * distanceMm * openSide,
      ];
    }
  }
  return point;
}

function heightOnFaceMm(
  source: readonly (readonly number[])[],
  point: PlanPointMm,
  eavesMm: number,
  baseMm: number,
  pitchScale: number,
): number {
  const transformed = source.map((value) => [
    Number(value[0]),
    Number(value[1]),
    eavesMm + (Number(value[2]) - baseMm) * pitchScale,
  ] as const);
  const [first, second, third] = transformed;
  if (!first || !second || !third) return eavesMm;
  const dx1 = second[0] - first[0], dz1 = second[1] - first[1];
  const dx2 = third[0] - first[0], dz2 = third[1] - first[1];
  const determinant = dx1 * dz2 - dx2 * dz1;
  if (Math.abs(determinant) < 1e-9) return first[2];
  const dy1 = second[2] - first[2], dy2 = third[2] - first[2];
  const slopeX = (dy1 * dz2 - dy2 * dz1) / determinant;
  const slopeZ = (dx1 * dy2 - dx2 * dy1) / determinant;
  return first[2] + slopeX * (point[0] - first[0]) + slopeZ * (point[1] - first[1]);
}

export function calculateImportedRoof(request: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const parameters = request.parameters as Readonly<Record<string, unknown>>;
  const source = importedRoofSource(parameters?.imported_source);
  if (!source) throw new Error("Keine gültigen LoD2-Originalflächen für dieses Dach vorhanden.");
  const footprint = request.footprint as { outer_ring_mm?: readonly (readonly number[])[] };
  const sourceOutline = source.footprint[0]!.map((p) => [p[0]! * 1000, p[1]! * 1000]);
  if (!sameOutline(footprint?.outer_ring_mm ?? [], sourceOutline)) {
    throw new Error("Für einen neuen Dachumriss zuerst eine parametrische Dachform wählen. LoD2-Original erhält seinen Umriss.");
  }
  const pitch = Number(parameters.pitch_deg), eaves = Number(parameters.eaves_height_mm);
  if (!Number.isFinite(pitch) || pitch < 0 || pitch > 80 || !Number.isFinite(eaves)) throw new Error("Ungültige LoD2-Dachparameter.");
  const scale = source.referencePitchDeg > 0
    ? Math.tan(pitch * Math.PI / 180) / Math.tan(source.referencePitchDeg * Math.PI / 180) : 1;
  if (!source.referencePitchDeg && pitch !== 0) throw new Error("Für eine Neigung auf einem flachen Originaldach bitte Pult- oder Satteldach wählen.");
  const overhang = parameters.overhang_mm as Readonly<Record<string, unknown>>;
  const overhangMm = Number(overhang?.default_mm ?? 0);
  if (!Number.isFinite(overhangMm) || overhangMm < 0 || overhangMm > 5000) {
    throw new Error("Ungültiger Dachüberstand für das LoD2-Original.");
  }
  const rings = source.footprint.map((ring) => openRingMm(ring.map((point) => [point[0]! * 1000, point[1]! * 1000])));
  const openSides = rings.map((ring, index): 1 | -1 => ((index === 0) === (ringAreaMm(ring) > 0) ? 1 : -1));
  const offsetRings = rings.map((ring, index) => offsetRingMm(ring, overhangMm, openSides[index]!));
  const faces = source.faces.map((face) => ({ ...face, polygon_3d_mm: face.polygon_3d_mm.map((p) => {
    const plan = extendBoundaryPointMm([p[0]!, p[1]!], rings, offsetRings, openSides, overhangMm);
    return [p[0] === plan[0] ? p[0] : plan[0], p[1] === plan[1] ? p[1] : plan[1],
      heightOnFaceMm(face.polygon_3d_mm, plan, eaves, source.baseY * 1000, scale)];
  }) }));
  const maximum = Math.max(...faces.flatMap((face) => face.polygon_3d_mm.map((p) => Number(p[2]))));
  const fingerprint = `lod2:${source.sourceSha256}:${source.buildingId}:${source.faces[0]!.face_ref}:${eaves}:${pitch}:${overhangMm}`;
  return { ok: true, contract_version: "cad-roof-calculation-result/0.1", roof_type: "imported",
    calculation_id: fingerprint, input_fingerprint: fingerprint,
    source: "lod2-original-surfaces", normalized_request: request, geometry: { faces },
    structure: { rafters: [], purlins: [], source: "not-provided-by-lod2" },
    summary: { face_count: faces.length, maximum_height_mm: maximum, rafter_count: 0, purlin_count: 0 } };
}
