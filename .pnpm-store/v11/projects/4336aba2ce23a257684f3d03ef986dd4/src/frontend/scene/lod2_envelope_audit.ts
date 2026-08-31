import * as THREE from "three";

import type { RuntimeChunkContent } from "../runtime/world/chunk_content";
import { triangulateLod2Polygon } from "../render/lod2_building_scene";
import {
  lod2BuildingBoundaryGrid,
  lod2FacadeBottomAt,
  lod2FacadeTopAt,
  lod2FacadeVerticalIntervals,
  trimLod2WallCaps,
  type Lod2RoofSurfaceSource,
} from "./lod2_wall_caps";
import { createRoofCalculationMeshes } from "./roof_calculation_rendering";
import { roofSurfaceTriangles, type RoofTriangle } from "./roof_surface_geometry";

type Point3=readonly [number,number,number];
interface Surface { readonly surface:string; readonly rings:readonly (readonly Point3[])[] }
interface ConvertedRoof { readonly metadata:Readonly<Record<string,any>> }
interface ConvertedBuilding {
  readonly wallCells:readonly Point3[];
  readonly roofs:readonly ConvertedRoof[];
}
export interface Lod2EnvelopeFixture {
  readonly buildingId:string;
  readonly surfaces:readonly Surface[];
  readonly converted:ConvertedBuilding|null;
  readonly conversionError:string|null;
}
export interface Lod2EnvelopeIssue {
  readonly code:string;
  readonly severity:'error'|'warning';
  readonly measured:number;
  readonly limit:number;
  readonly message:string;
  readonly subjectId?:string;
}
export interface Lod2WallSurfaceAudit {
  readonly surfaceId:string;
  readonly heightM:number;
  readonly planLengthM:number;
  readonly horizontalLeanM:number;
  readonly leanDegrees:number;
  readonly maximumPlanResidualM:number;
  readonly maximumPlaneTiltDegrees:number;
  readonly groundEdgeOffsetM:number|null;
}
export interface Lod2FacadeRoofSeamAudit {
  readonly facadeId:string;
  readonly sampleCount:number;
  readonly missingRoofSampleCount:number;
  readonly maximumAbsoluteGapM:number;
  readonly meanAbsoluteGapM:number;
  readonly maximumWallAboveRoofM:number;
  readonly maximumWallBelowRoofM:number;
  readonly missingAlongM:readonly number[];
  readonly maximumGapAlongM:number|null;
}
export interface Lod2EnvelopeAuditReport {
  readonly status:'pass'|'warning'|'fail';
  readonly issues:readonly Lod2EnvelopeIssue[];
  readonly sourceRoofAreaM2:number;
  readonly convertedRoofAreaM2:number;
  readonly uniqueConvertedRoofAreaM2:number;
  readonly duplicateRoofTriangleCount:number;
  readonly wallCellCount:number;
  readonly alignedWallCellCount:number;
  readonly retainedWorldGridCellCount:number;
  readonly renderedWallBodyCount:number;
  readonly expectedWallBodyCount:number;
  readonly missingWallBodyCount:number;
  readonly missingWallBodyKeys:readonly string[];
  readonly neighbouringRenderedWallBodyKeys:readonly string[];
  readonly discardedMissingWallBodyKeys:readonly string[];
  readonly delegatedWallBodyCount:number;
  readonly roofTriangleCount:number;
  readonly wallTriangleCount:number;
  readonly openWallEdgeKeys:readonly string[];
  readonly wallSurfaces:readonly Lod2WallSurfaceAudit[];
  readonly facadeRoofSeams:readonly Lod2FacadeRoofSeamAudit[];
  readonly maximumSourceWallLeanM:number;
  readonly maximumSourceWallPlaneTiltDegrees:number;
  readonly maximumWallGroundOffsetM:number;
  readonly maximumWallRoofSeamGapM:number;
  readonly missingWallRoofSampleCount:number;
  readonly maximumRoofSeamHeightMismatchM:number;
  readonly roofSeamMismatchKeys:readonly string[];
  readonly minimumFacadeProfileHeightM:number;
}

const rounded=(value:number)=>Math.round(value*100_000)/100_000;
const vertexKey=(point:Point3)=>point.map(rounded).join(':');
const edgeKey=(first:Point3,second:Point3)=>[vertexKey(first),vertexKey(second)].sort().join('|');
const triangleArea=([a,b,c]:readonly Point3[])=>new THREE.Vector3(b![0]-a![0],b![1]-a![1],b![2]-a![2])
  .cross(new THREE.Vector3(c![0]-a![0],c![1]-a![1],c![2]-a![2])).length()/2;
const cleanRing=(ring:readonly Point3[]):Point3[]=>{
  const result=[...ring];
  if(result.length>1&&vertexKey(result[0]!)===vertexKey(result.at(-1)!))result.pop();
  return result;
};
const pointSegmentDistance=(point:readonly [number,number],start:readonly [number,number],end:readonly [number,number])=>{
  const dx=end[0]-start[0],dz=end[1]-start[1],lengthSquared=dx*dx+dz*dz;
  const t=lengthSquared>1e-12?Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dz)/lengthSquared)):0;
  return Math.hypot(point[0]-(start[0]+dx*t),point[1]-(start[1]+dz*t));
};
function roofHeightsAt(x:number,z:number,triangles:readonly RoofTriangle[]):number[] {
  const result:number[]=[];
  for(const [a,b,c] of triangles){
    const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(denominator)<1e-12)continue;
    const first=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const second=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator;
    const third=1-first-second;
    if(first< -1e-6||second< -1e-6||third< -1e-6)continue;
    result.push(first*a[1]+second*b[1]+third*c[1]);
  }
  return result;
}

function geometryTopology(geometry:THREE.BufferGeometry) {
  const position=geometry.getAttribute('position');
  const indices=geometry.index;
  const edges=new Map<string,number>();
  let degenerate=0,nonFinite=0,triangles=0;
  const point=(index:number):Point3=>[position.getX(index),position.getY(index),position.getZ(index)];
  const count=indices?.count??position.count;
  for(let offset=0;offset+2<count;offset+=3){
    const indexes=[0,1,2].map(delta=>indices?indices.getX(offset+delta):offset+delta);
    const points=indexes.map(point) as [Point3,Point3,Point3];
    triangles++;
    if(points.flat().some(value=>!Number.isFinite(value)))nonFinite++;
    if(triangleArea(points)<=1e-10)degenerate++;
    for(const [a,b] of [[0,1],[1,2],[2,0]] as const){
      const key=edgeKey(points[a],points[b]);edges.set(key,(edges.get(key)??0)+1);
    }
  }
  const openEdgeKeys=[...edges].filter(([,value])=>value%2!==0).map(([key])=>key);
  return {triangles,degenerate,nonFinite,openEdges:openEdgeKeys.length,openEdgeKeys};
}

function runtimeChunk(chunkX:number,chunkY:number,chunkZ:number,cells:readonly number[],size=16):RuntimeChunkContent {
  const palette={blockTypeId:'lod2_exterior_wall',cellValue:1,solid:true,opaque:true,placeable:true,breakable:true,
    selectable:true,collidable:true,label:'LoD2 wall'};
  return {
    chunkKey:`${chunkX}:${chunkY}:${chunkZ}`,chunkX,chunkY,chunkZ,chunkSize:size,cellSize:1,cells,
    palette:[palette],paletteByCellValue:new Map([[1,palette]]),paletteByBlockTypeId:new Map([[palette.blockTypeId,palette]]),
  } as unknown as RuntimeChunkContent;
}

function roofSources(envelope:Lod2EnvelopeFixture):Lod2RoofSurfaceSource[] {
  return (envelope.converted?.roofs??[]).map(roof=>{
    const parameters=roof.metadata.roofParameters as Record<string,any>|undefined;
    const imported=parameters?.importedSource as Record<string,any>|undefined;
    return {buildingId:envelope.buildingId,calculation:roof.metadata.roofCalculation,
      facadeSegments:Array.isArray(imported?.facadeSegments)?imported!.facadeSegments:[],
      repairFacadeRoofSeams:imported?.facadeProfileMode==='roof-clamped-v1'};
  });
}

function wallSurfaceAudits(envelope:Lod2EnvelopeFixture):Lod2WallSurfaceAudit[] {
  const groundPoints=envelope.surfaces.filter(value=>value.surface==='GroundSurface')
    .flatMap(surface=>surface.rings.flatMap(cleanRing));
  const orderedGroundY=[...groundPoints.map(point=>point[1])].sort((a,b)=>a-b);
  const groundY=orderedGroundY.length?orderedGroundY[Math.floor(orderedGroundY.length/2)]!:null;
  const groundEdges=envelope.surfaces.filter(value=>value.surface==='GroundSurface').flatMap(surface=>
    surface.rings.flatMap(ring=>{
      const points=cleanRing(ring);
      return points.map((point,index)=>[
        [point[0],point[2]] as const,
        [points[(index+1)%points.length]![0],points[(index+1)%points.length]![2]] as const,
      ] as const);
    }));
  return envelope.surfaces.map((surface,surfaceIndex)=>({surface,surfaceIndex}))
    .filter(({surface})=>surface.surface==='WallSurface')
    .map(({surface,surfaceIndex})=>{
      const points=cleanRing(surface.rings[0]??[]);
      if(points.length<3)return {surfaceId:`wall-${surfaceIndex}`,heightM:0,planLengthM:0,horizontalLeanM:0,leanDegrees:0,
        maximumPlanResidualM:0,maximumPlaneTiltDegrees:0,groundEdgeOffsetM:null};
      let first=points[0]!,second=points[1]!,planLengthM=0;
      // Use an actual horizontal wall edge as the plan tangent.  Choosing the
      // globally farthest pair can itself follow a leaning wall diagonal and
      // mathematically hide the lean that this audit is meant to detect.
      for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){
        if(Math.abs(points[b]![1]-points[a]![1])>.03)continue;
        const distance=Math.hypot(points[b]![0]-points[a]![0],points[b]![2]-points[a]![2]);
        if(distance>planLengthM){planLengthM=distance;first=points[a]!;second=points[b]!;}
      }
      if(planLengthM<1e-6)for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){
        const distance=Math.hypot(points[b]![0]-points[a]![0],points[b]![2]-points[a]![2]);
        if(distance>planLengthM){planLengthM=distance;first=points[a]!;second=points[b]!;}
      }
      const tx=planLengthM>1e-9?(second[0]-first[0])/planLengthM:1;
      const tz=planLengthM>1e-9?(second[2]-first[2])/planLengthM:0;
      const normalCoordinates=points.map(point=>(point[0]-first[0])*(-tz)+(point[2]-first[2])*tx);
      const heights=points.map(point=>point[1]),minimumY=Math.min(...heights),maximumY=Math.max(...heights),heightM=maximumY-minimumY;
      const meanY=heights.reduce((sum,value)=>sum+value,0)/heights.length;
      const meanNormal=normalCoordinates.reduce((sum,value)=>sum+value,0)/normalCoordinates.length;
      const varianceY=heights.reduce((sum,value)=>sum+(value-meanY)**2,0);
      const slope=varianceY>1e-10?heights.reduce((sum,value,index)=>
        sum+(value-meanY)*(normalCoordinates[index]!-meanNormal),0)/varianceY:0;
      const horizontalLeanM=Math.abs(slope)*heightM;
      const maximumPlanResidualM=normalCoordinates.reduce((maximum,value,index)=>
        Math.max(maximum,Math.abs(value-(meanNormal+slope*(heights[index]!-meanY)))),0);
      let maximumPlaneTiltDegrees=0;
      const rings=surface.rings.map(cleanRing).filter(ring=>ring.length>=3);
      for(const triangle of triangulateLod2Polygon(rings as Point3[][]) as Point3[][]){
        const a=triangle[0]!,b=triangle[1]!,c=triangle[2]!;
        const normal=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2])
          .cross(new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2])).normalize();
        maximumPlaneTiltDegrees=Math.max(maximumPlaneTiltDegrees,Math.asin(Math.min(1,Math.abs(normal.y)))*180/Math.PI);
      }
      const lowerPlan=points.filter(point=>point[1]<=minimumY+.03).map(point=>[point[0],point[2]] as const);
      const groundEdgeOffsetM=groundY!==null&&minimumY<=groundY+.15&&groundEdges.length&&lowerPlan.length
        ?lowerPlan.reduce((maximum,point)=>Math.max(maximum,Math.min(...groundEdges.map(([start,end])=>
          pointSegmentDistance(point,start,end)))),0):null;
      return {surfaceId:`wall-${surfaceIndex}`,heightM,planLengthM,horizontalLeanM,
        leanDegrees:Math.atan(Math.abs(slope))*180/Math.PI,maximumPlanResidualM,maximumPlaneTiltDegrees,groundEdgeOffsetM};
    });
}

function roofSeamHeightMismatches(triangles:readonly RoofTriangle[]) {
  const byPlanEdge=new Map<string,Array<readonly [Point3,Point3]>>();
  const planVertex=(point:Point3)=>`${rounded(point[0])}:${rounded(point[2])}`;
  for(const triangle of triangles)for(let index=0;index<3;index++){
    const first=triangle[index]!,second=triangle[(index+1)%3]!;
    const key=[planVertex(first),planVertex(second)].sort().join('|');
    const values=byPlanEdge.get(key)??[];values.push([first,second]);byPlanEdge.set(key,values);
  }
  const mismatches:Array<{key:string;heightMismatchM:number}>=[];
  for(const [key,edges] of byPlanEdge){
    if(edges.length<2)continue;
    let mismatch=0;
    for(let firstIndex=0;firstIndex<edges.length;firstIndex++)for(let secondIndex=firstIndex+1;secondIndex<edges.length;secondIndex++){
      const first=edges[firstIndex]!,second=edges[secondIndex]!;
      const ordered=(edge:readonly [Point3,Point3])=>planVertex(edge[0])<=planVertex(edge[1])?edge:[edge[1],edge[0]] as const;
      const a=ordered(first),b=ordered(second);
      mismatch=Math.max(mismatch,Math.abs(a[0][1]-b[0][1]),Math.abs(a[1][1]-b[1][1]));
    }
    if(mismatch>.0001)mismatches.push({key,heightMismatchM:mismatch});
  }
  return mismatches.sort((first,second)=>second.heightMismatchM-first.heightMismatchM);
}

export function auditLod2Envelope(envelope:Lod2EnvelopeFixture):Lod2EnvelopeAuditReport {
  const issues:Lod2EnvelopeIssue[]=[];
  const issue=(code:string,measured:number,limit:number,message:string,subjectId?:string,severity:'error'|'warning'='error')=>
    issues.push({code,severity,measured,limit,message,...subjectId?{subjectId}:{}});
  if(envelope.conversionError||!envelope.converted){
    issue('conversion-error',1,0,envelope.conversionError??'LoD2 conversion returned no building');
    return {status:'fail',issues,sourceRoofAreaM2:0,convertedRoofAreaM2:0,uniqueConvertedRoofAreaM2:0,duplicateRoofTriangleCount:0,
      wallCellCount:0,alignedWallCellCount:0,
      retainedWorldGridCellCount:0,renderedWallBodyCount:0,expectedWallBodyCount:0,missingWallBodyCount:0,missingWallBodyKeys:[],
      neighbouringRenderedWallBodyKeys:[],
      discardedMissingWallBodyKeys:[],
      delegatedWallBodyCount:0,roofTriangleCount:0,wallTriangleCount:0,openWallEdgeKeys:[],wallSurfaces:[],facadeRoofSeams:[],
      maximumSourceWallLeanM:0,maximumSourceWallPlaneTiltDegrees:0,maximumWallGroundOffsetM:0,
      maximumWallRoofSeamGapM:0,missingWallRoofSampleCount:0,maximumRoofSeamHeightMismatchM:0,
      roofSeamMismatchKeys:[],minimumFacadeProfileHeightM:0};
  }

  const wallSurfaces=wallSurfaceAudits(envelope);
  const sourceWallsAreNormalized=envelope.converted.roofs.some(roof=>{
    const imported=(roof.metadata.roofParameters as Record<string,any>|undefined)?.importedSource as Record<string,any>|undefined;
    return imported?.facadeGeometryMode==='ground-normalized-v1';
  });
  const sourceWallSeverity:'error'|'warning'=sourceWallsAreNormalized?'warning':'error';
  for(const wall of wallSurfaces){
    if(wall.horizontalLeanM>.03)issue('source-wall-not-vertical',wall.horizontalLeanM,.03,
      `Wall surface leans ${wall.horizontalLeanM.toFixed(3)} m (${wall.leanDegrees.toFixed(2)} degrees) between bottom and top.`,wall.surfaceId,sourceWallSeverity);
    if(wall.maximumPlanResidualM>.03)issue('source-wall-plan-nonlinear',wall.maximumPlanResidualM,.03,
      'Wall surface vertices do not lie on one vertically extruded plan line.',wall.surfaceId,sourceWallSeverity);
    if(wall.maximumPlaneTiltDegrees>1)issue('source-wall-plane-tilt',wall.maximumPlaneTiltDegrees,1,
      'A source WallSurface triangle is not vertical.',wall.surfaceId,sourceWallSeverity);
    if(wall.heightM<.10&&wall.planLengthM>.50)issue('wall-surface-thin-fragment',wall.heightM,.10,
      'A long WallSurface is only a thin height fragment and is likely a clipped seam artefact.',wall.surfaceId,'warning');
    if(wall.groundEdgeOffsetM!==null&&wall.groundEdgeOffsetM>.03)issue('wall-ground-edge-drift',wall.groundEdgeOffsetM,.03,
      'The lower WallSurface edge does not coincide with the independent GroundSurface boundary.',wall.surfaceId,sourceWallSeverity);
  }
  const maximumSourceWallLeanM=wallSurfaces.reduce((maximum,wall)=>Math.max(maximum,wall.horizontalLeanM),0);
  const maximumSourceWallPlaneTiltDegrees=wallSurfaces.reduce((maximum,wall)=>Math.max(maximum,wall.maximumPlaneTiltDegrees),0);
  const maximumWallGroundOffsetM=wallSurfaces.reduce((maximum,wall)=>Math.max(maximum,wall.groundEdgeOffsetM??0),0);

  const uniqueSurfaces=new Map<string,Surface>();
  for(const surface of envelope.surfaces.filter(value=>value.surface==='RoofSurface')){
    const key=surface.rings.flat().map(vertexKey).sort().join('|');uniqueSurfaces.set(key,surface);
  }
  const sourceTriangles=[...uniqueSurfaces.values()].flatMap(surface=>{
    const rings=surface.rings.map(ring=>{
      const points=[...ring];
      if(points.length>1&&vertexKey(points[0]!)===vertexKey(points.at(-1)!))points.pop();
      return points;
    });
    return triangulateLod2Polygon(rings as Point3[][]) as Point3[][];
  });
  const sources=roofSources(envelope);
  const roofTriangles=sources.flatMap(source=>roofSurfaceTriangles(source.calculation));
  const sourceRoofAreaM2=sourceTriangles.reduce((sum,triangle)=>sum+triangleArea(triangle),0);
  const convertedRoofAreaM2=roofTriangles.reduce((sum,triangle)=>sum+triangleArea(triangle),0);
  const uniqueRoofTriangles=new Map<string,RoofTriangle>();
  roofTriangles.forEach(triangle=>uniqueRoofTriangles.set(triangle.map(vertexKey).sort().join('|'),triangle));
  const uniqueConvertedRoofAreaM2=[...uniqueRoofTriangles.values()].reduce((sum,triangle)=>sum+triangleArea(triangle),0);
  const duplicateRoofTriangleCount=roofTriangles.length-uniqueRoofTriangles.size;
  const roofSeamMismatches=roofSeamHeightMismatches([...uniqueRoofTriangles.values()]);
  const maximumRoofSeamHeightMismatchM=roofSeamMismatches[0]?.heightMismatchM??0;
  const roofSeamMismatchKeys=roofSeamMismatches.filter(value=>value.heightMismatchM>.03).map(value=>value.key).slice(0,50);
  const roofAreaError=Math.abs(uniqueConvertedRoofAreaM2-sourceRoofAreaM2);
  const roofAreaLimit=Math.max(.02,sourceRoofAreaM2*.001);
  if(roofAreaError>roofAreaLimit)issue('roof-area-loss',roofAreaError,roofAreaLimit,
    'Converted roof facets do not cover the complete classified RoofSurface area.');
  if(duplicateRoofTriangleCount)issue('roof-duplicate-facet',duplicateRoofTriangleCount,0,
    'A converted LoD2 roof facet is rendered by more than one editable roof zone.');
  if(maximumRoofSeamHeightMismatchM>.03)issue('roof-seam-height-mismatch',maximumRoofSeamHeightMismatchM,.03,
    'Roof facets sharing the same plan edge disagree in height. This is a multi-level edge candidate and requires a connecting wall or an intentional level change.',roofSeamMismatchKeys[0],'warning');

  let roofTriangleCount=0;
  for(const roof of envelope.converted.roofs){
    const rendered=createRoofCalculationMeshes(roof.metadata.roofCalculation,{mergeParts:false});
    for(const mesh of rendered.meshes.filter(value=>String(value.userData.roofPart).startsWith('tiles-'))){
      const topology=geometryTopology(mesh.geometry);roofTriangleCount+=topology.triangles;
      if(topology.nonFinite)issue('roof-non-finite',topology.nonFinite,0,'Roof mesh contains non-finite vertices.');
      if(topology.degenerate)issue('roof-degenerate-triangle',topology.degenerate,0,'Roof mesh contains zero-area triangles.');
      if(topology.openEdges)issue('roof-open-solid',topology.openEdges,0,'A rendered roof tile solid has open boundary edges.');
    }
    rendered.geometries.forEach(value=>value.dispose());rendered.materials.forEach(value=>value.dispose());
  }

  const size=16,groups=new Map<string,{x:number;y:number;z:number;cells:number[]}>();
  for(const [x,y,z] of envelope.converted.wallCells){
    const cx=Math.floor(x/size),cy=Math.floor(y/size),cz=Math.floor(z/size),key=`${cx}:${cy}:${cz}`;
    const group=groups.get(key)??{x:cx,y:cy,z:cz,cells:Array(size**3).fill(0)};
    const lx=x-cx*size,ly=y-cy*size,lz=z-cz*size;
    group.cells[lx+size*ly+size*size*lz]=1;groups.set(key,group);
  }
  const exactFacades=lod2BuildingBoundaryGrid(sources).filter(edge=>edge.exactFacade);
  const facadeBaseByBuilding=new Map<string,number>();
  for(const edge of exactFacades)facadeBaseByBuilding.set(edge.buildingId,Math.min(
    facadeBaseByBuilding.get(edge.buildingId)??Number.POSITIVE_INFINITY,
    ...edge.bottomProfile.map(value=>value[1]),
  ));
  const facadeRoofSeams:Lod2FacadeRoofSeamAudit[]=[];
  let minimumFacadeProfileHeightM=Number.POSITIVE_INFINITY;
  for(const edge of exactFacades){
    const buildingBase=facadeBaseByBuilding.get(edge.buildingId)??edge.minimumY;
    const groundFacade=edge.facadeRole==='exterior'||(edge.facadeRole==='source'
      &&Math.min(...edge.bottomProfile.map(value=>value[1]))<=buildingBase+.10);
    const knots=[0,edge.length,...edge.topProfile.map(value=>value[0]),...edge.bottomProfile.map(value=>value[0])];
    for(let column=0;column<=edge.divisions;column++)knots.push(column*edge.columnWidth);
    const ordered=[...new Set(knots.map(value=>Math.max(0,Math.min(edge.length,value))).map(value=>rounded(value)))]
      .sort((first,second)=>first-second);
    const samples=[...ordered];
    for(let index=0;index+1<ordered.length;index++)samples.push((ordered[index]!+ordered[index+1]!)/2);
    const levelTransitions=edge.topProfile.slice(0,-1).map((first,index)=>[first,edge.topProfile[index+1]!] as const)
      .filter(([first,second])=>second[0]-first[0]<=.01&&Math.abs(second[1]-first[1])>.03);
    const tangent:[number,number]=[(edge.end[0]-edge.start[0])/edge.length,(edge.end[1]-edge.start[1])/edge.length];
    const gaps:Array<{along:number;gap:number}>=[],missingAlongM:number[]=[];
    let missingRoofSampleCount=0,maximumWallAboveRoofM=0,maximumWallBelowRoofM=0;
    for(const along of samples.sort((first,second)=>first-second)){
      // A sub-centimetre plan interval with a large height change represents
      // an explicit vertical roof-level transition, not a sloped exterior
      // seam. Its artificial linear midpoint has no physical roof height and
      // must not be audited as a multi-metre wall wedge.
      if(levelTransitions.some(([first,second])=>along>first[0]+1e-8&&along<second[0]-1e-8))continue;
      const wallTop=lod2FacadeTopAt(edge,along),wallBottom=lod2FacadeBottomAt(edge,along);
      const x=edge.start[0]+tangent[0]*along,z=edge.start[1]+tangent[1]*along;
      // Multi-level LoD2 junction walls can have one roof plane on either
      // side. Probe symmetrically so the audit does not report an open seam
      // merely because the matching upper roof starts 8 cm across the line.
      const candidates=[0,.02,.08,-.02,-.08].flatMap(depth=>roofHeightsAt(
        x+edge.inward[0]*depth,z+edge.inward[1]*depth,[...uniqueRoofTriangles.values()],
      ));
      if(!candidates.length){missingRoofSampleCount+=1;missingAlongM.push(along);continue;}
      // Exterior walls must terminate at the roof with their upper profile.
      // Elevated WallSurfaces, however, are genuine level connectors: either
      // their upper or lower profile can be the adjoining roof seam. Comparing
      // those only against the top produced false errors for valid triangular
      // connectors and obscured the actual ground-facade defects.
      const roofY=[...candidates].sort((first,second)=>{
        const firstDistance=groundFacade?Math.abs(first-wallTop):Math.min(Math.abs(first-wallTop),Math.abs(first-wallBottom));
        const secondDistance=groundFacade?Math.abs(second-wallTop):Math.min(Math.abs(second-wallTop),Math.abs(second-wallBottom));
        return firstDistance-secondDistance;
      })[0]!;
      const seamY=groundFacade||Math.abs(wallTop-roofY)<=Math.abs(wallBottom-roofY)?wallTop:wallBottom;
      const gap=seamY-roofY;
      gaps.push({along,gap});
      maximumWallAboveRoofM=Math.max(maximumWallAboveRoofM,gap);
      maximumWallBelowRoofM=Math.max(maximumWallBelowRoofM,-gap);
    }
    const intervalMidpoints=ordered.slice(0,-1).map((start,index)=>(start+ordered[index+1]!)/2);
    const minimumInteriorHeightM=intervalMidpoints.reduce((minimum,along)=>Math.min(minimum,
      lod2FacadeTopAt(edge,along)-lod2FacadeBottomAt(edge,along)),Number.POSITIVE_INFINITY);
    minimumFacadeProfileHeightM=Math.min(minimumFacadeProfileHeightM,minimumInteriorHeightM);
    const maximumGap=gaps.reduce((best,value)=>Math.abs(value.gap)>Math.abs(best.gap)?value:best,{along:0,gap:0});
    const structuralGaps=gaps.filter(value=>value.along>.005&&value.along<edge.length-.005);
    const maximumStructuralGap=structuralGaps.reduce((best,value)=>Math.abs(value.gap)>Math.abs(best.gap)?value:best,
      {along:0,gap:0});
    const structuralMissingAlongM=missingAlongM.filter(along=>along>.005&&along<edge.length-.005);
    const maximumAbsoluteGapM=Math.abs(maximumGap.gap);
    const meanAbsoluteGapM=gaps.length?gaps.reduce((sum,value)=>sum+Math.abs(value.gap),0)/gaps.length:0;
    const facadeId=`${edge.buildingId}:${edge.edgeKey}`;
    facadeRoofSeams.push({facadeId,sampleCount:samples.length,missingRoofSampleCount,maximumAbsoluteGapM,
      meanAbsoluteGapM,maximumWallAboveRoofM,maximumWallBelowRoofM,missingAlongM,maximumGapAlongM:gaps.length?maximumGap.along:null});
    if(structuralMissingAlongM.length)issue('wall-roof-seam-uncovered',structuralMissingAlongM.length,0,
      `${structuralMissingAlongM.length} interior facade samples have no RoofSurface above the real wall interval.`,facadeId,
      groundFacade&&structuralMissingAlongM.length/samples.length>.10?'error':'warning');
    else if(missingRoofSampleCount)issue('wall-roof-seam-endpoint-uncovered',missingRoofSampleCount,0,
      'Only a zero-area facade endpoint has no adjacent RoofSurface; all real wall intervals are covered.',facadeId,'warning');
    if(Math.abs(maximumStructuralGap.gap)>.03)issue('wall-roof-seam-gap',Math.abs(maximumStructuralGap.gap),.03,
      `Wall top and independent RoofSurface differ by up to ${Math.abs(maximumStructuralGap.gap).toFixed(3)} m at facade position ${maximumStructuralGap.along.toFixed(3)} m.`,facadeId,
      groundFacade?'error':'warning');
    else if(maximumAbsoluteGapM>.03)issue('wall-roof-seam-endpoint',maximumAbsoluteGapM,.03,
      `A zero-area facade endpoint differs from the adjacent roof by ${maximumAbsoluteGapM.toFixed(3)} m; the real wall intervals are closed.`,facadeId,'warning');
    if(Number.isFinite(minimumInteriorHeightM)&&minimumInteriorHeightM<=.005)issue('wall-profile-inverted-or-zero',minimumInteriorHeightM,.005,
      'The facade has no positive vertical extent across at least one real interval between profile knots.',facadeId);
  }
  if(!Number.isFinite(minimumFacadeProfileHeightM))minimumFacadeProfileHeightM=0;
  const maximumWallRoofSeamGapM=facadeRoofSeams.reduce((maximum,seam)=>Math.max(maximum,seam.maximumAbsoluteGapM),0);
  const missingWallRoofSampleCount=facadeRoofSeams.reduce((sum,seam)=>sum+seam.missingRoofSampleCount,0);
  const expectedBodies=new Set<string>();
  for(const edge of exactFacades)for(let column=0;column<edge.divisions;column++){
    for(let y=Math.floor(edge.minimumY);y<Math.ceil(edge.maximumY);y++){
      if(!lod2FacadeVerticalIntervals(edge,column,y).length)continue;
      expectedBodies.add(`${edge.buildingId}:${edge.edgeKey}:${column}:${y}`);
    }
  }
  const renderedBodies=new Set<string>(),delegatedBodies=new Set<string>(),discardedBodies=new Set<string>(),duplicateBodies=new Set<string>();
  let alignedWallCellCount=0,retainedWorldGridCellCount=0,wallTriangleCount=0,unrepresented=0;
  const openWallEdgeKeys:string[]=[];
  for(const group of groups.values()){
    const input=runtimeChunk(group.x,group.y,group.z,group.cells,size);
    const caps=trimLod2WallCaps(input,sources);
    alignedWallCellCount+=caps.cappedCellIndices.length+caps.alignedCellIndices.length;
    retainedWorldGridCellCount+=caps.chunk.cells.filter(value=>value===1).length;
    unrepresented+=caps.unrepresentedCellIndices.length;
    for(const key of caps.renderedBodyKeys){if(renderedBodies.has(key))duplicateBodies.add(key);renderedBodies.add(key);}
    caps.delegatedBodyKeys.forEach(key=>delegatedBodies.add(key));
    caps.discardedBodyKeys.forEach(key=>discardedBodies.add(key));
    if(caps.geometry){
      const topology=geometryTopology(caps.geometry);wallTriangleCount+=topology.triangles;
      if(topology.nonFinite)issue('wall-non-finite',topology.nonFinite,0,'Wall replacement mesh contains non-finite vertices.');
      if(topology.degenerate)issue('wall-degenerate-triangle',topology.degenerate,0,'Wall replacement mesh contains zero-area triangles.');
      if(topology.openEdges)issue('wall-open-solid',topology.openEdges,0,'Wall replacement prisms have open boundary edges.');
      openWallEdgeKeys.push(...topology.openEdgeKeys.slice(0,25-openWallEdgeKeys.length));
      caps.geometry.dispose();
    }
  }
  const missingDelegates=[...delegatedBodies].filter(key=>!renderedBodies.has(key)).length;
  const missingBodies=[...expectedBodies].filter(key=>!renderedBodies.has(key));
  const missingStems=new Set(missingBodies.map(key=>key.replace(/:\d+:-?\d+$/,':')));
  const neighbouringRenderedWallBodyKeys=[...renderedBodies].filter(key=>[...missingStems].some(stem=>key.startsWith(stem))).slice(0,50);
  const discardedMissingWallBodyKeys=missingBodies.filter(key=>discardedBodies.has(key)).slice(0,25);
  const wallCellCount=envelope.converted.wallCells.length;
  const retainedLimit=Math.max(2,Math.ceil(wallCellCount*.01));
  if(retainedWorldGridCellCount>retainedLimit)issue('wall-not-building-aligned',retainedWorldGridCellCount,retainedLimit,
    'Too many imported wall voxels remain on the parcel/world grid.');
  if(unrepresented)issue('wall-disappeared',unrepresented,0,'Removed wall cells have neither a local nor delegated replacement body.');
  if(missingDelegates)issue('wall-owner-missing',missingDelegates,0,'Delegated facade bodies were not rendered by their deterministic owner chunk.');
  if(missingBodies.length)issue('wall-body-missing',missingBodies.length,0,'Expected LoD2 facade columns are absent from the rendered wall envelope.');
  if(duplicateBodies.size)issue('wall-body-duplicate',duplicateBodies.size,0,'Facade bodies are rendered by more than one chunk.');

  return {status:issues.some(value=>value.severity==='error')?'fail':issues.length?'warning':'pass',issues,
    sourceRoofAreaM2,convertedRoofAreaM2,uniqueConvertedRoofAreaM2,
    duplicateRoofTriangleCount,wallCellCount,
    alignedWallCellCount,retainedWorldGridCellCount,renderedWallBodyCount:renderedBodies.size,
    expectedWallBodyCount:expectedBodies.size,missingWallBodyCount:missingBodies.length,missingWallBodyKeys:missingBodies.slice(0,25),
    neighbouringRenderedWallBodyKeys,
    discardedMissingWallBodyKeys,
    delegatedWallBodyCount:delegatedBodies.size,roofTriangleCount,wallTriangleCount,openWallEdgeKeys,
    wallSurfaces,facadeRoofSeams,maximumSourceWallLeanM,maximumSourceWallPlaneTiltDegrees,maximumWallGroundOffsetM,
    maximumWallRoofSeamGapM,missingWallRoofSampleCount,maximumRoofSeamHeightMismatchM,roofSeamMismatchKeys,
    minimumFacadeProfileHeightM};
}
