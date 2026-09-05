import * as THREE from 'three';
import type { RuntimeChunkContent } from '@runtime/world/chunk_content';
import { terrainCellShape, terrainCellTriangles } from '@runtime/world/terrain_surface';

export function trimTerrainSurfaceCells(chunk: RuntimeChunkContent): {
  chunk: RuntimeChunkContent;
  surfaces: readonly {cellValue:number;geometry:THREE.BufferGeometry}[];
} {
  if (!chunk.raw.metadata?.terrainSurface) return {chunk,surfaces:[]};
  const byValue=new Map<number,number[]>();
  let cells: number[] | null=null;
  const size=chunk.chunkSize,scale=chunk.cellSize;
  for(let z=0;z<size;z++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const shape=terrainCellShape(chunk,x,y,z);
    if(!shape) continue;
    const index=x+size*(y+size*z),cellValue=Number(chunk.cells[index]);
    cells ??= Array.from(chunk.cells);
    cells[index]=0;
    let positions=byValue.get(cellValue);
    if(!positions) {positions=[];byValue.set(cellValue,positions);}
    for(const triangle of terrainCellTriangles(shape)) {
      for(const p of triangle.points) positions.push(p.x*scale,p.y*scale,p.z*scale);
    }
  }
  const surfaces=[...byValue].map(([cellValue,positions])=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2]]:[]),2));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return {cellValue,geometry};
  });
  return {chunk:cells?{...chunk,cells}:chunk,surfaces};
}
