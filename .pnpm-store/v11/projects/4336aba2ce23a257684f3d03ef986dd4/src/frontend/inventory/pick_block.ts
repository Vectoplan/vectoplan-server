type RecordValue=Readonly<Record<string,unknown>>;
const record=(v:unknown):RecordValue=>v && typeof v==='object' && !Array.isArray(v)?v as RecordValue:{};
const text=(...values:unknown[])=>values.find(v=>typeof v==='string' && v.trim()) as string|undefined;

/** Resolve the actual targeted material, never the current held item's variant. */
export function pickBlockInventoryItem(blockTypeId:string,label:string,metadata:unknown,objectMetadata?:unknown):RecordValue|null {
  if(!blockTypeId || /^(air$|system_air$|generator_|biome_|debug_|bedrock|water)/.test(blockTypeId))return null;
  const meta=record(metadata),object=record(objectMetadata);
  const context=record(object.libraryPlacementContext??object.libraryContext??meta.library);
  const ref=record(context.libraryRef);
  const lod2=blockTypeId==='lod2_exterior_wall';
  const terrain=blockTypeId==='system_terrain';
  const family=text(context.familyId,ref.familyId,lod2?'vp.hochbau.waende.lod2_aussenwand':terrain?'system_terrain':undefined);
  const uid=text(context.vplibUid,ref.vplibUid);
  if(!family && !uid)return null;
  const packageId=text(context.packageId,ref.packageId,lod2?'vplib.vp.hochbau.waende.lod2_aussenwand':terrain?'vectoplan.system.terrain':undefined);
  const variant=text(context.variantId,ref.variantId)??'default';
  return {
    family_id:family,package_id:packageId,vplib_uid:uid,
    variant_id:variant,label:label||text(context.label)||blockTypeId,
    object_kind:text(context.objectKind,ref.objectKind)??'cell_block',
    runtimeBlockTypeId:blockTypeId,blockTypeId,
    placement:{...record(context.placementCommand),kind:text(record(context.placementCommand).kind)??'SetBlock',blockTypeId,runtimeBlockTypeId:blockTypeId,placeable:true},
    semantic_profile:context.semanticProfile,
    metadata:{source:'editor-pick-block',dimensionsMm:lod2?[1000,1000,1000]:undefined},
  };
}

export function postPickedBlockToInventory(root:HTMLElement,item:RecordValue,zeroBasedSlot:number):boolean {
  if(!Number.isInteger(zeroBasedSlot)||zeroBasedSlot<0||zeroBasedSlot>8)return false;
  const frame=root.querySelector<HTMLIFrameElement>('[data-user-inventory-frame]');
  if(!frame?.contentWindow)return false;
  const origin=new URL(frame.src,window.location.href).origin;
  frame.contentWindow.postMessage({source:'vectoplan-editor',type:'vectoplan:user-inventory-set-slot',
    detail:{item,slotIndex:zeroBasedSlot+1,select:true,persist:true,source:'editor-pick-block'}},origin);
  return true;
}
