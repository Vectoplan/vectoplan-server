import * as THREE from "three";

export type RoofPoint = readonly [number, number, number]; // world x/y/z, metres
export type RoofTriangle = readonly [RoofPoint, RoofPoint, RoofPoint];
const cache = new WeakMap<object, {key:string; triangles:readonly RoofTriangle[]}>();

export function roofSurfaceTriangles(value: unknown): readonly RoofTriangle[] {
  if (!value || typeof value !== 'object') return [];
  const calculation=value as Record<string,any>;
  const key=String(calculation.input_fingerprint??calculation.calculation_id??'');
  if(key && cache.get(value)?.key===key) return cache.get(value)!.triangles;
  const triangles:RoofTriangle[]=[];
  const seen=new Set<string>();
  for(const face of (calculation.geometry?.faces??[]).slice(0,8192)) {
    const points:RoofPoint[]=(face?.polygon_3d_mm??[]).map((p:unknown)=>Array.isArray(p) && p.length>=3 && p.every(Number.isFinite)
      ? [p[0]/1000,p[2]/1000,p[1]/1000] as RoofPoint : null).filter(Boolean);
    for(let i=1;i<points.length-1;i++) {
      const triangle=[points[0]!,points[i]!,points[i+1]!] as const;
      const id=triangle.map(p=>p.map(v=>v.toFixed(6)).join(':')).sort().join('|');
      if(seen.has(id))continue;seen.add(id);triangles.push(triangle);
    }
  }
  if(key)cache.set(value,{key,triangles});
  return triangles;
}

export function heightOnRoof(triangles:readonly RoofTriangle[],x:number,z:number,nearY=Infinity):number|null {
  let result:number|null=null;
  for(const [a,b,c] of triangles) {
    const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(denominator)<1e-10)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator;
    if(u<-.00001 || v<-.00001 || u+v>1.00001)continue;
    const y=u*a[1]+v*b[1]+(1-u-v)*c[1];
    if(result===null || (Number.isFinite(nearY)? Math.abs(y-nearY)<Math.abs(result-nearY):y>result))result=y;
  }
  return result;
}

/** Use an interior point of an actual facet, never the plan centroid of a courtyard. */
export function roofSurfaceMarker(triangles:readonly RoofTriangle[]):THREE.Vector3|null {
  let best:RoofTriangle|null=null,area=0;
  for(const triangle of triangles) {
    const [a,b,c]=triangle;
    const next=Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]));
    if(next>area){area=next;best=triangle;}
  }
  return best?new THREE.Vector3(...[0,1,2].map(i=>(best![0][i]!+best![1][i]!+best![2][i]!)/3) as [number,number,number]):null;
}

export function createRoofSurfaceHighlight(calculation:unknown,color=0xfbbf24):THREE.Group|null {
  const triangles=roofSurfaceTriangles(calculation);
  if(!triangles.length)return null;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flatMap(t=>t.flatMap(([x,y,z])=>[x,y+.045,z])),3));
  const group=new THREE.Group();
  const fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.14,
    depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  fill.renderOrder=84;group.add(fill);
  const lines=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,1),new THREE.LineBasicMaterial({color,
    depthTest:true,transparent:true,opacity:.9,depthWrite:false}));
  lines.renderOrder=96;group.add(lines);
  return group;
}
