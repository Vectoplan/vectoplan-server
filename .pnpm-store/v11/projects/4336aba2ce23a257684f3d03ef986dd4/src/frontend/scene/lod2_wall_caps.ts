import * as THREE from 'three';
import type { RuntimeChunkContent } from '../runtime/world/chunk_content';
import { roofSurfaceTriangles, type RoofPoint, type RoofTriangle } from './roof_surface_geometry';

export interface Lod2WallCaps {
  readonly chunk:RuntimeChunkContent;
  readonly geometry:THREE.BufferGeometry|null;
  readonly cappedCellIndices:readonly number[];
  readonly alignedCellIndices:readonly number[];
  readonly renderedBodyKeys:readonly string[];
  readonly delegatedBodyKeys:readonly string[];
  readonly discardedBodyKeys:readonly string[];
  readonly unrepresentedCellIndices:readonly number[];
}

export interface Lod2RoofSurfaceSource {
  readonly buildingId:string;
  readonly calculation:unknown;
  readonly facadeSegments?:readonly unknown[];
  readonly repairFacadeRoofSeams?:boolean;
}

// Convex polygon clipping in world space. Interpolating XYZ also interpolates
// the real roof plane; no rounded height, invented overhang or filled courtyard.
function clip(points:readonly RoofPoint[],distance:(p:RoofPoint)=>number):RoofPoint[] {
  const result:RoofPoint[]=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i]!,b=points[(i+1)%points.length]!,da=distance(a),db=distance(b);
    if(da>=-1e-9)result.push(a);
    if((da>=0)!==(db>=0)) {
      const t=da/(da-db);
      result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);
    }
  }
  return result;
}
function area(points:readonly RoofPoint[]):number {
  return Math.abs(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length]!;return s+a[0]*b[2]-b[0]*a[2];},0))/2;
}
function prism(points:readonly RoofPoint[],bottom:number,output:number[],sideEdges?:readonly number[]):void {
  if(points.length<3 || area(points)<1e-9)return;
  const triangle=(a:RoofPoint,b:RoofPoint,c:RoofPoint)=>{
    const ab=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const ac=new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    if(ab.cross(ac).lengthSq()>1e-14)output.push(...a,...b,...c);
  };
  const ring=[...points];
  const signed=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length]!;return s+a[0]*b[2]-b[0]*a[2];},0);
  if(signed>0)ring.reverse(); // top normals point upwards in Y-up space
  const lower=ring.map(([x,,z])=>[x,bottom,z] as RoofPoint);
  for(let i=1;i<ring.length-1;i++){triangle(ring[0]!,ring[i]!,ring[i+1]!);triangle(lower[0]!,lower[i+1]!,lower[i]!);}
  for(let i=0;i<ring.length;i++) {
    if(sideEdges&&!sideEdges.includes(i))continue;
    const j=(i+1)%ring.length;
    triangle(lower[i]!,lower[j]!,ring[j]!);triangle(lower[i]!,ring[j]!,ring[i]!);
  }
}

function facadePrism(topInput:readonly RoofPoint[],bottomInput:readonly RoofPoint[],output:number[]):void {
  if(topInput.length!==4||bottomInput.length!==4||area(topInput)<1e-9)return;
  const triangle=(a:RoofPoint,b:RoofPoint,c:RoofPoint)=>{
    const ab=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const ac=new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    if(ab.cross(ac).lengthSq()>1e-12)output.push(...a,...b,...c);
  };
  const top=[...topInput],bottom=[...bottomInput];
  const signed=top.reduce((sum,current,index)=>{const next=top[(index+1)%top.length]!;
    return sum+current[0]*next[2]-next[0]*current[2];},0);
  if(signed>0){top.reverse();bottom.reverse();}
  triangle(top[0]!,top[1]!,top[2]!);triangle(top[0]!,top[2]!,top[3]!);
  triangle(bottom[0]!,bottom[2]!,bottom[1]!);triangle(bottom[0]!,bottom[3]!,bottom[2]!);
  for(let index=0;index<4;index++){
    const next=(index+1)%4;
    triangle(bottom[index]!,bottom[next]!,top[next]!);
    triangle(bottom[index]!,top[next]!,top[index]!);
  }
}

type PlanPoint=readonly [number,number];
const FACADE_HEIGHT_EPS=.005;
const FACADE_PLAN_EPS=.005;
export interface BuildingBoundaryEdge {
  readonly buildingId:string;
  readonly edgeKey:string;
  readonly start:PlanPoint;
  readonly end:PlanPoint;
  readonly inward:PlanPoint;
  readonly length:number;
  readonly divisions:number;
  readonly columnWidth:number;
  readonly minimumY:number;
  readonly maximumY:number;
  readonly topProfile:readonly (readonly [number,number])[];
  readonly bottomProfile:readonly (readonly [number,number])[];
  readonly facadeRole:'exterior'|'connector'|'source';
  readonly exactFacade:boolean;
}

const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const planEdgeKey=(first:PlanPoint,second:PlanPoint):string=>[first,second]
  .map(point=>`${point[0].toFixed(4)}:${point[1].toFixed(4)}`).sort().join('|');
const pointInTriangle=(point:PlanPoint,triangle:RoofTriangle):boolean=>{
  const [a,b,c]=triangle.map(value=>[value[0],value[2]] as PlanPoint) as [PlanPoint,PlanPoint,PlanPoint];
  const sign=(p1:PlanPoint,p2:PlanPoint,p3:PlanPoint)=>(p1[0]-p3[0])*(p2[1]-p3[1])-(p2[0]-p3[0])*(p1[1]-p3[1]);
  const d1=sign(point,a,b),d2=sign(point,b,c),d3=sign(point,c,a);
  return !(d1< -1e-7||d2< -1e-7||d3< -1e-7)&&!(d1>1e-7||d2>1e-7||d3>1e-7);
};

function roofHeightsAtPlan(point:PlanPoint,triangles:readonly RoofTriangle[]):number[] {
  const result:number[]=[];
  for(const [a,b,c] of triangles){
    const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(denominator)<1e-12)continue;
    const first=((b[2]-c[2])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[2]))/denominator;
    const second=((c[2]-a[2])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[2]))/denominator;
    const third=1-first-second;
    if(first< -1e-6||second< -1e-6||third< -1e-6)continue;
    result.push(first*a[1]+second*b[1]+third*c[1]);
  }
  return result;
}

function facadeTriangleBreaks(start:PlanPoint,end:PlanPoint,triangles:readonly RoofTriangle[]):number[] {
  const dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz),result:number[]=[];
  const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;
  for(const triangle of triangles)for(let index=0;index<3;index++){
    const first=triangle[index]!,second=triangle[(index+1)%3]!;
    const ex=second[0]-first[0],ez=second[2]-first[2],denominator=cross(dx,dz,ex,ez);
    if(Math.abs(denominator)<1e-10)continue;
    const rx=first[0]-start[0],rz=first[2]-start[1];
    const t=cross(rx,rz,ex,ez)/denominator,u=cross(rx,rz,dx,dz)/denominator;
    if(t< -1e-7||t>1+1e-7||u< -1e-7||u>1+1e-7)continue;
    const along=Math.max(0,Math.min(length,t*length));
    result.push(along,Math.max(0,along-.001),Math.min(length,along+.001));
  }
  return result;
}

function simplifyFacadeProfile(profile:readonly (readonly [number,number])[]):readonly (readonly [number,number])[] {
  const result:Array<readonly [number,number]>=[];
  for(const value of profile){
    while(result.length>=2){
      const first=result[result.length-2]!,middle=result[result.length-1]!;
      const span=value[0]-first[0];
      const expected=Math.abs(span)<1e-10?first[1]:first[1]+(value[1]-first[1])*(middle[0]-first[0])/span;
      if(Math.abs(expected-middle[1])>1e-5)break;
      result.pop();
    }
    result.push(value);
  }
  return result;
}

function roofAlignedFacadeTop(edge:Readonly<{start:PlanPoint;end:PlanPoint;length:number;divisions:number;
  inward:PlanPoint;maximumY:number;minimumY:number;topProfile:readonly (readonly [number,number])[];
  bottomProfile:readonly (readonly [number,number])[]}>,triangles:readonly RoofTriangle[]) {
  const dx=(edge.end[0]-edge.start[0])/edge.length,dz=(edge.end[1]-edge.start[1])/edge.length;
  const knots=[0,edge.length,...edge.topProfile.map(value=>value[0]),...facadeTriangleBreaks(edge.start,edge.end,triangles)];
  for(let column=0;column<=edge.divisions;column++)knots.push(edge.length*column/edge.divisions);
  const ordered=[...new Set(knots.map(value=>Math.max(0,Math.min(edge.length,value))).map(value=>Math.round(value*1e6)/1e6))]
    .sort((first,second)=>first-second);
  const profile=ordered.map((along):readonly [number,number]=>{
    const x=edge.start[0]+dx*along,z=edge.start[1]+dz*along;
    const sourceTop=facadeProfileAt(edge.topProfile,along,edge.length,edge.maximumY);
    const bottom=facadeProfileAt(edge.bottomProfile,along,edge.length,edge.minimumY);
    const candidates=[.08,.02,0].map(depth=>roofHeightsAtPlan(
      [x+edge.inward[0]*depth,z+edge.inward[1]*depth],triangles,
    ).filter(height=>height>bottom+FACADE_HEIGHT_EPS)).find(values=>values.length)??[];
    // Prefer the roof that continuously covers the building side of the wall.
    // A plane touching only the exact edge can belong to an upper neighbour
    // and previously pulled the wall through the lower annex roof.
    const top=candidates.sort((first,second)=>Math.abs(first-sourceTop)-Math.abs(second-sourceTop))[0]??sourceTop;
    return [along,top];
  });
  return simplifyFacadeProfile(profile);
}

/** Exact finite-segment/unit-cell test. Distance-only matching accepted cells
 * around a corner even when the facade never crossed that cell, which created
 * a single protruding column on rotated buildings and annex notches. */
export function segmentIntersectsLod2Cell(start:PlanPoint,end:PlanPoint,x:number,z:number):boolean {
  return segmentIntervalInLod2Cell(start,end,x,z)!==null;
}

function segmentIntervalInLod2Cell(start:PlanPoint,end:PlanPoint,x:number,z:number):readonly [number,number]|null {
  const dx=end[0]-start[0],dz=end[1]-start[1];
  let minimum=0,maximum=1;
  const clipAxis=(origin:number,direction:number,lower:number,upper:number):boolean=>{
    if(Math.abs(direction)<1e-12)return origin>=lower-1e-8&&origin<=upper+1e-8;
    let first=(lower-origin)/direction,second=(upper-origin)/direction;
    if(first>second)[first,second]=[second,first];
    minimum=Math.max(minimum,first);maximum=Math.min(maximum,second);
    return minimum<=maximum+1e-9;
  };
  return clipAxis(start[0],dx,x,x+1)&&clipAxis(start[1],dz,z,z+1)
    ?[minimum,maximum] as const:null;
}

export function lod2FacadeTopAt(edge:BuildingBoundaryEdge,along:number):number {
  return facadeProfileAt(edge.topProfile,along,edge.length,edge.maximumY);
}

function facadeProfileAt(profile:readonly (readonly [number,number])[],along:number,length:number,fallback:number):number {
  if(!profile.length)return fallback;
  const value=Math.max(0,Math.min(length,along));
  if(value<=profile[0]![0])return profile[0]![1];
  for(let index=1;index<profile.length;index++){
    const first=profile[index-1]!,second=profile[index]!;
    if(value>second[0]+1e-8)continue;
    const span=second[0]-first[0];
    if(span<=1e-9)return Math.max(first[1],second[1]);
    const ratio=(value-first[0])/span;
    return first[1]+(second[1]-first[1])*ratio;
  }
  return profile.at(-1)![1];
}

export function lod2FacadeBottomAt(edge:BuildingBoundaryEdge,along:number):number {
  return facadeProfileAt(edge.bottomProfile,along,edge.length,edge.minimumY);
}

function facadeColumnKnots(edge:BuildingBoundaryEdge,column:number):number[] {
  const start=column*edge.columnWidth,end=(column+1)*edge.columnWidth;
  const internal=[...edge.topProfile,...edge.bottomProfile].map(point=>point[0])
    .filter(along=>along>start+1e-8&&along<end-1e-8);
  return [...new Set([start,end,...internal])].sort((a,b)=>a-b);
}

/** Parts of one facade column whose source wall still exists in this Y layer.
 * The owner is chosen inside the longest positive interval, never at a gable
 * endpoint that belongs to a neighbouring world cell. */
export function lod2FacadeVerticalIntervals(edge:BuildingBoundaryEdge,column:number,y:number):readonly (readonly [number,number])[] {
  const knots=facadeColumnKnots(edge,column),result:Array<[number,number]>=[];
  for(let index=0;index+1<knots.length;index++){
    let start=knots[index]!,end=knots[index+1]!;
    const startTop=lod2FacadeTopAt(edge,start),endTop=lod2FacadeTopAt(edge,end);
    if(startTop<=y+FACADE_HEIGHT_EPS&&endTop<=y+FACADE_HEIGHT_EPS)continue;
    if(startTop<=y+FACADE_HEIGHT_EPS){
      const ratio=(y+FACADE_HEIGHT_EPS-startTop)/(endTop-startTop);
      start=start+(end-start)*Math.max(0,Math.min(1,ratio));
    }else if(endTop<=y+FACADE_HEIGHT_EPS){
      const ratio=(startTop-y-FACADE_HEIGHT_EPS)/(startTop-endTop);
      end=start+(end-start)*Math.max(0,Math.min(1,ratio));
    }
    const startBottom=lod2FacadeBottomAt(edge,start),endBottom=lod2FacadeBottomAt(edge,end);
    if(startBottom>=y+1-FACADE_HEIGHT_EPS&&endBottom>=y+1-FACADE_HEIGHT_EPS)continue;
    if(startBottom>=y+1-FACADE_HEIGHT_EPS){
      const ratio=(startBottom-(y+1-FACADE_HEIGHT_EPS))/(startBottom-endBottom);
      start=start+(end-start)*Math.max(0,Math.min(1,ratio));
    }else if(endBottom>=y+1-FACADE_HEIGHT_EPS){
      const ratio=((y+1-FACADE_HEIGHT_EPS)-startBottom)/(endBottom-startBottom);
      end=start+(end-start)*Math.max(0,Math.min(1,ratio));
    }
    const startGap=lod2FacadeTopAt(edge,start)-lod2FacadeBottomAt(edge,start);
    const endGap=lod2FacadeTopAt(edge,end)-lod2FacadeBottomAt(edge,end);
    if(startGap<=FACADE_HEIGHT_EPS&&endGap<=FACADE_HEIGHT_EPS)continue;
    if(startGap<=FACADE_HEIGHT_EPS){
      const ratio=(FACADE_HEIGHT_EPS-startGap)/(endGap-startGap);
      start=start+(end-start)*Math.max(0,Math.min(1,ratio));
    }else if(endGap<=FACADE_HEIGHT_EPS){
      const ratio=(startGap-FACADE_HEIGHT_EPS)/(startGap-endGap);
      end=start+(end-start)*Math.max(0,Math.min(1,ratio));
    }
    if(end-start<=FACADE_PLAN_EPS)continue;
    const previous=result.at(-1);
    // Profile knots split one uninterrupted wall strip into numerically
    // almost-equal pieces.  Treating those pieces as separate ownership
    // candidates made the importer and renderer choose different world cells
    // at chunk borders (and left a complete vertical facade strip missing).
    // Merge touching intervals before selecting their owner, exactly as the
    // persistence rasterizer does.
    if(previous&&start-previous[1]<=1e-7)previous[1]=end;
    else result.push([start,end]);
  }
  return result;
}

/** Project exact LoD2 wall segments into a building-owned raster. Older
 * imports fall back to the roof union boundary, where shared triangle/ridge
 * edges cancel. Each facade dimension is divided into round(length) equal
 * columns so no residual world-grid stair is pushed to the final block.
 */
export function lod2BuildingBoundaryGrid(sources:readonly (Lod2RoofSurfaceSource|unknown)[]):BuildingBoundaryEdge[] {
  const grouped=new Map<string,RoofTriangle[]>();
  const repairRoofSeams=new Set<string>();
  const exact=new Map<string,Map<string,{start:PlanPoint;end:PlanPoint;minimumY:number;maximumY:number;
    topProfile:readonly (readonly [number,number])[];bottomProfile:readonly (readonly [number,number])[];
    facadeRole:'exterior'|'connector'|'source'}>>();
  sources.forEach((value,index)=>{
    const source=asRecord(value),calculation='calculation' in source?source.calculation:value;
    const buildingId=String(source.buildingId??asRecord(asRecord(calculation).metadata).lod2BuildingId??`roof-${index}`);
    if(source.repairFacadeRoofSeams===true)repairRoofSeams.add(buildingId);
    grouped.set(buildingId,[...(grouped.get(buildingId)??[]),...roofSurfaceTriangles(calculation)]);
    const byEdge=exact.get(buildingId)??new Map();
    for(const raw of Array.isArray(source.facadeSegments)?source.facadeSegments:[]){
      const segment=asRecord(raw),startValue=segment.start,endValue=segment.end;
      if(!Array.isArray(startValue)||!Array.isArray(endValue))continue;
      const start:PlanPoint=[Number(startValue[0]),Number(startValue[1])],end:PlanPoint=[Number(endValue[0]),Number(endValue[1])];
      const minimumY=Number(segment.minimumY),maximumY=Number(segment.maximumY);
      if(![...start,...end,minimumY,maximumY].every(Number.isFinite)||maximumY<=minimumY)continue;
      const key=planEdgeKey(start,end),previous=byEdge.get(key);
      const length=Math.hypot(end[0]-start[0],end[1]-start[1]);
      const parsedProfile=(Array.isArray(segment.topProfile)?segment.topProfile:[]).map(value=>Array.isArray(value)
        ?[Number(value[0]),Number(value[1])] as const:null)
        .filter((value):value is readonly [number,number]=>value!==null&&value.every(Number.isFinite))
        .filter(([along])=>along>=-.01&&along<=length+.01).sort((first,second)=>first[0]-second[0]);
      const topProfile=parsedProfile.length>=2?parsedProfile:[[0,maximumY],[length,maximumY]] as const;
      const parsedBottom=(Array.isArray(segment.bottomProfile)?segment.bottomProfile:[]).map(value=>Array.isArray(value)
        ?[Number(value[0]),Number(value[1])] as const:null)
        .filter((value):value is readonly [number,number]=>value!==null&&value.every(Number.isFinite))
        .filter(([along])=>along>=-.01&&along<=length+.01).sort((first,second)=>first[0]-second[0]);
      const bottomProfile=parsedBottom.length>=2?parsedBottom:[[0,minimumY],[length,minimumY]] as const;
      const parsedRole=String(segment.facadeRole??'exterior');
      const facadeRole:'exterior'|'connector'|'source'=parsedRole==='connector'||parsedRole==='source'?parsedRole:'exterior';
      byEdge.set(key,{start:previous?.start??start,end:previous?.end??end,
        minimumY:Math.min(previous?.minimumY??minimumY,minimumY),maximumY:Math.max(previous?.maximumY??maximumY,maximumY),
        topProfile:previous?.topProfile.length?previous.topProfile:topProfile,
        bottomProfile:previous?.bottomProfile.length?previous.bottomProfile:bottomProfile,
        facadeRole:previous?.facadeRole==='exterior'||facadeRole==='exterior'?'exterior':previous?.facadeRole??facadeRole});
    }
    exact.set(buildingId,byEdge);
  });
  const result:BuildingBoundaryEdge[]=[];
  for(const [buildingId,triangles] of grouped){
    const exactEdges=exact.get(buildingId);
    const edges=new Map<string,{start:PlanPoint;end:PlanPoint;count:number}>();
    if(!exactEdges?.size)for(const triangle of triangles)for(let index=0;index<3;index++){
      const first=triangle[index]!,second=triangle[(index+1)%3]!;
      const start:PlanPoint=[first[0],first[2]],end:PlanPoint=[second[0],second[2]];
      if(Math.hypot(end[0]-start[0],end[1]-start[1])<1e-5)continue;
      const key=planEdgeKey(start,end),previous=edges.get(key);
      edges.set(key,{start:previous?.start??start,end:previous?.end??end,count:(previous?.count??0)+1});
    }
    const candidates=exactEdges?.size
      ?[...exactEdges.entries()].map(([edgeKey,edge])=>[edgeKey,{...edge,count:1}] as const)
      :[...edges.entries()];
    for(const [edgeKey,edge] of candidates){
      if(edge.count!==1)continue;
      const dx=edge.end[0]-edge.start[0],dz=edge.end[1]-edge.start[1],length=Math.hypot(dx,dz);
      if(length<.05)continue;
      const midpoint:PlanPoint=[(edge.start[0]+edge.end[0])/2,(edge.start[1]+edge.end[1])/2];
      let inward:PlanPoint=[-dz/length,dx/length];
      const firstProbe:PlanPoint=[midpoint[0]+inward[0]*.04,midpoint[1]+inward[1]*.04];
      const secondProbe:PlanPoint=[midpoint[0]-inward[0]*.04,midpoint[1]-inward[1]*.04];
      const firstInside=triangles.some(triangle=>pointInTriangle(firstProbe,triangle));
      const secondInside=triangles.some(triangle=>pointInTriangle(secondProbe,triangle));
      if(!firstInside&&secondInside)inward=[-inward[0],-inward[1]];
      const divisions=Math.max(1,Math.round(length));
      const minimumY='minimumY' in edge?edge.minimumY:Number.NEGATIVE_INFINITY;
      let maximumY='maximumY' in edge?edge.maximumY:Number.POSITIVE_INFINITY;
      const bottomProfile:readonly (readonly [number,number])[]='bottomProfile' in edge?edge.bottomProfile:
        [[0,Number.NEGATIVE_INFINITY],[length,Number.NEGATIVE_INFINITY]];
      let topProfile:readonly (readonly [number,number])[]='topProfile' in edge?edge.topProfile:
        [[0,Number.POSITIVE_INFINITY],[length,Number.POSITIVE_INFINITY]];
      if(exactEdges?.size&&repairRoofSeams.has(buildingId)){
        topProfile=roofAlignedFacadeTop({start:edge.start,end:edge.end,length,divisions,inward,
          minimumY,maximumY,topProfile,bottomProfile},triangles);
        maximumY=Math.max(...topProfile.map(value=>value[1]));
      }
      result.push({buildingId,edgeKey,start:edge.start,end:edge.end,inward,length,divisions,columnWidth:length/divisions,
        minimumY,maximumY,topProfile,bottomProfile,facadeRole:'facadeRole' in edge?edge.facadeRole:'source',
        exactFacade:Boolean(exactEdges?.size)});
    }
  }
  return result;
}

/** Standard one-cell-wide walls, with a height cut only at the roof junction.
 * Never shrink a whole facade to a decorative footprint: replacement blocks,
 * collision and targeting must all use the same horizontal cell dimensions.
 * The nearby roof plane is continued across the final cell, not down the wall.
 */
export function trimLod2WallCaps(chunk:RuntimeChunkContent,calculations:readonly (Lod2RoofSurfaceSource|unknown)[],
  occupiedAbove?:(x:number,y:number,z:number)=>boolean):Lod2WallCaps {
  const wallValue=chunk.paletteByBlockTypeId.get('lod2_exterior_wall')?.cellValue;
  const empty=(value:RuntimeChunkContent):Lod2WallCaps=>({chunk:value,geometry:null,cappedCellIndices:[],alignedCellIndices:[],
    renderedBodyKeys:[],delegatedBodyKeys:[],discardedBodyKeys:[],unrepresentedCellIndices:[]});
  if(!wallValue)return empty(chunk);
  const normalizedSources=calculations.map((value,index)=>{
    const source=asRecord(value),calculation='calculation' in source?source.calculation:value;
    const buildingId=String(source.buildingId??asRecord(asRecord(calculation).metadata).lod2BuildingId??`roof-${index}`);
    return {buildingId,calculation,triangles:roofSurfaceTriangles(calculation)};
  });
  const triangles:RoofTriangle[]=normalizedSources.flatMap(source=>source.triangles).filter(t=>
    Math.max(...t.map(p=>p[0]))>=chunk.chunkX*chunk.chunkSize && Math.min(...t.map(p=>p[0]))<=(chunk.chunkX+1)*chunk.chunkSize
    && Math.max(...t.map(p=>p[2]))>=chunk.chunkZ*chunk.chunkSize && Math.min(...t.map(p=>p[2]))<=(chunk.chunkZ+1)*chunk.chunkSize);
  if(!triangles.length)return empty(chunk);
  const cells=[...chunk.cells], capped:number[]=[],aligned:number[]=[],positions:number[]=[],unrepresented:number[]=[];
  const size=chunk.chunkSize;
  const boundaryGrid=lod2BuildingBoundaryGrid(calculations);
  const alignedBodies=new Map<string,'aligned'|'capped'|'delegated'|'discarded'>();
  const facadesByCell=new Map<string,readonly {edge:BuildingBoundaryEdge;column:number}[]>();
  const facadeTouchedCells=new Set<string>();
  const boundaryCells=(x:number,y:number,z:number):readonly {edge:BuildingBoundaryEdge;column:number}[]=>{
    const cellKey=`${x}:${y}:${z}`,cached=facadesByCell.get(cellKey);
    if(cached!==undefined)return cached;
    const selected=new Map<string,{edge:BuildingBoundaryEdge;column:number}>();
    for(const edge of boundaryGrid){
      if(!edge.exactFacade)continue;
      if(y+1<=edge.minimumY+1e-7||y>=edge.maximumY-1e-7)continue;
      const interval=segmentIntervalInLod2Cell(edge.start,edge.end,x,z);
      if(!interval)continue;
      // A legacy world-grid voxel can touch an exact LoD2 facade only at its
      // finite endpoint.  It owns no facade area, but keeping it would leave
      // the familiar single block protruding beyond an annex/building corner.
      // Mark it as touched so the source stair voxel is consumed, while the
      // positive-length owner cell remains solely responsible for rendering.
      facadeTouchedCells.add(cellKey);
      if(interval[1]-interval[0]<=1e-8)continue;
      const first=Math.max(0,Math.min(edge.divisions-1,Math.floor((interval[0]*edge.length+1e-8)/edge.columnWidth)));
      const last=Math.max(first,Math.min(edge.divisions-1,Math.floor((interval[1]*edge.length-1e-8)/edge.columnWidth)));
      const tangent:PlanPoint=[(edge.end[0]-edge.start[0])/edge.length,(edge.end[1]-edge.start[1])/edge.length];
      for(let column=first;column<=last;column++){
        // A facade body is owned by a source voxel inside the part of this
        // column that actually exists at the current height. This matters at
        // hips and gables, where the column midpoint can already be above the
        // source WallSurface although a triangular wall cap remains.
        const active=lod2FacadeVerticalIntervals(edge,column,y);
        if(!active.length)continue;
        const ownerInterval=[...active].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])||a[0]-b[0])[0]!;
        const along=(ownerInterval[0]+ownerInterval[1])/2;
        const ownerX=Math.floor(edge.start[0]+tangent[0]*along+1e-7);
        const ownerZ=Math.floor(edge.start[1]+tangent[1]*along+1e-7);
        if(ownerX!==x||ownerZ!==z)continue;
        selected.set(`${edge.buildingId}:${edge.edgeKey}:${column}`,{edge,column});
      }
    }
    const result=[...selected.values()];facadesByCell.set(cellKey,result);return result;
  };

  const renderFacadeBody=(edge:BuildingBoundaryEdge,column:number,y:number,retryDelegated=false):'aligned'|'capped'|'delegated'|'discarded'=>{
    const key=`${edge.buildingId}:${edge.edgeKey}:${column}:${y}`;
    const existing=alignedBodies.get(key);
    if(existing&&existing!=='discarded'&&!(retryDelegated&&existing==='delegated'))return existing;
    const tangent:PlanPoint=[(edge.end[0]-edge.start[0])/edge.length,(edge.end[1]-edge.start[1])/edge.length];
    const at=(along:number,depth:number,height:number):RoofPoint=>[
      edge.start[0]+tangent[0]*along+edge.inward[0]*depth,height,
      edge.start[1]+tangent[1]*along+edge.inward[1]*depth,
    ];
    const active=lod2FacadeVerticalIntervals(edge,column,y);
    if(!active.length){alignedBodies.set(key,'discarded');return 'discarded';}
    const ownerInterval=[...active].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])||a[0]-b[0])[0]!;
    const middle=at((ownerInterval[0]+ownerInterval[1])/2,0,y+.5);
    const owner=[Math.floor(middle[0]/size),Math.floor(y/size),Math.floor(middle[2]/size)];
    if(owner[0]!==chunk.chunkX||owner[1]!==chunk.chunkY||owner[2]!==chunk.chunkZ){
      alignedBodies.set(key,'delegated');return 'delegated';
    }
    const before=positions.length;
    let fullHeight=true;
    // Cell-plane intersections are additional breakpoints. Clamping only the
    // original profile endpoints can turn a real triangular strip into two
    // non-positive endpoints and incorrectly discard it.
    const profileKnots=facadeColumnKnots(edge,column),cellPlaneKnots:number[]=[];
    for(let index=0;index+1<profileKnots.length;index++){
      const first=profileKnots[index]!,last=profileKnots[index+1]!;
      for(const profileAt of [lod2FacadeTopAt,lod2FacadeBottomAt])for(const height of [y,y+1]){
        const firstDelta=profileAt(edge,first)-height,lastDelta=profileAt(edge,last)-height;
        if(firstDelta*lastDelta>=0||Math.abs(firstDelta-lastDelta)<=1e-10)continue;
        cellPlaneKnots.push(first+(last-first)*firstDelta/(firstDelta-lastDelta));
      }
    }
    const knots=[...new Set([...profileKnots,...active.flat(),...cellPlaneKnots])].sort((a,b)=>a-b);
    for(let knotIndex=0;knotIndex+1<knots.length;knotIndex++){
      const first=knots[knotIndex]!,second=knots[knotIndex+1]!;
      if(second-first<=FACADE_PLAN_EPS)continue;
      const rawFirstTop=lod2FacadeTopAt(edge,first),rawSecondTop=lod2FacadeTopAt(edge,second);
      const rawFirstBottom=lod2FacadeBottomAt(edge,first),rawSecondBottom=lod2FacadeBottomAt(edge,second);
      const firstTop=Math.min(y+1,rawFirstTop),secondTop=Math.min(y+1,rawSecondTop);
      const firstBottom=Math.max(y,rawFirstBottom),secondBottom=Math.max(y,rawSecondBottom);
      if(firstTop<y+1-1e-8||secondTop<y+1-1e-8||firstBottom>y+1e-8||secondBottom>y+1e-8)fullHeight=false;
      let intervalStart=first,intervalEnd=second;
      const firstGap=firstTop-firstBottom,secondGap=secondTop-secondBottom;
      if(firstGap<=FACADE_HEIGHT_EPS&&secondGap<=FACADE_HEIGHT_EPS)continue;
      if(firstGap<=FACADE_HEIGHT_EPS)intervalStart=first+(second-first)*Math.max(0,Math.min(1,(FACADE_HEIGHT_EPS-firstGap)/(secondGap-firstGap)));
      else if(secondGap<=FACADE_HEIGHT_EPS)intervalEnd=first+(second-first)*Math.max(0,Math.min(1,(firstGap-FACADE_HEIGHT_EPS)/(firstGap-secondGap)));
      const topAtInterval=(along:number)=>firstTop+(secondTop-firstTop)*(along-first)/(second-first);
      const bottomAtInterval=(along:number)=>firstBottom+(secondBottom-firstBottom)*(along-first)/(second-first);
      const top=[
        at(intervalStart,0,topAtInterval(intervalStart)),at(intervalEnd,0,topAtInterval(intervalEnd)),
        at(intervalEnd,1,topAtInterval(intervalEnd)),at(intervalStart,1,topAtInterval(intervalStart)),
      ];
      const bottom=[
        at(intervalStart,0,bottomAtInterval(intervalStart)),at(intervalEnd,0,bottomAtInterval(intervalEnd)),
        at(intervalEnd,1,bottomAtInterval(intervalEnd)),at(intervalStart,1,bottomAtInterval(intervalStart)),
      ];
      facadePrism(top,bottom,positions);
    }
    const kind=positions.length>before?(fullHeight?'aligned':'capped'):'discarded';
    alignedBodies.set(key,kind);return kind;
  };

  // Consume every facade-owned source voxel first. Its replacement footprint
  // is the exact wall column, including the final cell below the roof. This is
  // what makes the roof edge, the vertical wall and the adjacent build raster
  // share one boundary instead of mixing a rotated facade with world cells.
  for(let index=0;index<cells.length;index++){
    if(cells[index]!==wallValue)continue;
    const lx=index%size,ly=Math.floor(index/size)%size,lz=Math.floor(index/(size*size));
    const x=chunk.chunkX*size+lx,y=chunk.chunkY*size+ly,z=chunk.chunkZ*size+lz;
    const selections=boundaryCells(x,y,z);
    if(!selections.length){
      if(facadeTouchedCells.has(`${x}:${y}:${z}`)){cells[index]=0;capped.push(index);}
      continue;
    }
    cells[index]=0;
    let cellKind:'aligned'|'capped'|'delegated'|'discarded'='discarded';
    let failedReplacement=false;
    for(const selected of selections){
      const kind=renderFacadeBody(selected.edge,selected.column,y);
      if(kind==='discarded')failedReplacement=true;
      if(kind==='capped'||cellKind==='discarded')cellKind=kind;
    }
    if(cellKind==='discarded'&&failedReplacement)unrepresented.push(index);
    if(cellKind==='aligned')aligned.push(index);else capped.push(index);
  }

  // A sloped/stepped WallSurface can intersect a source stair voxel without
  // containing the exact facade-column midpoint.  The first pass correctly
  // removes that stair cell, but older midpoint-only ownership then omitted
  // the replacement body. Recover only bodies supported by a real source wall
  // cell in this chunk; deleted wall layers therefore stay deleted.
  const sourceCellsByY=new Map<number,Array<readonly [number,number]>>();
  for(let index=0;index<chunk.cells.length;index++){
    if(chunk.cells[index]!==wallValue)continue;
    const lx=index%size,ly=Math.floor(index/size)%size,lz=Math.floor(index/(size*size));
    const y=chunk.chunkY*size+ly,list=sourceCellsByY.get(y)??[];
    list.push([chunk.chunkX*size+lx,chunk.chunkZ*size+lz]);sourceCellsByY.set(y,list);
  }
  for(const edge of boundaryGrid.filter(value=>value.exactFacade))for(let column=0;column<edge.divisions;column++){
    const minimumY=Math.max(Math.floor(edge.minimumY),chunk.chunkY*size);
    const maximumY=Math.min(Math.ceil(edge.maximumY),(chunk.chunkY+1)*size);
    for(let y=minimumY;y<maximumY;y++){
      const key=`${edge.buildingId}:${edge.edgeKey}:${column}:${y}`;
      if(['aligned','capped'].includes(alignedBodies.get(key)??''))continue;
      const active=lod2FacadeVerticalIntervals(edge,column,y);
      if(!active.length)continue;
      const ownerInterval=[...active].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])||a[0]-b[0])[0]!;
      const along=(ownerInterval[0]+ownerInterval[1])/2;
      const tx=(edge.end[0]-edge.start[0])/edge.length,tz=(edge.end[1]-edge.start[1])/edge.length;
      const ownerX=Math.floor((edge.start[0]+tx*along)/size),ownerZ=Math.floor((edge.start[1]+tz*along)/size);
      if(ownerX!==chunk.chunkX||Math.floor(y/size)!==chunk.chunkY||ownerZ!==chunk.chunkZ)continue;
      const sourceCells=sourceCellsByY.get(y)??[];
      const supported=sourceCells.some(([x,z])=>{
        const interval=segmentIntervalInLod2Cell(edge.start,edge.end,x,z);
        if(!interval)return false;
        const start=interval[0]*edge.length,end=interval[1]*edge.length;
        return active.some(([first,last])=>Math.min(end,last)-Math.max(start,first)>FACADE_PLAN_EPS);
      });
      if(supported)renderFacadeBody(edge,column,y,true);
    }
  }

  // Legacy/fallback cells without a recoverable facade reference are still
  // clipped safely in their original world cell. They never override a cell
  // already owned by the building grid above.
  const columnRoofs=new Map<number,{points:RoofPoint[];distance:number;min:number;max:number;mid:number}[]>();
  for(let index=0;index<cells.length;index++) {
    if(cells[index]!==wallValue)continue;
    const lx=index%size,ly=Math.floor(index/size)%size,lz=Math.floor(index/(size*size));
    const x=chunk.chunkX*size+lx,y=chunk.chunkY*size+ly,z=chunk.chunkZ*size+lz;
    const above=ly<size-1?Number(chunk.cells[index+size])>0:occupiedAbove?.(x,y+1,z)??false;
    const columnKey=lx+size*lz;
    let profiles=columnRoofs.get(columnKey);
    if(!profiles){
      profiles=[];
      for(const triangle of triangles) {
        if(Math.max(...triangle.map(p=>p[0]))<x || Math.min(...triangle.map(p=>p[0]))>x+1
          || Math.max(...triangle.map(p=>p[2]))<z || Math.min(...triangle.map(p=>p[2]))>z+1)continue;
        let polygon:RoofPoint[]=triangle.map(([px,py,pz])=>[px,py,pz]);
        for(const distance of [(p:RoofPoint)=>p[0]-x,(p:RoofPoint)=>x+1-p[0],(p:RoofPoint)=>p[2]-z,(p:RoofPoint)=>z+1-p[2]])polygon=clip(polygon,distance);
        if(polygon.length<3 || area(polygon)<1e-9)continue;
        const center=new THREE.Vector3(x+.5,0,z+.5);
        const nearest=new THREE.Triangle(...triangle.map(p=>new THREE.Vector3(p[0],0,p[2])) as [THREE.Vector3,THREE.Vector3,THREE.Vector3])
          .closestPointToPoint(center,new THREE.Vector3());
        // `polygon` is the real facet clipped to this wall cell.  The former
        // implementation calculated it, then discarded it and extrapolated
        // the roof plane over the complete 1 x 1 m cell.  That produced the
        // bright saw-tooth wedges visible outside oblique eaves and hips.
        const min=Math.min(...polygon.map(p=>p[1])),max=Math.max(...polygon.map(p=>p[1]));
        profiles.push({points:polygon,distance:center.distanceToSquared(nearest),min,max,mid:(min+max)/2});
      }
      columnRoofs.set(columnKey,profiles);
    }
    let selected:typeof profiles[number]|undefined;
    let score=Infinity;
    for(const profile of profiles) {
      if(profile.max<y-1.025 || (above && profile.max<y+1))continue;
      const next=profile.distance*1e6+Math.abs(profile.mid-y-1);
      if(next<score){score=next;selected=profile;}
    }
    // Full-height facade cells stay on the fast greedy meshing path.
    if(!selected || selected.min>=y+1-1e-8)continue;
    // Every cap is owned by the original cell. Removing/replacing that cell
    // automatically removes the cap on the next normal chunk remesh.
    cells[index]=0;capped.push(index);
    // A source face is triangulated.  Retain all coplanar/adjacent pieces near
    // the selected roof height so their union covers the true facet without
    // reintroducing a full-cell square or leaving a diagonal half-cell hole.
    for(const profile of profiles) {
      if(profile.max<y-1.025 || Math.abs(profile.mid-selected.mid)>1.25)continue;
      const polygon=clip(profile.points,p=>p[1]-y);
      const sloped=clip(polygon,p=>y+1-p[1]);
      const flat=profile.max>y+1+1e-8
        ?clip(polygon,p=>p[1]-(y+1)).map(([px,,pz])=>[px,y+1,pz] as RoofPoint):[];
      prism(sloped,y,positions);prism(flat,y,positions);
    }
  }

  const removed=[...new Set([...capped,...aligned])].sort((a,b)=>a-b);
  if(!removed.length)return empty(chunk);
  const bodyKeys=(kind:'aligned'|'capped'|'delegated'|'discarded')=>[...alignedBodies]
    .filter(([,value])=>value===kind).map(([key])=>key).sort();
  const details={renderedBodyKeys:[...bodyKeys('aligned'),...bodyKeys('capped')],delegatedBodyKeys:bodyKeys('delegated'),
    discardedBodyKeys:bodyKeys('discarded'),unrepresentedCellIndices:unrepresented};
  if(!positions.length)return {chunk:{...chunk,cells},geometry:null,cappedCellIndices:capped,alignedCellIndices:aligned,...details};
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.map(v=>v*chunk.cellSize),3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {chunk:{...chunk,cells},geometry,cappedCellIndices:capped,alignedCellIndices:aligned,...details};
}
