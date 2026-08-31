import type { ChunkRegistryHandle } from '../runtime/world/chunk_registry';
import type { RuntimeChunkContent } from '../runtime/world/chunk_content';
import type { SemanticChunkObjectRef } from './scene_runtime';

/** One spatial rebuild per content revision, instead of N full registry scans.
 * Store raw refs, resolving optimistic calculation overrides at query time.
 */
export function createLod2RoofIndex(readRefs:(chunk:RuntimeChunkContent)=>readonly SemanticChunkObjectRef[]) {
  let revision=-1;
  let owner:ChunkRegistryHandle|null=null;
  let builds=0;
  const columns=new Map<string,{ref:SemanticChunkObjectRef;revision:RuntimeChunkContent['chunkRevision']}[]>();
  return {
    query(registry:ChunkRegistryHandle,chunk:RuntimeChunkContent) {
      if(!chunk.paletteByBlockTypeId.has('lod2_exterior_wall'))return [];
      const next=registry.getContentRevision();
      if(owner!==registry || revision!==next) {
        owner=registry;revision=next;columns.clear();builds++;
        const authoritative=new Map<string,{ref:SemanticChunkObjectRef;chunk:RuntimeChunkContent}>();
        for(const key of registry.getChunkKeys()) {
          const other=registry.getChunk(key);
          if(!other?.raw.objectRefs.length)continue;
          for(const ref of readRefs(other)) {
            if(ref.objectTypeId!=='building_roof' || !ref.metadata.lod2BuildingId)continue;
            if(!authoritative.has(ref.objectInstanceId) || ref.primaryChunkKey===other.chunkKey)
              authoritative.set(ref.objectInstanceId,{ref,chunk:other});
          }
        }
        for(const {ref,chunk:other} of authoritative.values()) {
            const size=other.chunkSize;
            const points=Array.isArray(ref.footprint?.coordinates)
              ? (ref.footprint.coordinates as unknown[][]).flat().filter((p):p is number[]=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite)) : [];
            const minX=points.length?Math.min(...points.map(p=>p[0]!)):ref.anchor.x;
            const minZ=points.length?Math.min(...points.map(p=>p[1]!)):ref.anchor.z;
            const maxX=points.length?Math.max(...points.map(p=>p[0]!)):ref.anchor.x+ref.dimensions.x;
            const maxZ=points.length?Math.max(...points.map(p=>p[1]!)):ref.anchor.z+ref.dimensions.z;
            const x0=Math.floor(minX/size),z0=Math.floor(minZ/size),x1=Math.floor(maxX/size),z1=Math.floor(maxZ/size);
            if(![x0,x1,z0,z1].every(Number.isFinite) || (x1-x0+1)*(z1-z0+1)>4096)continue;
            for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++) {
              const column=`${size}:${x}:${z}`,items=columns.get(column)??[];
              items.push({ref,revision:other.chunkRevision});columns.set(column,items);
            }
        }
      }
      return columns.get(`${chunk.chunkSize}:${chunk.chunkX}:${chunk.chunkZ}`)??[];
    },
    getBuildCount:()=>builds,
  };
}
