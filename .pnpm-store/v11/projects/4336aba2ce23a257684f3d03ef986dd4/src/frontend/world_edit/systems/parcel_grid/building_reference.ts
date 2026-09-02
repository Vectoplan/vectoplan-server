export type BuildingGridPoint = readonly [number,number];

export interface Lod2BuildingFacadeReference {
  readonly id:string;
  readonly start:BuildingGridPoint;
  readonly end:BuildingGridPoint;
  readonly inward:BuildingGridPoint;
  readonly length:number;
  readonly columns:number;
  readonly columnWidth:number;
}

export interface Lod2BuildingFootprint {
  readonly outer:readonly BuildingGridPoint[];
  readonly holes:readonly (readonly BuildingGridPoint[])[];
}

export interface Lod2BuildingGridReference {
  readonly kind:'lod2-building';
  readonly referenceSource:'derived-geometry'|'persisted-construction-grid';
  readonly constructionGridVersion?:string;
  readonly constructionGridFingerprint?:string;
  readonly buildingId:string;
  readonly origin:BuildingGridPoint;
  readonly axisU:BuildingGridPoint;
  readonly axisV:BuildingGridPoint;
  readonly widthM:number;
  readonly depthM:number;
  readonly stepU:number;
  readonly stepV:number;
  /** Absolute coordinates on axisU/axisV that must remain grid lines.
   * They come from real ground-level facade support lines, including annexes.
   */
  readonly uAnchors:readonly number[];
  readonly vAnchors:readonly number[];
  readonly columns:number;
  readonly rows:number;
  readonly rotationDegrees:number;
  readonly centroid:BuildingGridPoint;
  readonly areaM2:number;
  /** Classified GroundSurface geometry. Roof projections are never stored here. */
  readonly footprints:readonly Lod2BuildingFootprint[];
  /** Exterior rings retained for backwards-compatible consumers. */
  readonly polygons:readonly (readonly BuildingGridPoint[])[];
  readonly facades:readonly Lod2BuildingFacadeReference[];
  readonly signature:string;
}

const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const array=(value:unknown):readonly unknown[]=>Array.isArray(value)?value:[];
const finitePoint=(value:unknown):BuildingGridPoint|null=>{
  const values=array(value),x=Number(values[0]),z=Number(values[1]);
  return Number.isFinite(x)&&Number.isFinite(z)?[x,z]:null;
};
const cleanRing=(value:unknown):BuildingGridPoint[]=>{
  const points=array(value).map(finitePoint).filter((point):point is BuildingGridPoint=>point!==null);
  if(points.length>1&&Math.hypot(points[0]![0]-points.at(-1)![0],points[0]![1]-points.at(-1)![1])<1e-6)points.pop();
  return [...new Map(points.map(point=>[`${point[0].toFixed(6)}:${point[1].toFixed(6)}`,point])).values()];
};
const signedArea=(points:readonly BuildingGridPoint[])=>points.reduce((sum,point,index)=>{
  const next=points[(index+1)%points.length]!;return sum+point[0]*next[1]-next[0]*point[1];
},0)/2;
const edgeKey=(start:BuildingGridPoint,end:BuildingGridPoint)=>[start,end]
  .map(point=>`${point[0].toFixed(6)}:${point[1].toFixed(6)}`).sort().join('|');
const pointInRing=(point:BuildingGridPoint,ring:readonly BuildingGridPoint[]):boolean=>{
  let inside=false;
  for(let index=0,previous=ring.length-1;index<ring.length;previous=index++){
    const a=ring[index]!,b=ring[previous]!;
    if(((a[1]>point[1])!==(b[1]>point[1]))
      && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
};

const HALF_TURN=Math.PI;
const FACADE_FAMILY_INLIER_RADIANS=2.5*Math.PI/180;
const FACADE_ANCHOR_INLIER_RADIANS=.35*Math.PI/180;
const MINIMUM_STRUCTURAL_FACADE_M=.35;
const MINIMUM_FULL_HEIGHT_FACADE_M=1.5;

function moduloHalfTurn(value:number):number {
  return ((value%HALF_TURN)+HALF_TURN)%HALF_TURN;
}

function lineAngleDistance(first:number,second:number):number {
  const difference=Math.abs(moduloHalfTurn(first)-moduloHalfTurn(second));
  return Math.min(difference,HALF_TURN-difference);
}

/**
 * Derive both real facade direction families. LoD2 buildings are frequently
 * several degrees out of square. Folding both families into a forced 90 degree
 * average made neither axis match the building (3.5 and 99.3 degrees became
 * 5.9 and 95.9 degrees in the reference project). A long facade then drifted
 * by metres from its supposed raster line.
 */
function dominantFacadeBasis(
  segments:readonly (readonly [BuildingGridPoint,BuildingGridPoint])[],
):readonly [BuildingGridPoint,BuildingGridPoint]|null {
  const candidates=segments.map((segment)=>{
    const dx=segment[1][0]-segment[0][0],dz=segment[1][1]-segment[0][1];
    const length=Math.hypot(dx,dz);
    return {angle:moduloHalfTurn(Math.atan2(dz,dx)),length};
  }).filter((candidate)=>candidate.length>=MINIMUM_STRUCTURAL_FACADE_M);
  if(!candidates.length)return null;
  const family=(pool:typeof candidates):Readonly<{angle:number;support:number}>|null=>{
    if(!pool.length)return null;
    const seed=[...pool].sort((first,second)=>{
      const firstScore=pool.reduce((sum,candidate)=>sum+(lineAngleDistance(candidate.angle,first.angle)<=FACADE_FAMILY_INLIER_RADIANS?candidate.length:0),0);
      const secondScore=pool.reduce((sum,candidate)=>sum+(lineAngleDistance(candidate.angle,second.angle)<=FACADE_FAMILY_INLIER_RADIANS?candidate.length:0),0);
      return secondScore-firstScore||second.length-first.length;
    })[0]!;
    const inliers=pool.filter((candidate)=>lineAngleDistance(candidate.angle,seed.angle)<=FACADE_FAMILY_INLIER_RADIANS);
    // Use an actual measured facade direction. A circular mean can be a line
    // that exists nowhere on the building and creates visible drift over long
    // walls even when its numerical average error looks small.
    const medoid=[...inliers].sort((first,second)=>{
      const firstError=inliers.reduce((sum,candidate)=>sum+lineAngleDistance(candidate.angle,first.angle)*candidate.length,0);
      const secondError=inliers.reduce((sum,candidate)=>sum+lineAngleDistance(candidate.angle,second.angle)*candidate.length,0);
      return firstError-secondError||second.length-first.length;
    })[0]!;
    return {angle:medoid.angle,support:inliers.reduce((sum,candidate)=>sum+candidate.length,0)};
  };
  const primary=family(candidates);if(!primary)return null;
  const secondaryPool=candidates.filter((candidate)=>{
    const separation=lineAngleDistance(candidate.angle,primary.angle);
    return separation>=60*Math.PI/180&&separation<=120*Math.PI/180;
  });
  const secondary=family(secondaryPool);
  let axisU:BuildingGridPoint=[Math.cos(primary.angle),Math.sin(primary.angle)];
  if(axisU[0]<-1e-9||(Math.abs(axisU[0])<=1e-9&&axisU[1]<0))axisU=[-axisU[0],-axisU[1]];
  let axisV:BuildingGridPoint=secondary
    ? [Math.cos(secondary.angle),Math.sin(secondary.angle)]
    : [-axisU[1],axisU[0]];
  if(axisU[0]*axisV[1]-axisU[1]*axisV[0]<0)axisV=[-axisV[0],-axisV[1]];
  if(Math.abs(axisU[0]*axisV[1]-axisU[1]*axisV[0])<.5)axisV=[-axisU[1],axisU[0]];
  return [axisU,axisV];
}

function basisCoordinates(point:BuildingGridPoint,axisU:BuildingGridPoint,axisV:BuildingGridPoint):BuildingGridPoint {
  const determinant=axisU[0]*axisV[1]-axisU[1]*axisV[0];
  return [
    (point[0]*axisV[1]-point[1]*axisV[0])/determinant,
    (axisU[0]*point[1]-axisU[1]*point[0])/determinant,
  ];
}

function clusteredCoordinates(values:readonly number[],tolerance=.02):number[] {
  const sorted=[...values].filter(Number.isFinite).sort((first,second)=>first-second);
  const clusters:number[][]=[];
  for(const value of sorted){
    const current=clusters.at(-1);
    if(!current||value-current.reduce((sum,item)=>sum+item,0)/current.length>tolerance)clusters.push([value]);
    else current.push(value);
  }
  return clusters.map((cluster)=>cluster[Math.floor((cluster.length-1)/2)]!);
}

function polygonCentroid(points:readonly BuildingGridPoint[]):BuildingGridPoint {
  const area=signedArea(points);
  if(Math.abs(area)<1e-9)return [points.reduce((sum,p)=>sum+p[0],0)/points.length,points.reduce((sum,p)=>sum+p[1],0)/points.length];
  let x=0,z=0;
  for(let index=0;index<points.length;index++){
    const point=points[index]!,next=points[(index+1)%points.length]!,cross=point[0]*next[1]-next[0]*point[1];
    x+=(point[0]+next[0])*cross;z+=(point[1]+next[1])*cross;
  }
  return [x/(6*area),z/(6*area)];
}

function normalizeFootprint(value:readonly BuildingGridPoint[]|Lod2BuildingFootprint):Lod2BuildingFootprint|null {
  const source:Lod2BuildingFootprint=Array.isArray(value)
    ?{outer:value as readonly BuildingGridPoint[],holes:[]}
    :value as Lod2BuildingFootprint;
  const outer=cleanRing(source.outer);
  if(outer.length<3||Math.abs(signedArea(outer))<=1e-6)return null;
  const holes=array(source.holes).map(cleanRing)
    .filter((ring)=>ring.length>=3&&Math.abs(signedArea(ring))>1e-6);
  return {outer,holes};
}

/**
 * Derive a stable metre-like raster from the actual LoD2 outer dimensions.
 * Ground-level facade direction families define one orthogonal reference
 * frame. Real facade support lines become fixed grid anchors, so annexes and
 * recesses can receive a complete neighbouring block without allowing every
 * small LoD2 fragment to rotate its own local raster.
 */
export function deriveLod2BuildingGridReference(
  buildingId:string,
  polygonValues:readonly (readonly BuildingGridPoint[]|Lod2BuildingFootprint)[],
  segmentValues:readonly (readonly [BuildingGridPoint,BuildingGridPoint])[]=[],
):Lod2BuildingGridReference|null {
  const footprints=polygonValues.map(normalizeFootprint)
    .filter((value):value is Lod2BuildingFootprint=>value!==null);
  const polygons=footprints.map((footprint)=>footprint.outer);
  const footprintRings=footprints.flatMap((footprint)=>[footprint.outer,...footprint.holes]);
  if(!buildingId||!footprints.length)return null;
  const segmentMap=new Map<string,readonly [BuildingGridPoint,BuildingGridPoint]>();
  for(const segment of segmentValues){
    if(segment.length!==2||!segment.every((point)=>point.length===2&&point.every(Number.isFinite)))continue;
    if(Math.hypot(segment[1][0]-segment[0][0],segment[1][1]-segment[0][1])<.05)continue;
    segmentMap.set(edgeKey(segment[0],segment[1]),segment);
  }
  // Older imports did not persist WallSurface references. Their roof objects
  // still contain exact union-footprint rings, which are a safer fallback than
  // the world/parcel grid until the metadata-only repair has run.
  if(!segmentMap.size)for(const polygon of footprintRings)for(let index=0;index<polygon.length;index++){
    const start=polygon[index]!,end=polygon[(index+1)%polygon.length]!;
    if(Math.hypot(end[0]-start[0],end[1]-start[1])>=.05)segmentMap.set(edgeKey(start,end),[start,end]);
  }
  const inside=(point:BuildingGridPoint)=>footprints.some((footprint)=>pointInRing(point,footprint.outer)
    && !footprint.holes.some((hole)=>pointInRing(point,hole)));
  // GroundSurface frequently arrives as several touching component polygons.
  // A shared component seam has footprint material on both sides and is not a
  // facade. Keeping it would create a one-metre "facade band" inside the
  // building and make the real exterior audit fail even when the visible grid
  // is correct. Only edges separating inside from outside survive.
  const exteriorSegments=[...segmentMap.values()].filter(([start,end])=>{
    const dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz);
    // Sub-block LoD2 notches cannot define a placeable one-metre facade
    // column. Treating every 7-15 cm survey jog as its own raster axis creates
    // uncovered corner slivers and makes an otherwise straight extension
    // impossible. The exact footprint remains the exclusion geometry; only
    // the construction reference is simplified here.
    if(length<MINIMUM_STRUCTURAL_FACADE_M)return false;
    const midpoint:BuildingGridPoint=[(start[0]+end[0])/2,(start[1]+end[1])/2];
    const normal:BuildingGridPoint=[-dz/length,dx/length];
    const first:BuildingGridPoint=[midpoint[0]+normal[0]*.04,midpoint[1]+normal[1]*.04];
    const second:BuildingGridPoint=[midpoint[0]-normal[0]*.04,midpoint[1]-normal[1]*.04];
    return inside(first)!==inside(second);
  });
  const segments=exteriorSegments.length?exteriorSegments:[...segmentMap.values()];
  const dominantBasis=dominantFacadeBasis(segments);
  if(!dominantBasis)return null;
  const [axisU,axisV]=dominantBasis;
  const points=segments.flatMap(segment=>[...segment]);
  const basisValues=points.map(point=>basisCoordinates(point,axisU,axisV));
  const projectedU=basisValues.map(point=>point[0]);
  const projectedV=basisValues.map(point=>point[1]);
  const minimumU=Math.min(...projectedU),maximumU=Math.max(...projectedU),minimumV=Math.min(...projectedV),maximumV=Math.max(...projectedV);
  const widthM=maximumU-minimumU,depthM=maximumV-minimumV;
  if(widthM<.25||depthM<.25)return null;
  const columns=Math.max(1,Math.round(widthM)),rows=Math.max(1,Math.round(depthM));
  const weighted=footprints.flatMap((footprint)=>[
    {points:footprint.outer,area:Math.abs(signedArea(footprint.outer)),centroid:polygonCentroid(footprint.outer)},
    ...footprint.holes.map((points)=>({points,area:-Math.abs(signedArea(points)),centroid:polygonCentroid(points)})),
  ]);
  const areaM2=weighted.reduce((sum,item)=>sum+item.area,0);
  const centroid:BuildingGridPoint=areaM2>1e-8?[
    weighted.reduce((sum,item)=>sum+item.centroid[0]*item.area,0)/areaM2,
    weighted.reduce((sum,item)=>sum+item.centroid[1]*item.area,0)/areaM2,
  ]:[points.reduce((sum,p)=>sum+p[0],0)/points.length,points.reduce((sum,p)=>sum+p[1],0)/points.length];
  const facades:Lod2BuildingFacadeReference[]=segments.map(([rawStart,rawEnd])=>{
    let start=rawStart,end=rawEnd;
    // Stable endpoint order keeps logical cell ids unchanged across chunks.
    if(start[0]>end[0]+1e-9||(Math.abs(start[0]-end[0])<=1e-9&&start[1]>end[1]))[start,end]=[end,start];
    const dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz);
    const midpoint:BuildingGridPoint=[(start[0]+end[0])/2,(start[1]+end[1])/2];
    let inward:BuildingGridPoint=[-dz/length,dx/length];
    const first:BuildingGridPoint=[midpoint[0]+inward[0]*.04,midpoint[1]+inward[1]*.04];
    const second:BuildingGridPoint=[midpoint[0]-inward[0]*.04,midpoint[1]-inward[1]*.04];
    const firstInside=inside(first);
    const secondInside=inside(second);
    if((!firstInside&&secondInside)||(!firstInside&&!secondInside
      && (centroid[0]-midpoint[0])*inward[0]+(centroid[1]-midpoint[1])*inward[1]<0))inward=[-inward[0],-inward[1]];
    const columns=Math.max(1,Math.round(length));
    return {id:edgeKey(start,end),start,end,inward,length,columns,columnWidth:length/columns};
  }).sort((first,second)=>first.id.localeCompare(second.id));
  const uAnchorValues:number[]=[minimumU,maximumU];
  const vAnchorValues:number[]=[minimumV,maximumV];
  for(const [start,end] of segments){
    const dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz);
    if(length<MINIMUM_STRUCTURAL_FACADE_M)continue;
    const direction:BuildingGridPoint=[dx/length,dz/length];
    const alignmentU=Math.abs(direction[0]*axisU[0]+direction[1]*axisU[1]);
    const alignmentV=Math.abs(direction[0]*axisV[0]+direction[1]*axisV[1]);
    const midpoint:BuildingGridPoint=[(start[0]+end[0])/2,(start[1]+end[1])/2];
    const basis=basisCoordinates(midpoint,axisU,axisV);
    if(alignmentU>=Math.cos(FACADE_ANCHOR_INLIER_RADIANS)){
      vAnchorValues.push(basis[1]);
    }else if(alignmentV>=Math.cos(FACADE_ANCHOR_INLIER_RADIANS)){
      uAnchorValues.push(basis[0]);
    }
  }
  const uAnchors=clusteredCoordinates(uAnchorValues);
  const vAnchors=clusteredCoordinates(vAnchorValues);
  const origin:BuildingGridPoint=[axisU[0]*minimumU+axisV[0]*minimumV,axisU[1]*minimumU+axisV[1]*minimumV];
  const rotationDegrees=((Math.atan2(axisU[1],axisU[0])*180/Math.PI)%180+180)%180;
  const signature=[buildingId,origin.map(value=>value.toFixed(4)).join(':'),rotationDegrees.toFixed(4),widthM.toFixed(3),depthM.toFixed(3),columns,rows,
    uAnchors.map(value=>value.toFixed(3)).join(','),vAnchors.map(value=>value.toFixed(3)).join(','),facades.map(facade=>facade.id).join(',')].join(':');
  return {kind:'lod2-building',referenceSource:'derived-geometry',buildingId,origin,axisU,axisV,widthM,depthM,stepU:widthM/columns,stepV:depthM/rows,
    uAnchors,vAnchors,columns,rows,rotationDegrees,centroid,areaM2,footprints,polygons,facades,signature};
}

const CONSTRUCTION_GRID_VERSION='vectoplan-lod2-construction-grid.v1';

function finiteNumberList(value:unknown):number[]|null {
  const values=array(value).map(Number);
  return values.length>=2&&values.every(Number.isFinite)
    && values.every((item,index)=>index===0||item>values[index-1]!+1e-9)
    ?values:null;
}

/**
 * Consume the grid that Chunk already validated while importing LoD2.  The
 * geometry-derived reference remains responsible only for the classified
 * footprint/centroid that is not duplicated in the contract.  Any malformed
 * or conflicting contract falls through to the legacy derivation unchanged.
 */
function persistedConstructionGridReference(
  buildingId:string,
  value:unknown,
  geometry:Lod2BuildingGridReference,
):Lod2BuildingGridReference|null {
  const source=record(value);
  if(source.schemaVersion!==CONSTRUCTION_GRID_VERSION
    ||source.referenceMode!=='lod2-existing-building'
    ||source.coordinateSpace!=='world-cell-xz'
    ||String(source.buildingId??'')!==buildingId)return null;
  const origin=finitePoint(source.origin),axisU=finitePoint(source.axisU),axisV=finitePoint(source.axisV);
  if(!origin||!axisU||!axisV)return null;
  const axisULength=Math.hypot(...axisU),axisVLength=Math.hypot(...axisV);
  const determinant=axisU[0]*axisV[1]-axisU[1]*axisV[0];
  if(Math.abs(axisULength-1)>.01||Math.abs(axisVLength-1)>.01||Math.abs(determinant)<.5)return null;
  const widthM=Number(source.widthM),depthM=Number(source.depthM),stepU=Number(source.stepU),stepV=Number(source.stepV);
  const columns=Number(source.columns),rows=Number(source.rows),rotationDegrees=Number(source.rotationDegrees);
  if(![widthM,depthM,stepU,stepV,rotationDegrees].every(Number.isFinite)
    ||widthM<=0||depthM<=0||stepU<=0||stepV<=0
    ||!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||rows<1
    ||Math.abs(stepU*columns-widthM)>.0001||Math.abs(stepV*rows-depthM)>.0001)return null;
  const uAnchors=finiteNumberList(source.uAnchors),vAnchors=finiteNumberList(source.vAnchors);
  if(!uAnchors||!vAnchors)return null;
  const facades=array(source.facades).map((value):Lod2BuildingFacadeReference|null=>{
    const facade=record(value),start=finitePoint(facade.start),end=finitePoint(facade.end),inward=finitePoint(facade.inward);
    const id=String(facade.id??'').trim(),length=Number(facade.lengthM),columns=Number(facade.columnCount);
    const columnWidth=Number(facade.columnWidthM);
    if(!id||!start||!end||!inward||!Number.isFinite(length)||length<=0
      ||!Number.isInteger(columns)||columns<1||!Number.isFinite(columnWidth)||columnWidth<=0)return null;
    const measured=Math.hypot(end[0]-start[0],end[1]-start[1]);
    if(Math.abs(measured-length)>Math.max(.02,length*.0001)
      ||Math.abs(columnWidth*columns-length)>.0001||Math.abs(Math.hypot(...inward)-1)>.01)return null;
    return {id,start,end,inward,length,columns,columnWidth};
  });
  if(!facades.length||facades.some((value)=>value===null))return null;
  const fingerprint=String(source.fingerprint??'').trim();
  if(!/^[a-f\d]{64}$/i.test(fingerprint))return null;
  return {
    ...geometry,
    referenceSource:'persisted-construction-grid',
    constructionGridVersion:CONSTRUCTION_GRID_VERSION,
    constructionGridFingerprint:fingerprint,
    origin,axisU,axisV,widthM,depthM,stepU,stepV,uAnchors,vAnchors,columns,rows,rotationDegrees,
    facades:facades as readonly Lod2BuildingFacadeReference[],
    signature:`${buildingId}:construction-grid:${fingerprint}`,
  };
}

/** One exact, outward-facing block row beside every classified ground wall. */
export function lod2BuildingFacadeBands(reference:Lod2BuildingGridReference,depth=1) {
  return reference.facades.map((facade)=>({
    id:`building-facade:${reference.buildingId}:${facade.id}`,
    parcelId:`building:${reference.buildingId}`,
    start:facade.start,
    end:facade.end,
    inward:[-facade.inward[0],-facade.inward[1]] as BuildingGridPoint,
    length:facade.length,
    depth,
    divisions:facade.columns,
    clampToDepth:true,
    boundaryKind:"building-facade" as const,
  }));
}

function footprintPolygons(footprint:Record<string,unknown>):BuildingGridPoint[][] {
  const coordinates=array(footprint.coordinates);
  const rawPolygons=String(footprint.type??'Polygon')==='MultiPolygon'?coordinates:[coordinates];
  return rawPolygons.map(value=>cleanRing(array(value)[0])).filter(points=>points.length>=3);
}

function sourceGroundFootprints(value:unknown):Lod2BuildingFootprint[] {
  return array(value).flatMap((rawFootprint):Lod2BuildingFootprint[]=>{
    const rings=array(rawFootprint).map(cleanRing).filter((ring)=>ring.length>=3);
    return rings.length?[{outer:rings[0]!,holes:rings.slice(1)}]:[];
  });
}

/** Polygonize the full-height WallSurface bottom edges of legacy imports.
 * New imports persist classified GroundSurface rings directly. This fallback
 * keeps older projects correct without ever falling back to a roof overhang
 * when their facade graph is closed.
 */
function footprintsFromFacadeSegments(
  segments:readonly (readonly [BuildingGridPoint,BuildingGridPoint])[],
):Lod2BuildingFootprint[] {
  const pointByKey=new Map<string,BuildingGridPoint>();
  const neighbours=new Map<string,Set<string>>();
  const key=(point:BuildingGridPoint)=>`${point[0].toFixed(3)}:${point[1].toFixed(3)}`;
  for(const [start,end] of segments){
    const startKey=key(start),endKey=key(end);if(startKey===endKey)continue;
    pointByKey.set(startKey,start);pointByKey.set(endKey,end);
    const startNeighbours=neighbours.get(startKey)??new Set<string>();startNeighbours.add(endKey);neighbours.set(startKey,startNeighbours);
    const endNeighbours=neighbours.get(endKey)??new Set<string>();endNeighbours.add(startKey);neighbours.set(endKey,endNeighbours);
  }
  const ordered=new Map<string,string[]>();
  for(const [node,values] of neighbours){
    const origin=pointByKey.get(node)!;
    ordered.set(node,[...values].sort((first,second)=>{
      const a=pointByKey.get(first)!,b=pointByKey.get(second)!;
      return Math.atan2(a[1]-origin[1],a[0]-origin[0])-Math.atan2(b[1]-origin[1],b[0]-origin[0]);
    }));
  }
  const visited=new Set<string>(),rings:BuildingGridPoint[][]=[];
  for(const [start,values] of ordered)for(const end of values){
    const firstHalfEdge=`${start}>${end}`;if(visited.has(firstHalfEdge))continue;
    const ring:BuildingGridPoint[]=[];let from=start,to=end,closed=false;
    for(let guard=0;guard<segments.length*4+8;guard+=1){
      const halfEdge=`${from}>${to}`;if(visited.has(halfEdge))break;
      visited.add(halfEdge);ring.push(pointByKey.get(from)!);
      const exits=ordered.get(to);if(!exits?.length)break;
      const reverseIndex=exits.indexOf(from);if(reverseIndex<0)break;
      const next=exits[(reverseIndex-1+exits.length)%exits.length]!;
      from=to;to=next;
      if(from===start&&to===end){closed=true;break;}
    }
    if(closed&&ring.length>=3&&signedArea(ring)>.01)rings.push(ring);
  }
  const unique=[...new Map(rings.map((ring)=>{
    const keys=ring.map(key),smallest=keys.reduce((best,value,index)=>value<keys[best]!?index:best,0);
    const signature=[...keys.slice(smallest),...keys.slice(0,smallest)].join('|');
    return [signature,ring] as const;
  })).values()];
  return unique.map((outer,index)=>({
    outer,
    holes:unique.filter((candidate,candidateIndex)=>candidateIndex!==index
      && Math.abs(signedArea(candidate))<Math.abs(signedArea(outer))
      && pointInRing(candidate[0]!,outer)
      && !unique.some((container,containerIndex)=>containerIndex!==index&&containerIndex!==candidateIndex
        && Math.abs(signedArea(container))<Math.abs(signedArea(outer))
        && Math.abs(signedArea(container))>Math.abs(signedArea(candidate))
        && pointInRing(candidate[0]!,container))),
  })).filter((footprint,index,all)=>!all.some((other,otherIndex)=>otherIndex!==index
    && Math.abs(signedArea(other.outer))>Math.abs(signedArea(footprint.outer))
    && pointInRing(footprint.outer[0]!,other.outer)));
}

/** Extract each loaded LoD2 building once even though semantic refs are copied
 * into every intersecting chunk. This is read-only and also works for existing
 * imports because the required exact footprint already lives on roof refs.
 */
export function lod2BuildingGridReferencesFromChunks(chunks:readonly unknown[]):Lod2BuildingGridReference[] {
  const seenObjects=new Set<string>(),byBuilding=new Map<string,{
    groundFootprints:Map<string,Lod2BuildingFootprint>;
    roofPolygons:BuildingGridPoint[][];
    segments:Map<string,readonly [BuildingGridPoint,BuildingGridPoint]>;
    constructionGrids:Map<string,unknown>;
  }>();
  for(const value of chunks){
    const chunk=record(value),raw=record(chunk.raw),rawRaw=record(raw.raw);
    const refs=array(chunk.objectRefs??raw.objectRefs??rawRaw.objectRefs??record(rawRaw.content).objectRefs);
    for(const refValue of refs){
      const ref=record(refValue),metadata=record(ref.metadata),footprint=record(ref.footprint);
      if(String(ref.objectTypeId??'')!=='building_roof'||String(footprint.coordinateSpace??'')!=='world-cell-xz')continue;
      const buildingId=String(metadata.lod2BuildingId??metadata.lod2_building_id??'').trim();
      const objectId=String(ref.objectInstanceId??`${buildingId}:${JSON.stringify(footprint.coordinates)}`);
      if(!buildingId||seenObjects.has(objectId))continue;
      seenObjects.add(objectId);
      const polygons=footprintPolygons(footprint);if(!polygons.length)continue;
      const source=record(record(metadata.roofParameters).importedSource);
      const facadeRecords=array(source.facadeSegments).map(record);
      const structuralFacadeRecords=facadeRecords.filter((segment)=>{
        const minimumY=Number(segment.minimumY??segment.minimum_y);
        const maximumY=Number(segment.maximumY??segment.maximum_y);
        return !Number.isFinite(minimumY)||!Number.isFinite(maximumY)||maximumY-minimumY>=MINIMUM_FULL_HEIGHT_FACADE_M;
      });
      const segments=structuralFacadeRecords.map(segment=>{
        const start=finitePoint(segment.start),end=finitePoint(segment.end);
        return start&&end?[start,end] as const:null;
      }).filter((value):value is readonly [BuildingGridPoint,BuildingGridPoint]=>value!==null);
      const current=byBuilding.get(buildingId)??{
        groundFootprints:new Map<string,Lod2BuildingFootprint>(),roofPolygons:[],
        segments:new Map<string,readonly [BuildingGridPoint,BuildingGridPoint]>(),
        constructionGrids:new Map<string,unknown>(),
      };
      for(const ground of sourceGroundFootprints(source.groundFootprints)){
        const signature=[ground.outer,...ground.holes].map((ring)=>ring.map((point)=>point.map((coordinate)=>coordinate.toFixed(3)).join(':')).join(','))
          .join('|');
        current.groundFootprints.set(signature,ground);
      }
      for(const segment of segments)current.segments.set(edgeKey(segment[0],segment[1]),segment);
      const constructionGrid=record(source.constructionGrid);
      if(Object.keys(constructionGrid).length){
        const contractKey=String(constructionGrid.fingerprint??JSON.stringify(constructionGrid));
        current.constructionGrids.set(contractKey,constructionGrid);
      }
      current.roofPolygons.push(...polygons);
      byBuilding.set(buildingId,current);
    }
  }
  return [...byBuilding.entries()].map(([buildingId,value])=>{
    const ground=[...value.groundFootprints.values()];
    const legacySegments=[...value.segments.values()];
    const legacyGround=ground.length?[]:footprintsFromFacadeSegments(legacySegments);
    const footprints=ground.length?ground:legacyGround.length?legacyGround:value.roofPolygons;
    // GroundSurface boundaries are authoritative and contain neither roof
    // overhangs nor upper-wall fragments. Segment fallback is only needed for
    // old metadata where classified ground rings were not persisted yet.
    const derived=deriveLod2BuildingGridReference(buildingId,footprints,ground.length||legacyGround.length?[]:legacySegments);
    if(!derived)return null;
    const persisted=[...value.constructionGrids.values()]
      .map((contract)=>persistedConstructionGridReference(buildingId,contract,derived))
      .filter((reference):reference is Lod2BuildingGridReference=>reference!==null);
    return persisted.length===1?persisted[0]!:derived;
  })
    .filter((value):value is Lod2BuildingGridReference=>value!==null)
    .sort((first,second)=>second.areaM2-first.areaM2||first.buildingId.localeCompare(second.buildingId));
}
