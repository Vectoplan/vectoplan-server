import type { Lod2BuildingGridReference } from "./building_reference";
import {
  intersectConvexParcelGridPolygons,
  mergeParcelGridCoverage,
  parcelGridPolygonArea,
  unionParcelGridCoverage,
  type ParcelGridPartitionResult,
  type ParcelGridPoint,
} from "./geometry";

export type ParcelGridAuditStatus = "pass" | "warning" | "error";

export interface ParcelGridAuditIssue {
  readonly code:
    | "facade-axis-drift"
    | "facade-anchor-drift"
    | "facade-line-gap"
    | "partial-facade-cell"
    | "invalid-building-basis"
    | "building-overlap"
    | "parcel-coverage-gap";
  readonly severity: Exclude<ParcelGridAuditStatus, "pass">;
  readonly measured: number;
  readonly limit: number;
  readonly subjectId?: string;
  readonly message?: string;
}

export interface ParcelGridFacadeAudit {
  readonly facadeId:string;
  readonly start:ParcelGridPoint;
  readonly end:ParcelGridPoint;
  readonly lengthM:number;
  readonly axisErrorDegrees:number;
  readonly anchorOffsetM:number;
  readonly expectedExposedLengthM:number;
  readonly coverageRatio:number;
  readonly maximumGapM:number;
  readonly partialCellCount:number;
}

export interface ParcelGridAuditReport {
  readonly schemaVersion: "vectoplan-parcel-grid-audit.v3";
  readonly status: ParcelGridAuditStatus;
  readonly buildingId: string;
  readonly facadeCount: number;
  readonly basisAngleDegrees: number;
  readonly weightedFacadeAxisErrorDegrees: number;
  readonly p95FacadeAxisErrorDegrees: number;
  readonly p95FacadeAnchorOffsetM: number;
  readonly maximumFacadeAnchorOffsetM: number;
  readonly buildingOverlapAreaM2: number;
  readonly minimumFacadeCoverageRatio: number;
  readonly maximumFacadeLineGapM: number;
  readonly partialFacadeCellCount: number;
  readonly expectedBuildableAreaM2: number | null;
  readonly uncoveredBuildableAreaM2: number;
  readonly facades:readonly ParcelGridFacadeAudit[];
  readonly issues: readonly ParcelGridAuditIssue[];
}

const degrees = (value: number): number => value * 180 / Math.PI;
const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

function basisCoordinates(
  point: ParcelGridPoint,
  axisU: ParcelGridPoint,
  axisV: ParcelGridPoint,
): ParcelGridPoint | null {
  const determinant = axisU[0] * axisV[1] - axisU[1] * axisV[0];
  if (Math.abs(determinant) < 1e-7) return null;
  return [
    (point[0] * axisV[1] - point[1] * axisV[0]) / determinant,
    (axisU[0] * point[1] - axisU[1] * point[0]) / determinant,
  ];
}

function nearestDistance(value: number, anchors: readonly number[]): number {
  return anchors.length > 0
    ? Math.min(...anchors.map((anchor) => Math.abs(anchor - value)))
    : Number.POSITIVE_INFINITY;
}

function percentileByLength(
  values: readonly Readonly<{ value: number; length: number }>[],
  percentile: number,
): number {
  const sorted = [...values].sort((first, second) => first.value - second.value);
  const total = sorted.reduce((sum, entry) => sum + entry.length, 0);
  if (total <= 1e-9) return 0;
  const target = total * clamp(percentile, 0, 1);
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.length;
    if (cumulative >= target) return entry.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

function bounds(polygon: readonly ParcelGridPoint[]): readonly [number, number, number, number] {
  return [
    Math.min(...polygon.map((point) => point[0])),
    Math.max(...polygon.map((point) => point[0])),
    Math.min(...polygon.map((point) => point[1])),
    Math.max(...polygon.map((point) => point[1])),
  ];
}

function boundsOverlap(
  first: readonly [number, number, number, number],
  second: readonly [number, number, number, number],
): boolean {
  return first[1] >= second[0] && second[1] >= first[0]
    && first[3] >= second[2] && second[3] >= first[2];
}

type LineInterval=readonly [number,number];

function mergeIntervals(intervals:readonly LineInterval[]):LineInterval[] {
  const sorted=[...intervals].filter((interval)=>interval[1]-interval[0]>1e-7)
    .sort((first,second)=>first[0]-second[0]||first[1]-second[1]);
  const result:LineInterval[]=[];
  for(const interval of sorted){
    const previous=result.at(-1);
    if(!previous||interval[0]>previous[1]+1e-5)result.push(interval);
    else result[result.length-1]=[previous[0],Math.max(previous[1],interval[1])];
  }
  return result;
}

function mergedIntervalsLength(intervals:readonly LineInterval[]):number {
  return mergeIntervals(intervals).reduce((sum,interval)=>sum+interval[1]-interval[0],0);
}

function subtractIntervals(subjects:readonly LineInterval[],cutters:readonly LineInterval[]):LineInterval[] {
  let result=mergeIntervals(subjects);
  for(const cutter of mergeIntervals(cutters))result=result.flatMap((subject):LineInterval[]=>{
    if(cutter[1]<=subject[0]+1e-7||cutter[0]>=subject[1]-1e-7)return [subject];
    const pieces:LineInterval[]=[];
    if(cutter[0]>subject[0]+1e-7)pieces.push([subject[0],Math.min(subject[1],cutter[0])]);
    if(cutter[1]<subject[1]-1e-7)pieces.push([Math.max(subject[0],cutter[1]),subject[1]]);
    return pieces;
  });
  return mergeIntervals(result);
}

function intersectIntervals(first:readonly LineInterval[],second:readonly LineInterval[]):LineInterval[] {
  const result:LineInterval[]=[];
  for(const a of mergeIntervals(first))for(const b of mergeIntervals(second)){
    const start=Math.max(a[0],b[0]),end=Math.min(a[1],b[1]);
    if(end-start>1e-7)result.push([start,end]);
  }
  return mergeIntervals(result);
}

function pointInPolygon(point:ParcelGridPoint,polygon:readonly ParcelGridPoint[]):boolean {
  let inside=false;
  for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){
    const a=polygon[index]!,b=polygon[previous]!;
    if(((a[1]>point[1])!==(b[1]>point[1]))
      && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

/** Exact intervals of a test segment covered by a polygon. The test line is
 * offset two centimetres outside the wall, avoiding ambiguous collinear
 * intersections with the building exclusion boundary itself. */
function segmentPolygonIntervals(
  start:ParcelGridPoint,
  end:ParcelGridPoint,
  polygon:readonly ParcelGridPoint[],
):LineInterval[] {
  const dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz);
  if(length<1e-8||polygon.length<3)return [];
  const parameters=[0,1];
  for(let index=0;index<polygon.length;index+=1){
    const a=polygon[index]!,b=polygon[(index+1)%polygon.length]!;
    const ex=b[0]-a[0],ez=b[1]-a[1],denominator=dx*ez-dz*ex;
    if(Math.abs(denominator)<1e-10)continue;
    const qx=a[0]-start[0],qz=a[1]-start[1];
    const t=(qx*ez-qz*ex)/denominator,u=(qx*dz-qz*dx)/denominator;
    if(t>-1e-8&&t<1+1e-8&&u>-1e-8&&u<1+1e-8)parameters.push(clamp(t,0,1));
  }
  const ordered=[...new Set(parameters.map((value)=>Number(value.toFixed(10))))].sort((a,b)=>a-b);
  const result:LineInterval[]=[];
  for(let index=0;index<ordered.length-1;index+=1){
    const first=ordered[index]!,second=ordered[index+1]!;
    if(second-first<1e-9)continue;
    const middle=(first+second)/2;
    if(pointInPolygon([start[0]+dx*middle,start[1]+dz*middle],polygon))result.push([first*length,second*length]);
  }
  return mergeIntervals(result);
}

function facadePartitionMetric(
  reference:Lod2BuildingGridReference,
  facade:Lod2BuildingGridReference["facades"][number],
  partition:ParcelGridPartitionResult|null|undefined,
  coverageTriangles:readonly (readonly ParcelGridPoint[])[],
  excludedTriangles:readonly (readonly ParcelGridPoint[])[],
  facadeCells:ParcelGridPartitionResult["cells"],
):Readonly<{coverageRatio:number;maximumGapM:number;partialCells:number;expectedLengthM:number}> {
  const dx=facade.end[0]-facade.start[0],dz=facade.end[1]-facade.start[1];
  const length=Math.max(1e-9,Math.hypot(dx,dz)),ux=dx/length,uz=dz/length;
  const offsetX=-facade.inward[0]*.02,offsetZ=-facade.inward[1]*.02;
  const testStart:ParcelGridPoint=[facade.start[0]+offsetX,facade.start[1]+offsetZ];
  const testEnd:ParcelGridPoint=[facade.end[0]+offsetX,facade.end[1]+offsetZ];
  const parcelIntervals=mergeIntervals(coverageTriangles.flatMap((polygon)=>segmentPolygonIntervals(testStart,testEnd,polygon)));
  const excludedIntervals=mergeIntervals(excludedTriangles.flatMap((polygon)=>segmentPolygonIntervals(testStart,testEnd,polygon)));
  const expectedIntervals=subtractIntervals(parcelIntervals,excludedIntervals);
  const expectedLengthM=mergedIntervalsLength(expectedIntervals);
  const intervals:LineInterval[]=[];
  // Adjacent CityGML building objects can share the same physical wall. The
  // deterministic partition assigns an overlapping band to one owner only;
  // validate the measured line geometry, not that arbitrary object id.
  const matching=facadeCells;
  for(const cell of matching){
    for(let index=0;index<cell.polygon.length;index+=1){
      const start=cell.polygon[index]!,end=cell.polygon[(index+1)%cell.polygon.length]!;
      const edgeX=end[0]-start[0],edgeZ=end[1]-start[1],edgeLength=Math.hypot(edgeX,edgeZ);
      if(edgeLength<1e-7)continue;
      const alignment=Math.abs((edgeX*ux+edgeZ*uz)/edgeLength);
      const startDistance=Math.abs((start[0]-facade.start[0])*(-uz)+(start[1]-facade.start[1])*ux);
      const endDistance=Math.abs((end[0]-facade.start[0])*(-uz)+(end[1]-facade.start[1])*ux);
      if(alignment<Math.cos(.1*Math.PI/180)||Math.max(startDistance,endDistance)>.025)continue;
      const first=(start[0]-facade.start[0])*ux+(start[1]-facade.start[1])*uz;
      const second=(end[0]-facade.start[0])*ux+(end[1]-facade.start[1])*uz;
      const interval:LineInterval=[Math.max(0,Math.min(first,second)),Math.min(length,Math.max(first,second))];
      if(interval[1]-interval[0]>1e-7)intervals.push(interval);
    }
  }
  const coveredExpected=intersectIntervals(expectedIntervals,intervals);
  const gaps=subtractIntervals(expectedIntervals,coveredExpected);
  const maximumGapM=gaps.reduce((maximum,gap)=>Math.max(maximum,gap[1]-gap[0]),0);
  const columnWidth=length/facade.columns;
  let partialCells=0;
  for(let column=1;column<facade.columns-1;column+=1){
    const columnInterval:LineInterval=[column*columnWidth,(column+1)*columnWidth];
    const expectedColumnLength=mergedIntervalsLength(intersectIntervals(expectedIntervals,[columnInterval]));
    if(expectedColumnLength<columnWidth*.98)continue;
    const alongStart=column*columnWidth,alongEnd=(column+1)*columnWidth;
    const idealColumn:readonly ParcelGridPoint[]=[
      [facade.start[0]+ux*alongStart,facade.start[1]+uz*alongStart],
      [facade.start[0]+ux*alongEnd,facade.start[1]+uz*alongEnd],
      [facade.start[0]+ux*alongEnd-facade.inward[0],facade.start[1]+uz*alongEnd-facade.inward[1]],
      [facade.start[0]+ux*alongStart-facade.inward[0],facade.start[1]+uz*alongStart-facade.inward[1]],
    ];
    const availableCoverage=mergeParcelGridCoverage(coverageTriangles.map((triangle)=>(
      intersectConvexParcelGridPolygons(idealColumn,triangle)
    )).filter((polygon)=>parcelGridPolygonArea(polygon)>1e-8));
    // Both collections are already disjoint, so their pairwise intersections
    // are disjoint as well and can be summed directly.
    const unavailableCoverage=availableCoverage.flatMap((piece)=>(
      excludedTriangles.map((triangle)=>intersectConvexParcelGridPolygons(piece,triangle))
        .filter((polygon)=>parcelGridPolygonArea(polygon)>1e-8)
    ));
    const expectedColumnArea=availableCoverage.reduce((sum,piece)=>sum+parcelGridPolygonArea(piece),0)
      -unavailableCoverage.reduce((sum,piece)=>sum+parcelGridPolygonArea(piece),0);
    if(expectedColumnArea<columnWidth*.98)continue;
    const occupiedArea=matching.reduce((sum,cell)=>sum+parcelGridPolygonArea(
      intersectConvexParcelGridPolygons(idealColumn,cell.polygon),
    ),0);
    if(occupiedArea<expectedColumnArea*.98)partialCells+=1;
  }
  return {
    coverageRatio:expectedLengthM>1e-7?Math.min(1,mergedIntervalsLength(coveredExpected)/expectedLengthM):1,
    maximumGapM,
    partialCells,
    expectedLengthM,
  };
}

/**
 * Runtime and test invariant checker for an LoD2-aware parcel raster.
 * It deliberately measures geometry instead of trusting the selected mode:
 * a raster labelled `lod2-building` still fails when it drifts from facades
 * or leaves placeable area inside the existing building.
 */
export function auditParcelGrid(options: Readonly<{
  reference: Lod2BuildingGridReference;
  partition?: ParcelGridPartitionResult | null;
  coverageTriangles?: readonly (readonly ParcelGridPoint[])[];
  excludedTriangles?: readonly (readonly ParcelGridPoint[])[];
}>): ParcelGridAuditReport {
  const { reference } = options;
  const determinant = reference.axisU[0] * reference.axisV[1] - reference.axisU[1] * reference.axisV[0];
  const basisAngleDegrees = degrees(Math.acos(clamp(
    reference.axisU[0] * reference.axisV[0] + reference.axisU[1] * reference.axisV[1],
    -1,
    1,
  )));
  const facadeMetrics = reference.facades.map((facade) => {
    const dx = facade.end[0] - facade.start[0];
    const dz = facade.end[1] - facade.start[1];
    const length = Math.max(1e-9, Math.hypot(dx, dz));
    const direction: ParcelGridPoint = [dx / length, dz / length];
    const alignmentU = Math.abs(direction[0] * reference.axisU[0] + direction[1] * reference.axisU[1]);
    const alignmentV = Math.abs(direction[0] * reference.axisV[0] + direction[1] * reference.axisV[1]);
    const followsU = alignmentU >= alignmentV;
    const axisErrorDegrees = degrees(Math.acos(clamp(Math.max(alignmentU, alignmentV), -1, 1)));
    const start = basisCoordinates(facade.start, reference.axisU, reference.axisV);
    const end = basisCoordinates(facade.end, reference.axisU, reference.axisV);
    const coefficientOffsets = start && end
      ? followsU
        ? [nearestDistance(start[1], reference.vAnchors), nearestDistance(end[1], reference.vAnchors)]
        : [nearestDistance(start[0], reference.uAnchors), nearestDistance(end[0], reference.uAnchors)]
      : [Number.POSITIVE_INFINITY];
    // A unit coefficient along either basis axis has perpendicular spacing
    // |determinant| because both facade axes are normalized.
    const anchorOffsetM = Math.max(...coefficientOffsets) * Math.abs(determinant);
    return { facadeId:facade.id,start:facade.start,end:facade.end,length,axisErrorDegrees,anchorOffsetM };
  });
  const totalFacadeLength = facadeMetrics.reduce((sum, metric) => sum + metric.length, 0);
  const weightedFacadeAxisErrorDegrees = totalFacadeLength > 1e-9
    ? facadeMetrics.reduce((sum, metric) => sum + metric.axisErrorDegrees * metric.length, 0) / totalFacadeLength
    : 0;
  const p95FacadeAxisErrorDegrees = percentileByLength(
    facadeMetrics.map((metric) => ({ value: metric.axisErrorDegrees, length: metric.length })),
    0.95,
  );
  const maximumFacadeAnchorOffsetM = facadeMetrics.reduce(
    (maximum, metric) => Math.max(maximum, metric.anchorOffsetM),
    0,
  );
  const p95FacadeAnchorOffsetM = percentileByLength(
    facadeMetrics.map((metric) => ({ value: metric.anchorOffsetM, length: metric.length })),
    0.95,
  );

  const exclusions = (options.excludedTriangles ?? []).map((polygon) => ({ polygon, bounds: bounds(polygon) }));
  let buildingOverlapAreaM2 = 0;
  for (const cell of options.partition?.cells ?? []) {
    const cellBounds = bounds(cell.polygon);
    for (const exclusion of exclusions) {
      if (!boundsOverlap(cellBounds, exclusion.bounds)) continue;
      buildingOverlapAreaM2 += parcelGridPolygonArea(
        intersectConvexParcelGridPolygons(cell.polygon, exclusion.polygon),
      );
    }
  }
  const excludedUnion=unionParcelGridCoverage(options.excludedTriangles??[]);
  // This set is reference-independent.  Computing it once per report instead
  // of once for every facade is essential for large Berlin parcels and keeps
  // the diagnostic tool from timing out before it can write its report.
  const facadeCells=(options.partition?.cells??[]).filter(cell=>cell.boundaryKind==="building-facade"&&cell.boundaryRow===0);
  const partitionMetrics=reference.facades.map((facade)=>facadePartitionMetric(
    reference,facade,options.partition,options.coverageTriangles??[],excludedUnion,facadeCells,
  ));
  const exposedPartitionMetrics=partitionMetrics.filter((metric)=>metric.expectedLengthM>.05);
  const minimumFacadeCoverageRatio=exposedPartitionMetrics.length
    ?Math.min(...exposedPartitionMetrics.map((metric)=>metric.coverageRatio)):1;
  const maximumFacadeLineGapM=partitionMetrics.reduce((maximum,metric)=>Math.max(maximum,metric.maximumGapM),0);
  const partialFacadeCellCount=partitionMetrics.reduce((sum,metric)=>sum+metric.partialCells,0);
  const facadeReports:ParcelGridFacadeAudit[]=reference.facades.map((facade,index)=>({
    facadeId:facade.id,start:facade.start,end:facade.end,
    lengthM:facadeMetrics[index]!.length,
    axisErrorDegrees:facadeMetrics[index]!.axisErrorDegrees,
    anchorOffsetM:facadeMetrics[index]!.anchorOffsetM,
    expectedExposedLengthM:partitionMetrics[index]!.expectedLengthM,
    coverageRatio:partitionMetrics[index]!.coverageRatio,
    maximumGapM:partitionMetrics[index]!.maximumGapM,
    partialCellCount:partitionMetrics[index]!.partialCells,
  }));
  const coverage=mergeParcelGridCoverage(options.coverageTriangles??[]);
  const clippedExclusions=(options.coverageTriangles??[]).flatMap((coverageTriangle)=>(
    excludedUnion.map((exclusion)=>intersectConvexParcelGridPolygons(coverageTriangle,exclusion))
      .filter((polygon)=>parcelGridPolygonArea(polygon)>1e-8)
  ));
  const expectedBuildableAreaM2=coverage.length
    ?coverage.reduce((sum,polygon)=>sum+parcelGridPolygonArea(polygon),0)
      -clippedExclusions.reduce((sum,polygon)=>sum+parcelGridPolygonArea(polygon),0)
    :null;
  const uncoveredBuildableAreaM2=expectedBuildableAreaM2===null||!options.partition?0
    :Math.abs(expectedBuildableAreaM2-options.partition.coveredArea);

  const issues: ParcelGridAuditIssue[] = [];
  if (Math.abs(determinant) < 0.5 || basisAngleDegrees < 60 || basisAngleDegrees > 120) issues.push({
    code: "invalid-building-basis",
    severity: "error",
    measured: basisAngleDegrees,
    limit: 60,
  });
  // Once an actual partition is available, the exact per-facade coverage
  // below is authoritative. Irregular/angled annexes deliberately receive
  // local facade bands and need not follow the two dominant far-field axes.
  if (!options.partition&&(weightedFacadeAxisErrorDegrees > 0.75 || p95FacadeAxisErrorDegrees > 1.5)) issues.push({
    code: "facade-axis-drift",
    severity: "error",
    measured: Math.max(weightedFacadeAxisErrorDegrees, p95FacadeAxisErrorDegrees),
    limit: 1.5,
  });
  if (!options.partition&&p95FacadeAnchorOffsetM > 0.25) issues.push({
    code: "facade-anchor-drift",
    severity: "warning",
    measured: p95FacadeAnchorOffsetM,
    limit: 0.25,
  });
  // A ratio alone over-penalizes centimetre-sized end clips on very short
  // facade fragments. The absolute uncovered run is the construction-relevant
  // invariant and remains limited to five centimetres below.
  if(options.partition)for(const facade of facadeReports){
    if(facade.maximumGapM>.05)issues.push({
      code:"facade-line-gap",severity:"error",measured:facade.maximumGapM,limit:.05,subjectId:facade.facadeId,
      message:`${facade.maximumGapM.toFixed(3)} m of the exposed facade has no building-aligned raster edge.`,
    });
    if(facade.partialCellCount>0)issues.push({
      code:"partial-facade-cell",severity:"error",measured:facade.partialCellCount,limit:0,subjectId:facade.facadeId,
      message:`${facade.partialCellCount} complete facade columns are only partially covered by placeable cells.`,
    });
  }
  if (buildingOverlapAreaM2 > 1e-5) issues.push({
    code: "building-overlap",
    severity: "error",
    measured: buildingOverlapAreaM2,
    limit: 1e-5,
  });
  if(uncoveredBuildableAreaM2>.01)issues.push({
    code:"parcel-coverage-gap",severity:"error",measured:uncoveredBuildableAreaM2,limit:.01,
  });
  return {
    schemaVersion: "vectoplan-parcel-grid-audit.v3",
    status: issues.some((issue) => issue.severity === "error")
      ? "error"
      : issues.length > 0 ? "warning" : "pass",
    buildingId: reference.buildingId,
    facadeCount: reference.facades.length,
    basisAngleDegrees,
    weightedFacadeAxisErrorDegrees,
    p95FacadeAxisErrorDegrees,
    p95FacadeAnchorOffsetM,
    maximumFacadeAnchorOffsetM,
    buildingOverlapAreaM2,
    minimumFacadeCoverageRatio,
    maximumFacadeLineGapM,
    partialFacadeCellCount,
    expectedBuildableAreaM2,
    uncoveredBuildableAreaM2,
    facades:facadeReports,
    issues,
  };
}
