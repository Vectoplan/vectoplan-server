import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {
  lod2BuildingBoundaryGrid,
  lod2FacadeBottomAt,
  lod2FacadeTopAt,
  lod2FacadeVerticalIntervals,
  trimLod2WallCaps,
} from '../src/frontend/scene/lod2_wall_caps';
import {roofSurfaceTriangles, type RoofTriangle} from '../src/frontend/scene/roof_surface_geometry';

const fixture=JSON.parse(readFileSync(resolve('tests/fixtures/berlin_parcel_grid_samples.json'),'utf8'));
const sampleId=process.env.BERLIN_GRID_SAMPLE??'berlin-02';
const sample=fixture.samples.find((value:any)=>value.sampleId===sampleId);
if(!sample)throw new Error(`Unknown sample ${sampleId}`);
const sources=sample.envelope.converted.roofs.map((roof:any)=>{
  const imported=roof.metadata.roofParameters.importedSource;
  return {buildingId:sample.envelope.buildingId,calculation:roof.metadata.roofCalculation,
    facadeSegments:imported.facadeSegments,repairFacadeRoofSeams:imported.facadeProfileMode==='roof-clamped-v1'};
});
const filter=process.env.FACADE_FILTER??'';
const inspectedEdges=lod2BuildingBoundaryGrid(sources).filter(edge=>!filter||edge.edgeKey.includes(filter));
console.log(JSON.stringify(inspectedEdges,null,2));

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

if(process.env.INSPECT_SEAM==='1'){
  const triangles=sources.flatMap(source=>roofSurfaceTriangles(source.calculation));
  for(const edge of inspectedEdges){
    const tangent=[(edge.end[0]-edge.start[0])/edge.length,(edge.end[1]-edge.start[1])/edge.length] as const;
    const samples=[...new Set([0,edge.length,...edge.topProfile.map(value=>value[0]),
      ...edge.bottomProfile.map(value=>value[0]),...Array.from({length:edge.divisions},(_,column)=>(column+.5)*edge.columnWidth)])]
      .sort((a,b)=>a-b);
    console.log(JSON.stringify({seam:edge.edgeKey,samples:samples.map(along=>{
      const x=edge.start[0]+tangent[0]*along,z=edge.start[1]+tangent[1]*along;
      const roofs=[...new Set([0,.02,.08,-.02,-.08].flatMap(depth=>roofHeightsAt(
        x+edge.inward[0]*depth,z+edge.inward[1]*depth,triangles,
      )).map(value=>Math.round(value*1e6)/1e6))].sort((a,b)=>a-b);
      const top=lod2FacadeTopAt(edge,along),bottom=lod2FacadeBottomAt(edge,along);
      return {along:Math.round(along*1e6)/1e6,top,bottom,roofs,
        topGap:roofs.length?Math.min(...roofs.map(value=>Math.abs(value-top))):null,
        bottomGap:roofs.length?Math.min(...roofs.map(value=>Math.abs(value-bottom))):null};
    })},null,2));
  }
}

if(process.env.INSPECT_WALL_BODIES==='1'){
  const size=16,groups=new Map<string,{x:number;y:number;z:number;cells:number[]}>();
  for(const [x,y,z] of sample.envelope.converted.wallCells){
    const cx=Math.floor(x/size),cy=Math.floor(y/size),cz=Math.floor(z/size),key=`${cx}:${cy}:${cz}`;
    const group=groups.get(key)??{x:cx,y:cy,z:cz,cells:Array(size**3).fill(0)};
    group.cells[(x-cx*size)+size*(y-cy*size)+size*size*(z-cz*size)]=1;groups.set(key,group);
  }
  const keys:string[]=[],ownerChunks=new Set<string>();
  const sourceCells=new Set<string>(sample.envelope.converted.wallCells.map(
    ([x,y,z]:readonly [number,number,number])=>`${x}:${y}:${z}`,
  ));
  for(const edge of inspectedEdges)for(let column=0;column<edge.divisions;column++){
    for(let y=Math.floor(edge.minimumY);y<Math.ceil(edge.maximumY);y++){
      const active=lod2FacadeVerticalIntervals(edge,column,y);
      if(!active.length)continue;
      const interval=[...active].sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])||a[0]-b[0])[0]!;
      const along=(interval[0]+interval[1])/2;
      const x=edge.start[0]+(edge.end[0]-edge.start[0])*along/edge.length;
      const z=edge.start[1]+(edge.end[1]-edge.start[1])*along/edge.length;
      const cell=[Math.floor(x+1e-7),y,Math.floor(z+1e-7)] as const;
      ownerChunks.add(`${Math.floor(cell[0]/size)}:${Math.floor(y/size)}:${Math.floor(cell[2]/size)}`);
      if(process.env.INSPECT_OWNERS==='1')console.log(JSON.stringify({edge:edge.edgeKey,column,y,active,along,
        ownerCell:cell,sourceOwned:sourceCells.has(cell.join(':'))},null,2));
    }
  }
  for(const group of groups.values()){
    const palette={blockTypeId:'lod2_exterior_wall',cellValue:1,solid:true,opaque:true,placeable:true,breakable:true,
      selectable:true,collidable:true,label:'LoD2 wall'};
    const chunk:any={chunkKey:`${group.x}:${group.y}:${group.z}`,chunkX:group.x,chunkY:group.y,chunkZ:group.z,
      chunkSize:size,cellSize:1,cells:group.cells,palette:[palette],paletteByCellValue:new Map([[1,palette]]),
      paletteByBlockTypeId:new Map([[palette.blockTypeId,palette]])};
    const caps=trimLod2WallCaps(chunk,sources);
    keys.push(...caps.renderedBodyKeys,...caps.delegatedBodyKeys.map(value=>`delegated:${value}`),
      ...caps.discardedBodyKeys.map(value=>`discarded:${value}`));
    if(ownerChunks.has(chunk.chunkKey))console.log(JSON.stringify({chunk:chunk.chunkKey,
      sourceCells:group.cells.filter(value=>value===1).length,
      keys:[...caps.renderedBodyKeys,...caps.delegatedBodyKeys,...caps.discardedBodyKeys]
        .filter(key=>!filter||key.includes(filter))},null,2));
    caps.geometry?.dispose();
  }
  console.log(JSON.stringify(keys.filter(key=>!filter||key.includes(filter)),null,2));
}
