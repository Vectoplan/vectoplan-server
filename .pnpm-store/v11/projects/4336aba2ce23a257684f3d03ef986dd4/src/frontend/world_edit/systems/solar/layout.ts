import * as THREE from 'three';
import { roofSurfaceTriangles, type RoofTriangle } from '../../../scene/roof_surface_geometry';

export interface SolarModule {
  packageId:string; revision:string; label:string;
  widthM:number; lengthM:number; thicknessM:number; powerWp:number;
  variantId?:string; sourceUrl?:string;
}
export interface SolarSettings {
  schemaVersion:'vplib-roof-solar.v1'; module:SolarModule|null;
  selectedFaces:string[]; targetAreaM2:number|null; edgeMarginM:number; gapM:number;
  faceLayouts:Record<string,'portrait'|'landscape'>;
  faceAzimuthDeg:Record<string,number>;
  flatAzimuthDeg:number; flatTiltDeg:number; systemLossPercent:number;
  electricityPriceEurPerKwh:number; selfConsumptionPercent:number;
  metricScale:{x:number;y:number;z:number};
}
export interface SolarFace {
  id:string; triangles:readonly RoofTriangle[]; normal:THREE.Vector3;
  azimuthDeg:number; tiltDeg:number; areaM2:number;
}
export interface SolarPanelPose {
  center:THREE.Vector3; u:THREE.Vector3; v:THREE.Vector3; normal:THREE.Vector3; faceId:string;
  widthM:number; lengthM:number; layout:'portrait'|'landscape';
}
export interface SolarLayout {
  panels:SolarPanelPose[]; faces:SolarFace[]; powerKwp:number; occupiedAreaM2:number; selectedAreaM2:number;
  availableAreaM2:number; availablePanelCount:number; truncated:boolean;
  groups:{faceId:string;azimuthDeg:number;tiltDeg:number;count:number;powerKwp:number}[];
}
export interface SolarDailyEconomics {
  dailyKwh:number; selfConsumedKwh:number; exportedKwh:number;
  dailyEnergyValueEur:number; dailySavingsEur:number;
  feedInRateEurPerKwh:number|null; dailyFeedInRevenueEur:number|null; dailyBenefitEur:number|null;
  compensationModel:'feed_in_tariff'|'direct_marketing'|'tender_required';
  seasonal?:{
    summer:SolarPeriodEconomics;
    winter:SolarPeriodEconomics;
  };
}
export interface SolarPeriodEconomics {
  months:number[]; days:number; totalKwh:number;
  dailyKwh:number; selfConsumedKwh:number; exportedKwh:number;
  dailySavingsEur:number; dailyFeedInRevenueEur:number|null; dailyBenefitEur:number|null;
}
const clamp=(v:unknown,fallback:number,min:number,max:number)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export const compassAzimuth=(x:number,z:number)=>((Math.atan2(x,z)*180/Math.PI)%360+360)%360;
const wrap=(v:number)=>(v%360+360)%360;
export const automaticFlatSolarAzimuth=(latitude:unknown)=>Number.isFinite(Number(latitude))&&Number(latitude)<0?0:180;

export function normalizeSolarTargetArea(value:unknown,maximum=1_000_000):number {
  const max=Number.isFinite(maximum)?Math.max(0,maximum):1_000_000;
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return 0;
  return Math.round(Math.max(0,Math.min(max,numeric))*10)/10;
}

export function solarTargetAreaFromWheel(current:unknown,deltaY:unknown,maximum=1_000_000):number {
  const normalized=normalizeSolarTargetArea(current,maximum);
  const delta=Number(deltaY);
  if(!Number.isFinite(delta)||delta===0)return normalized;
  return normalizeSolarTargetArea(normalized+(delta<0?1:-1),maximum);
}

/** Local WGS84 tangent metric of the shared periodic equirectangular frame.
 * A world cell is NOT one geodetic metre east/west at every latitude.
 */
export function solarMetricScale(frame:{worldWidthCells:number;worldHeightCells:number;metersPerCell:number},latitude:number) {
  const phi=latitude*Math.PI/180,e2=6.6943799901413165e-3,a=6378137;
  const d=1-e2*Math.sin(phi)**2;
  const x=2*Math.PI*a*Math.cos(phi)/Math.sqrt(d)/frame.worldWidthCells;
  const z=Math.PI*a*(1-e2)/d**1.5/frame.worldHeightCells;
  if(![x,z,frame.metersPerCell].every(v=>Number.isFinite(v)&&v>1e-6))return null;
  return {x,y:frame.metersPerCell,z};
}

export function normalizeSolarSettings(value:unknown):SolarSettings {
  const raw=value && typeof value==='object'?value as Record<string,any>:{};
  const m=raw.module;
  const module:SolarModule|null=m && typeof m.packageId==='string' && [m.widthM,m.lengthM,m.thicknessM,m.powerWp].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)
    ?{packageId:m.packageId,revision:String(m.revision??''),label:String(m.label??'PV-Modul'),
      widthM:clamp(m.widthM,1,.2,3),lengthM:clamp(m.lengthM,1,.2,4),thicknessM:clamp(m.thicknessM,.035,.01,.2),powerWp:clamp(m.powerWp,450,1,1500),
      ...(typeof m.variantId==='string'?{variantId:m.variantId}:{}),...(typeof m.sourceUrl==='string'?{sourceUrl:m.sourceUrl}:{})}:null;
  const faceLayouts=Object.fromEntries(Object.entries(raw.faceLayouts??{}).filter(([key,value])=>
    key.length>0&&(value==='portrait'||value==='landscape')).slice(0,128)) as Record<string,'portrait'|'landscape'>;
  const faceAzimuthDeg=Object.fromEntries(Object.entries(raw.faceAzimuthDeg??{}).filter(([key,value])=>
    key.length>0&&Number.isFinite(Number(value))).slice(0,128).map(([key,value])=>[key,wrap(clamp(value,180,0,360))]));
  return {schemaVersion:'vplib-roof-solar.v1',module,
    selectedFaces:Array.isArray(raw.selectedFaces)?raw.selectedFaces.filter((s:unknown)=>typeof s==='string').slice(0,128):[],
    targetAreaM2:raw.targetAreaM2===null||raw.targetAreaM2===undefined?null:clamp(raw.targetAreaM2,0,0,1_000_000),
    faceLayouts,faceAzimuthDeg,
    edgeMarginM:clamp(raw.edgeMarginM,.3,0,5),gapM:clamp(raw.gapM,.02,.02,5),
    flatAzimuthDeg:wrap(clamp(raw.flatAzimuthDeg,180,0,360)),flatTiltDeg:clamp(raw.flatTiltDeg,10,0,45),
    systemLossPercent:clamp(raw.systemLossPercent,14,0,50),
    electricityPriceEurPerKwh:clamp(raw.electricityPriceEurPerKwh,.3869,0,5),
    selfConsumptionPercent:clamp(raw.selfConsumptionPercent,30,0,100),
    metricScale:{x:clamp(raw.metricScale?.x,1,1e-6,1000),y:clamp(raw.metricScale?.y,1,1e-6,1000),z:clamp(raw.metricScale?.z,1,1e-6,1000)}};
}

const weightedRate=(powerKwp:number,tiers:readonly (readonly [number,number])[])=>{
  let remaining=powerKwp,previous=0,value=0;
  for(const [limit,rate] of tiers){const amount=Math.max(0,Math.min(remaining,limit-previous));value+=amount*rate;remaining-=amount;previous=limit;if(remaining<=1e-9)break;}
  return remaining>1e-9||powerKwp<=0?null:value/powerKwp;
};

/** German rooftop-PV EEG values valid for commissioning 2026-08-01–2027-01-31.
 * Up to 100 kWp this is the fixed surplus feed-in tariff; larger systems use
 * the published direct-marketing value. Above 1 MW no generic value is safe.
 */
export function solarFeedInRate(powerKwp:unknown) {
  const power=clamp(powerKwp,0,0,100_000);
  if(power<=100)return {rate:weightedRate(power,[[10,.0770],[40,.0666],[100,.0544]]),model:'feed_in_tariff' as const};
  if(power<=1000)return {rate:weightedRate(power,[[10,.0810],[40,.0706],[100,.0584],[400,.0584],[1000,.0584]]),model:'direct_marketing' as const};
  return {rate:null,model:'tender_required' as const};
}

export function solarDailyEconomics(annualKwh:unknown,electricityPriceEurPerKwh=.3869,selfConsumptionPercent=30,powerKwp:unknown=0):SolarDailyEconomics {
  const annual=clamp(annualKwh,0,0,1e12),price=clamp(electricityPriceEurPerKwh,.3869,0,5),share=clamp(selfConsumptionPercent,30,0,100)/100;
  const dailyKwh=annual/365;
  const rounded=(value:number)=>Math.round(value*10_000)/10_000;
  const selfConsumedKwh=dailyKwh*share,exportedKwh=dailyKwh-selfConsumedKwh,savings=selfConsumedKwh*price;
  const compensation=solarFeedInRate(powerKwp),feedInRevenue=compensation.rate===null?null:exportedKwh*compensation.rate;
  return {dailyKwh:rounded(dailyKwh),selfConsumedKwh:rounded(selfConsumedKwh),exportedKwh:rounded(exportedKwh),
    dailyEnergyValueEur:rounded(dailyKwh*price),dailySavingsEur:rounded(savings),feedInRateEurPerKwh:compensation.rate===null?null:rounded(compensation.rate),
    dailyFeedInRevenueEur:feedInRevenue===null?null:rounded(feedInRevenue),dailyBenefitEur:feedInRevenue===null?null:rounded(savings+feedInRevenue),
    compensationModel:compensation.model};
}

function hash(text:string):string {let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(36);}
const facesCache=new WeakMap<object,{key:unknown;faces:SolarFace[]}>();
export function solarFaces(calculation:unknown,metricScale={x:1,y:1,z:1}):SolarFace[] {
  if(!calculation||typeof calculation!=='object')return [];
  const raw=calculation as Record<string,any>,key=raw.input_fingerprint ? `${raw.input_fingerprint}:${JSON.stringify(metricScale)}` : null;
  if(key && facesCache.get(raw)?.key===key)return facesCache.get(raw)!.faces;
  const top=raw.roof_build_up?.top_faces;
  const triangles=roofSurfaceTriangles(Array.isArray(top)&&top.length?{...raw,geometry:{faces:top}}:raw)
    .map(t=>t.map(p=>[p[0]*metricScale.x,p[1]*metricScale.y,p[2]*metricScale.z]) as unknown as RoofTriangle);
  const groups=new Map<string,{triangles:RoofTriangle[];normal:THREE.Vector3;area:number}>();
  for(const t of triangles) {
    const a=new THREE.Vector3(...t[0]),b=new THREE.Vector3(...t[1]),c=new THREE.Vector3(...t[2]);
    const n=b.sub(a).cross(c.sub(a)),area=n.length()/2;
    if(area<1e-6)continue;n.normalize();if(n.y<0)n.negate();if(n.y<.1)continue;
    const groupKey=[n.x.toFixed(4),n.y.toFixed(4),n.z.toFixed(4),n.dot(a).toFixed(3)].join(':');
    const group=groups.get(groupKey)??{triangles:[],normal:n,area:0};
    group.triangles.push(t);group.area+=area;groups.set(groupKey,group);
  }
  const faces=[...groups.values()].map(g=>({id:'face-'+hash(g.triangles.map(t=>t.map(p=>`${p[0].toFixed(3)}:${p[2].toFixed(3)}`).sort().join('|')).sort().join(';')),
    triangles:g.triangles,normal:g.normal,areaM2:g.area,azimuthDeg:compassAzimuth(g.normal.x,g.normal.z),
    tiltDeg:Math.acos(Math.min(1,g.normal.y))*180/Math.PI}));
  if(key)facesCache.set(raw,{key,faces});return faces;
}

type Point=readonly [number,number];
function clip(points:readonly Point[],axis:0|1,bound:number,sign:number):Point[] {
  const result:Point[]=[];
  for(let i=0;i<points.length;i++) {
    const a=points[i]!,b=points[(i+1)%points.length]!,da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;
    if(da>=0)result.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return result;
}
function area(p:readonly Point[]):number{return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length]!;return s+a[0]*b[1]-b[0]*a[1];},0))/2;}

/** The entire expanded panel rectangle must be covered, not just its corners.
 * This keeps courtyards, setbacks, ridges and missing facets unoccupied.
 */
export function solarRectangleCovered(triangles:readonly (readonly Point[])[],x:number,z:number,width:number,length:number,margin:number):boolean {
  const x0=x-margin,x1=x+width+margin,z0=z-margin,z1=z+length+margin;
  let covered=0;
  for(const triangle of triangles) {
    if(Math.max(...triangle.map(p=>p[0]))<x0 || Math.min(...triangle.map(p=>p[0]))>x1 || Math.max(...triangle.map(p=>p[1]))<z0 || Math.min(...triangle.map(p=>p[1]))>z1)continue;
    let polygon=clip(triangle,0,x0,1);polygon=clip(polygon,0,x1,-1);polygon=clip(polygon,1,z0,1);polygon=clip(polygon,1,z1,-1);
    covered+=area(polygon);
  }
  return Math.abs(covered-(x1-x0)*(z1-z0))<1e-5;
}

export function buildSolarLayout(calculation:unknown,settingsValue:unknown):SolarLayout {
  const settings=normalizeSolarSettings(settingsValue),faces=solarFaces(calculation,settings.metricScale),module=settings.module;
  const result:SolarLayout={panels:[],faces,powerKwp:0,occupiedAreaM2:0,
    selectedAreaM2:faces.filter(face=>settings.selectedFaces.includes(face.id)).reduce((sum,face)=>sum+face.areaM2,0),
    availableAreaM2:0,availablePanelCount:0,truncated:false,groups:[]};
  if(!module)return result;
  const moduleArea=module.widthM*module.lengthM;
  const requestedPanelLimit=settings.targetAreaM2===null?5000:Math.max(0,Math.min(5000,Math.floor((settings.targetAreaM2+1e-9)/moduleArea)));
  for(const face of faces) {
    if(!settings.selectedFaces.includes(face.id))continue;
    const flat=face.tiltDeg<.1;
    // The roof owns the azimuth. Users no longer need to rotate modules or
    // choose portrait/landscape manually: both packing variants are evaluated
    // and the denser valid arrangement wins deterministically.
    const azimuth=flat?settings.flatAzimuthDeg:face.azimuthDeg,tilt=flat?settings.flatTiltDeg:face.tiltDeg;
    const collect=(faceLayout:'portrait'|'landscape')=>{
      const panelWidth=faceLayout==='landscape'?module.lengthM:module.widthM;
      const panelLength=faceLayout==='landscape'?module.widthM:module.lengthM;
      const az=azimuth*Math.PI/180,tiltRad=tilt*Math.PI/180;
      const normal=flat?new THREE.Vector3(Math.sin(az)*Math.sin(tiltRad),Math.cos(tiltRad),Math.cos(az)*Math.sin(tiltRad)):face.normal.clone();
      const u=new THREE.Vector3(Math.cos(az),0,-Math.sin(az));
      const baseV=new THREE.Vector3().crossVectors(u,face.normal).normalize(),v=new THREE.Vector3().crossVectors(u,normal).normalize();
      const origin=new THREE.Vector3(...face.triangles[0]![0]);
      const project=(p:readonly number[]):Point=>{const q=new THREE.Vector3(p[0],p[1],p[2]).sub(origin);return [q.dot(u),q.dot(baseV)];};
      const projected=face.triangles.map(t=>t.map(project)),points=projected.flat();
      const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
      const minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
      const length=panelLength*(flat?Math.cos(tiltRad):1);
      const shadowGap=panelLength*Math.sin(tiltRad)/Math.tan(18*Math.PI/180);
      const rowGap=flat?Math.max(settings.gapM,.8,shadowGap):settings.gapM;
      const panels:SolarPanelPose[]=[];let attempts=0,truncated=false;
      outer:for(let z=minZ+settings.edgeMarginM;z+length<=maxZ-settings.edgeMarginM+1e-6;z+=length+rowGap) {
        for(let x=minX+settings.edgeMarginM;x+panelWidth<=maxX-settings.edgeMarginM+1e-6;x+=panelWidth+settings.gapM) {
          if(++attempts>100_000){truncated=true;break outer;}
          if(!solarRectangleCovered(projected,x,z,panelWidth,length,settings.edgeMarginM))continue;
          const center=origin.clone().addScaledVector(u,x+panelWidth/2).addScaledVector(baseV,z+length/2);
          center.addScaledVector(face.normal,flat?panelLength*Math.sin(tiltRad)/2+.12:.08);
          const inverse=(p:THREE.Vector3)=>new THREE.Vector3(p.x/settings.metricScale.x,p.y/settings.metricScale.y,p.z/settings.metricScale.z);
          panels.push({center:inverse(center),u:inverse(u),v:inverse(v),normal:inverse(normal),faceId:face.id,
            widthM:panelWidth,lengthM:panelLength,layout:faceLayout});
          if(panels.length>=5000){truncated=true;break outer;}
        }
      }
      return {panels,truncated};
    };
    const portrait=collect('portrait'),landscape=collect('landscape');
    const chosen=landscape.panels.length>portrait.panels.length?landscape:portrait;
    const capacityRoom=Math.max(0,5000-result.availablePanelCount);
    const available=Math.min(capacityRoom,chosen.panels.length);
    const requestedRoom=Math.max(0,requestedPanelLimit-result.panels.length);
    const count=Math.min(available,requestedRoom);
    result.availablePanelCount+=available;
    result.panels.push(...chosen.panels.slice(0,count));
    result.truncated ||= chosen.truncated||chosen.panels.length>capacityRoom;
    result.groups.push({faceId:face.id,azimuthDeg:azimuth,tiltDeg:tilt,count,powerKwp:count*module.powerWp/1000});
    if(result.availablePanelCount>=5000){result.truncated=true;break;}
  }
  result.powerKwp=result.panels.length*module.powerWp/1000;
  result.occupiedAreaM2=result.panels.length*moduleArea;
  result.availableAreaM2=result.availablePanelCount*moduleArea;
  return result;
}

/** One instanced draw per roof zone; no per-module render-loop work. */
export function createSolarMesh(layout:SolarLayout,module:SolarModule|null):THREE.InstancedMesh|null {
  if(!module||!layout.panels.length)return null;
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x173855,metalness:.35,roughness:.42}),layout.panels.length);
  const matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
  // Preserve the inverse map's non-uniform scale/shear instead of losing it
  // through quaternion decomposition. Geodetic module dimensions stay exact.
  layout.panels.forEach((p,i)=>{scale.set(p.widthM,module.thicknessM,p.lengthM);matrix.makeBasis(p.u,p.normal,p.v).scale(scale).setPosition(p.center);mesh.setMatrixAt(i,matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name='vplib-roof-solar';mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}
