type Cell = Readonly<{x:number;y:number;z:number}>;
/** Only six touching cells, never a building-sized scan on the input path. */
export function touchesLod2Wall(p:Cell, read:(p:Cell)=>string|null|undefined):boolean {
  return [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].some(([x,y,z])=>
    read({x:p.x+x!,y:p.y+y!,z:p.z+z!})==='lod2_exterior_wall');
}
export function fixedWorldCellPlacement(p:Cell) {
  return {kind:'parcel-grid-prism.v1' as const,anchorPosition:{...p},occupiedCells:[{...p}],mergeKey:`world-cell:${p.x}:${p.y}:${p.z}`,
    footprint:{type:'Polygon',coordinateSpace:'world-cell-xz',gridAlignment:'world-cell',baseY:p.y,height:1,
      coordinates:[[[p.x,p.z],[p.x+1,p.z],[p.x+1,p.z+1],[p.x,p.z+1],[p.x,p.z]]]}};
}
