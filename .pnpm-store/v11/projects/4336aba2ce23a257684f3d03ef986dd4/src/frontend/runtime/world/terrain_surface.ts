import type { RuntimeChunkContent } from './chunk_content';

/** Canonical continuous surface; cells keep their ordinary editable addresses. */
export interface TerrainCellShape {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** SW, SE, NE, NW, in world cell coordinates. */
  readonly heights: readonly [number, number, number, number];
}
export interface TerrainPoint { readonly x: number; readonly y: number; readonly z: number; }
export interface TerrainTriangle { readonly points: readonly [TerrainPoint, TerrainPoint, TerrainPoint]; }
const EPS = 1e-7;

export function terrainCellShape(chunk: RuntimeChunkContent, x: number, y: number, z: number): TerrainCellShape | null {
  const index = x + chunk.chunkSize * (y + chunk.chunkSize * z);
  const value = Number(chunk.cells[index] ?? 0);
  if (value <= 0 || !chunk.paletteByCellValue.get(value)?.blockTypeId.startsWith('system_terrain')) return null;
  const shape = chunk.raw.metadata?.terrainSurface as { schemaVersion?: string; cornerHeights?: readonly number[]; fullCellIndices?: readonly number[] } | undefined;
  if (shape?.schemaVersion !== 'terrain-cut-cells.v1' || shape.fullCellIndices?.includes(index)) return null;
  const stride = chunk.chunkSize + 1;
  const corners = shape.cornerHeights;
  if (!corners || corners.length !== stride * stride) return null;
  const heights: [number, number, number, number] = [corners[x + stride*z], corners[x+1 + stride*z], corners[x+1 + stride*(z+1)], corners[x + stride*(z+1)]];
  if (!heights.every(Number.isFinite)) return null;
  const worldY = chunk.chunkY * chunk.chunkSize + y;
  if (Math.min(...heights) >= worldY + 1 - EPS) return null;
  return { x: chunk.chunkX * chunk.chunkSize + x, y: worldY, z: chunk.chunkZ * chunk.chunkSize + z, heights };
}

/** The same two planes are used by rendering, picking and player collision. */
export function terrainHeightAt(shape: TerrainCellShape, x: number, z: number): number {
  const u = Math.max(0, Math.min(1, x - shape.x));
  const v = Math.max(0, Math.min(1, z - shape.z));
  const [a,b,c,d] = shape.heights;
  return u >= v ? a + (b-a)*u + (c-b)*v : a + (c-d)*u + (d-a)*v;
}

function clip(points: readonly TerrainPoint[], distance: (p: TerrainPoint) => number): TerrainPoint[] {
  const out: TerrainPoint[] = [];
  for (let i=0; i<points.length; i++) {
    const a=points[i], b=points[(i+1)%points.length], da=distance(a), db=distance(b);
    if (da >= -EPS) out.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t=da/(da-db);
      out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    }
  }
  return out;
}

export function terrainCellTriangles(shape: TerrainCellShape): TerrainTriangle[] {
  const {x,y,z,heights:h}=shape;
  const top = [{x,y:h[0],z},{x:x+1,y:h[1],z},{x:x+1,y:h[2],z:z+1},{x,y:h[3],z:z+1}];
  const triangles: TerrainTriangle[]=[];
  function emit(poly: readonly TerrainPoint[], reverse=false): void {
    for(let i=1;i+1<poly.length;i++) {
      const points: [TerrainPoint,TerrainPoint,TerrainPoint] = reverse ? [poly[0],poly[i+1],poly[i]] : [poly[0],poly[i],poly[i+1]];
      const [a,b,c]=points;
      const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
      if (Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>EPS) triangles.push({points});
    }
  }
  for (const ids of [[0,1,2],[0,2,3]]) {
    const poly=ids.map(i=>top[i]);
    // XZ winding points down. Reverse the top faces.
    emit(clip(clip(poly,p=>p.y-y),p=>y+1-p.y),true);
    emit(clip(poly,p=>p.y-y-1).map(p=>({...p,y:y+1})),true);
    emit(clip(poly,p=>p.y-y).map(p=>({...p,y})));
  }
  for(let i=0;i<4;i++) {
    let a=top[i],b=top[(i+1)%4];
    if(a.y<=y+EPS&&b.y<=y+EPS) continue;
    // Trim the height edge at the cell floor before constructing its vertical
    // side. Otherwise a low endpoint below the floor makes a bow-tie polygon;
    // triangulating it produces the standing triangular fins seen on steep DGM.
    if(a.y<y) {
      const t=(y-a.y)/(b.y-a.y);
      a={x:a.x+(b.x-a.x)*t,y,z:a.z+(b.z-a.z)*t};
    }
    if(b.y<y) {
      const t=(y-b.y)/(a.y-b.y);
      b={x:b.x+(a.x-b.x)*t,y,z:b.z+(a.z-b.z)*t};
    }
    emit(clip([a,b,{...b,y},{...a,y}],p=>y+1-p.y));
  }
  return triangles;
}

export function intersectTerrainCell(shape: TerrainCellShape, origin: TerrainPoint, direction: TerrainPoint, minDistance: number, maxDistance: number): {distance:number; normal:TerrainPoint} | null {
  let nearest: {distance:number; normal:TerrainPoint} | null=null;
  for(const {points:[a,b,c]} of terrainCellTriangles(shape)) {
    const e1={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},e2={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
    const p={x:direction.y*e2.z-direction.z*e2.y,y:direction.z*e2.x-direction.x*e2.z,z:direction.x*e2.y-direction.y*e2.x};
    const det=e1.x*p.x+e1.y*p.y+e1.z*p.z;
    if(Math.abs(det)<EPS) continue;
    const t={x:origin.x-a.x,y:origin.y-a.y,z:origin.z-a.z};
    const u=(t.x*p.x+t.y*p.y+t.z*p.z)/det;
    if(u < -EPS || u > 1+EPS) continue;
    const q={x:t.y*e1.z-t.z*e1.y,y:t.z*e1.x-t.x*e1.z,z:t.x*e1.y-t.y*e1.x};
    const v=(direction.x*q.x+direction.y*q.y+direction.z*q.z)/det;
    if(v < -EPS || u+v > 1+EPS) continue;
    const distance=(e2.x*q.x+e2.y*q.y+e2.z*q.z)/det;
    if(distance < minDistance-EPS || distance > maxDistance+EPS || (nearest && distance>=nearest.distance)) continue;
    const nx=e1.y*e2.z-e1.z*e2.y,ny=e1.z*e2.x-e1.x*e2.z,nz=e1.x*e2.y-e1.y*e2.x, length=Math.hypot(nx,ny,nz);
    nearest={distance:Math.max(0,distance),normal:{x:nx/length,y:ny/length,z:nz/length}};
  }
  return nearest;
}

export function terrainBlockingBounds(shape: TerrainCellShape, query: {min:TerrainPoint;max:TerrainPoint}): {min:TerrainPoint;max:TerrainPoint} | null {
  const minX=Math.max(shape.x,query.min.x),maxX=Math.min(shape.x+1,query.max.x);
  const minZ=Math.max(shape.z,query.min.z),maxZ=Math.min(shape.z+1,query.max.z);
  if(minX>=maxX || minZ>=maxZ) return null;
  const points=[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
  // Include intersections with the diagonal where the two height planes meet.
  for(const x of [minX,maxX]) { const z=shape.z+x-shape.x; if(z>=minZ && z<=maxZ) points.push([x,z]); }
  for(const z of [minZ,maxZ]) { const x=shape.x+z-shape.z; if(x>=minX && x<=maxX) points.push([x,z]); }
  const maxY=Math.min(shape.y+1,Math.max(...points.map(([x,z])=>terrainHeightAt(shape,x,z))));
  if(maxY<=shape.y+EPS) return null;
  return {min:{x:shape.x,y:shape.y,z:shape.z},max:{x:shape.x+1,y:maxY,z:shape.z+1}};
}
