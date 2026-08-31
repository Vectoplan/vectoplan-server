import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { auditLod2Envelope, type Lod2EnvelopeFixture } from "../src/frontend/scene/lod2_envelope_audit";
import { auditParcelGrid } from "../src/frontend/world_edit/systems/parcel_grid/audit";
import {
  deriveLod2BuildingGridReference,
  lod2BuildingFacadeBands,
  type Lod2BuildingFootprint,
} from "../src/frontend/world_edit/systems/parcel_grid/building_reference";
import {
  buildParcelGridPartition,
  type ParcelGridBoundarySegmentInput,
  type ParcelGridPoint,
} from "../src/frontend/world_edit/systems/parcel_grid/geometry";

interface FixtureBuilding {
  readonly buildingId:string;
  readonly parcelOverlapM2:number;
  readonly footprints:readonly Lod2BuildingFootprint[];
  readonly triangles:readonly (readonly ParcelGridPoint[])[];
}
interface FixtureSample {
  readonly sampleId:string;
  readonly parcelId:string;
  readonly parcelAreaM2:number;
  readonly buildableAreaM2:number;
  readonly parcelTriangles:readonly (readonly ParcelGridPoint[])[];
  readonly parcelBoundarySegments:readonly ParcelGridBoundarySegmentInput[];
  readonly buildings:readonly FixtureBuilding[];
  readonly envelope:Lod2EnvelopeFixture;
}
interface Fixture {
  readonly schemaVersion:string;
  readonly sampleCount:number;
  readonly samples:readonly FixtureSample[];
}

const fixture=JSON.parse(readFileSync(resolve("tests/fixtures/berlin_parcel_grid_samples.json"),"utf8")) as Fixture;
const selected=process.env.BERLIN_GRID_SAMPLE
  ?fixture.samples.filter(sample=>sample.sampleId===process.env.BERLIN_GRID_SAMPLE)
  :fixture.samples;
if(!selected.length)throw new Error("BERLIN_GRID_SAMPLE bezeichnet keinen Testdatensatz.");

function bounds(points:readonly ParcelGridPoint[]) {
  return {
    minimumX:Math.floor(Math.min(...points.map(point=>point[0]))),
    maximumX:Math.ceil(Math.max(...points.map(point=>point[0]))),
    minimumZ:Math.floor(Math.min(...points.map(point=>point[1]))),
    maximumZ:Math.ceil(Math.max(...points.map(point=>point[1]))),
  };
}
const issueCounts=new Map<string,number>();
const severityCounts=new Map<'error'|'warning',number>();
const count=(code:string)=>issueCounts.set(code,(issueCounts.get(code)??0)+1);

const samples=selected.map((sample,sampleIndex)=>{
  const references=sample.buildings.map(building=>({building,reference:deriveLod2BuildingGridReference(
    building.buildingId,building.footprints,
  )})).filter((entry):entry is typeof entry&{reference:NonNullable<typeof entry.reference>}=>entry.reference!==null)
    .sort((first,second)=>second.building.parcelOverlapM2-first.building.parcelOverlapM2);
  if(!references.length)throw new Error(`${sample.sampleId}: keine GroundSurface-Referenz`);
  const primary=references[0]!.reference;
  const exclusions=sample.buildings.flatMap(building=>building.triangles);
  const partition=buildParcelGridPartition({
    boundarySegments:[...sample.parcelBoundarySegments,...references.flatMap(entry=>lod2BuildingFacadeBands(entry.reference))],
    coverageTriangles:sample.parcelTriangles,
    excludedTriangles:exclusions,
    bounds:bounds(sample.parcelTriangles.flat()),
    regularGrid:{id:primary.buildingId,origin:primary.origin,axisU:primary.axisU,axisV:primary.axisV,
      stepU:primary.stepU,stepV:primary.stepV,uAnchors:primary.uAnchors,vAnchors:primary.vAnchors},
    minimumArea:1e-6,
  });
  const gridReports=references.map(entry=>auditParcelGrid({reference:entry.reference,partition,
    coverageTriangles:sample.parcelTriangles,excludedTriangles:exclusions}));
  const envelopeReport=auditLod2Envelope(sample.envelope);
  gridReports.flatMap(report=>report.issues).forEach(issue=>{
    count(`grid:${issue.code}`);severityCounts.set(issue.severity,(severityCounts.get(issue.severity)??0)+1);
  });
  envelopeReport.issues.forEach(issue=>{
    count(`envelope:${issue.code}`);severityCounts.set(issue.severity,(severityCounts.get(issue.severity)??0)+1);
  });
  const status=gridReports.some(report=>report.status==='error')||envelopeReport.status==='fail'?'fail':
    gridReports.some(report=>report.status==='warning')||envelopeReport.status==='warning'?'warning':'pass';
  const facadeCells=partition.cells.filter(cell=>cell.boundaryKind==='building-facade');
  const regularCells=partition.cells.filter(cell=>cell.boundaryKind!=='building-facade');
  const regularStride=Math.max(1,Math.ceil(regularCells.length/4_000));
  const visualCells=[...facadeCells,...regularCells.filter((_,index)=>index%regularStride===0)];
  console.log(`[${sampleIndex+1}/${selected.length}] ${sample.sampleId}: ${status}, ${gridReports.length} Gebäude, ${partition.cells.length} Rasterzellen, ${gridReports.flatMap(report=>report.issues).length+envelopeReport.issues.length} Befunde`);
  return {
    sampleId:sample.sampleId,parcelId:sample.parcelId,status,parcelAreaM2:sample.parcelAreaM2,
    expectedBuildableAreaM2:sample.buildableAreaM2,buildingCount:sample.buildings.length,
    auditedBuildingCount:gridReports.length,
    partition:{cellCount:partition.cells.length,coveredAreaM2:partition.coveredArea,slantedAreaM2:partition.slantedArea,
      straightAreaM2:partition.straightArea,blockedAreaM2:partition.blockedArea},
    gridReports,envelopeReport,
    visual:{
      parcelTriangles:sample.parcelTriangles,
      sourceCellCount:partition.cells.length,displayedCellCount:visualCells.length,
      cells:visualCells.map(cell=>({polygon:cell.polygon,boundaryKind:cell.boundaryKind??'parcel',
        alignment:cell.gridAlignment??'world'})),
      buildings:sample.buildings.map(building=>({buildingId:building.buildingId,footprints:building.footprints})),
      surfaces:sample.envelope.surfaces,
    },
  };
});

const failedSamples=samples.filter(sample=>sample.status==='fail').length;
const warningSamples=samples.filter(sample=>sample.status==='warning').length;
const report={
  schemaVersion:'vectoplan-berlin-geometry-audit.v1',generatedAt:new Date().toISOString(),
  scope:{city:'Berlin',parcelCount:samples.length,buildingCount:samples.reduce((sum,sample)=>sum+sample.buildingCount,0),
    auditedGridBuildingCount:samples.reduce((sum,sample)=>sum+sample.auditedBuildingCount,0),
    auditedEnvelopeCount:samples.length},
  thresholds:{wallLeanM:.03,wallPlanResidualM:.03,wallPlaneTiltDegrees:1,wallGroundOffsetM:.03,
    wallRoofSeamGapM:.03,roofSeamHeightMismatchM:.03,facadeGridGapM:.05,parcelCoverageGapM2:.01},
  summary:{status:failedSamples?'fail':warningSamples?'warning':'pass',passedSamples:samples.length-failedSamples-warningSamples,
    warningSamples,failedSamples,
    errorFindings:severityCounts.get('error')??0,warningFindings:severityCounts.get('warning')??0,
    issueCounts:Object.fromEntries([...issueCounts].sort((first,second)=>second[1]-first[1]))},
  samples,
};

const escapeHtml=(value:unknown)=>String(value).replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[character]!));
const number=(value:number|null|undefined,digits=3)=>value===null||value===undefined?'–':
  Number.isFinite(value)?value.toFixed(digits):String(value);
const allPlanPoints=(sample:typeof samples[number])=>[
  ...sample.visual.parcelTriangles.flat(),...sample.visual.cells.flatMap(cell=>cell.polygon),
  ...sample.visual.buildings.flatMap(building=>building.footprints.flatMap(footprint=>footprint.outer)),
];
function planSvg(sample:typeof samples[number]){
  const points=allPlanPoints(sample),minimumX=Math.min(...points.map(point=>point[0])),maximumX=Math.max(...points.map(point=>point[0]));
  const minimumZ=Math.min(...points.map(point=>point[1])),maximumZ=Math.max(...points.map(point=>point[1]));
  const width=Math.max(1,maximumX-minimumX),height=Math.max(1,maximumZ-minimumZ),padding=Math.max(width,height)*.03;
  const polygon=(polygon:readonly ParcelGridPoint[])=>polygon.map(point=>`${point[0]},${point[1]}`).join(' ');
  const failedFacades=new Set(sample.gridReports.flatMap(grid=>grid.issues.map(issue=>issue.subjectId).filter(Boolean)));
  return `<svg class="plan" viewBox="${minimumX-padding} ${minimumZ-padding} ${width+2*padding} ${height+2*padding}" preserveAspectRatio="xMidYMid meet">
    <g>${sample.visual.parcelTriangles.map(triangle=>`<polygon class="parcel" points="${polygon(triangle)}"/>`).join('')}</g>
    <g>${sample.visual.cells.map(cell=>`<polygon class="cell ${cell.boundaryKind==='building-facade'?'facade-cell':''}" points="${polygon(cell.polygon)}"/>`).join('')}</g>
    <g>${sample.visual.buildings.flatMap(building=>building.footprints.map(footprint=>`<polygon class="building" points="${polygon(footprint.outer)}"/>`)).join('')}</g>
    <g>${sample.gridReports.flatMap(grid=>grid.facades.map(facade=>`<line class="facade ${failedFacades.has(facade.facadeId)?'bad':''}" x1="${facade.start[0]}" y1="${facade.start[1]}" x2="${facade.end[0]}" y2="${facade.end[1]}"/>`)).join('')}</g>
  </svg>`;
}
function elevationSvg(sample:typeof samples[number],horizontal:'x'|'z'){
  const coordinate=horizontal==='x'?0:2;
  const rings=sample.visual.surfaces.flatMap((surface,index)=>surface.rings.map(ring=>({surface,index,ring})));
  const points=rings.flatMap(value=>value.ring);
  if(!points.length)return '';
  const minimumH=Math.min(...points.map(point=>point[coordinate])),maximumH=Math.max(...points.map(point=>point[coordinate]));
  const minimumY=Math.min(...points.map(point=>point[1])),maximumY=Math.max(...points.map(point=>point[1]));
  const width=Math.max(1,maximumH-minimumH),height=Math.max(1,maximumY-minimumY),padding=Math.max(width,height)*.04;
  const failedWalls=new Set(sample.envelopeReport.issues.filter(issue=>issue.subjectId?.startsWith('wall-')).map(issue=>issue.subjectId));
  return `<svg class="elevation" viewBox="${minimumH-padding} ${-(maximumY+padding)} ${width+2*padding} ${height+2*padding}" preserveAspectRatio="xMidYMid meet">
    ${rings.map(({surface,index,ring})=>`<polygon class="surface ${surface.surface==='RoofSurface'?'roof':'wall'} ${failedWalls.has(`wall-${index}`)?'bad':''}" points="${ring.map(point=>`${point[coordinate]},${-point[1]}`).join(' ')}"/>`).join('')}
  </svg>`;
}
function issueRows(sample:typeof samples[number]){
  const issues=[...sample.gridReports.flatMap(grid=>grid.issues.map(issue=>({system:'Raster',...issue}))),
    ...sample.envelopeReport.issues.map(issue=>({system:'Hülle',...issue}))];
  return issues.length?issues.map(issue=>`<tr><td>${issue.system}</td><td>${escapeHtml('severity' in issue?issue.severity:'error')}</td><td><code>${escapeHtml(issue.code)}</code></td><td>${escapeHtml(issue.subjectId??'–')}</td><td>${number(issue.measured)}</td><td>${number(issue.limit)}</td><td>${escapeHtml(issue.message??'')}</td></tr>`).join(''):
    '<tr><td colspan="7">Keine mathematische Verletzung gefunden.</td></tr>';
}
const sections=samples.map(sample=>`<details ${sample.status==='fail'?'open':''} class="sample ${sample.status}">
  <summary><strong>${escapeHtml(sample.sampleId)}</strong> · ${escapeHtml(sample.parcelId)} · ${sample.buildingCount} Gebäude · ${sample.status.toUpperCase()}</summary>
  <div class="visuals"><figure><figcaption>Raster / Grundriss</figcaption>${planSvg(sample)}</figure><figure><figcaption>Wände / Dach – X/Y</figcaption>${elevationSvg(sample,'x')}</figure><figure><figcaption>Wände / Dach – Z/Y</figcaption>${elevationSvg(sample,'z')}</figure></div>
  <div class="metrics">Rasterzellen: ${sample.partition.cellCount} · geprüfte Gebäude: ${sample.auditedBuildingCount} · Wandflächen: ${sample.envelopeReport.wallSurfaces.length} · Fassaden-Dach-Proben: ${sample.envelopeReport.facadeRoofSeams.reduce((sum,seam)=>sum+seam.sampleCount,0)}</div>
  <table><thead><tr><th>System</th><th>Stufe</th><th>Fehlercode</th><th>Objekt</th><th>Messwert</th><th>Grenze</th><th>Erklärung</th></tr></thead><tbody>${issueRows(sample)}</tbody></table>
  <details><summary>Mathematische Rohdaten</summary><pre>${escapeHtml(JSON.stringify({gridReports:sample.gridReports,envelopeReport:sample.envelopeReport},null,2))}</pre></details>
</details>`).join('\n');
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>VECTOPLAN Geometrie-Prüfbericht</title><style>
body{font:14px system-ui;margin:0;background:#f3f6fa;color:#172b45}header{position:sticky;top:0;background:#fff;padding:16px 24px;border-bottom:1px solid #ccd7e5;z-index:2}main{padding:18px}.sample{background:#fff;border:1px solid #cbd7e6;border-left:6px solid #27a269;border-radius:8px;margin:12px 0;padding:10px}.sample.fail{border-left-color:#d83b3b}.sample.warning{border-left-color:#d58b16}summary{cursor:pointer}.visuals{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:12px}figure{margin:0;border:1px solid #dae3ef;border-radius:6px;padding:6px;background:#f9fbfe}figcaption{font-weight:650;margin-bottom:5px}.plan,.elevation{width:100%;height:330px;background:#fff}.parcel{fill:#edf4ff;stroke:#80aee8;stroke-width:.08}.cell{fill:#7db8ff44;stroke:#2388fa;stroke-width:.035}.facade-cell{fill:#3bd9a855}.building{fill:#37475ccc;stroke:#142234;stroke-width:.14}.facade{stroke:#15a067;stroke-width:.16}.facade.bad{stroke:#ef2020;stroke-width:.35}.surface{fill:#45566b88;stroke:#26394f;stroke-width:.06}.surface.roof{fill:#c34b2aaa;stroke:#7e2312}.surface.bad{fill:#ff1834bb;stroke:#a00017}.metrics{padding:8px 0;font-weight:600}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d8e0ea;padding:6px;text-align:left;vertical-align:top}th{background:#eef3f9}pre{white-space:pre-wrap;max-height:600px;overflow:auto;background:#101923;color:#e9f1fa;padding:10px;border-radius:6px}@media(max-width:1000px){.visuals{grid-template-columns:1fr}.plan,.elevation{height:260px}}
</style></head><body><header><h1>VECTOPLAN Geometrie-Prüfbericht</h1><div>${samples.length} Berliner Grundstücke · ${report.scope.buildingCount} Gebäude · ${report.scope.auditedGridBuildingCount} Rasterreferenzen · <strong>${failedSamples} fehlerhafte Grundstücke</strong></div><div>Erstellt: ${escapeHtml(report.generatedAt)}</div></header><main>${sections}</main></body></html>`;

const jsonPath=resolve(process.env.BERLIN_AUDIT_JSON??'test-results/berlin_geometry_audit_report.json');
const htmlPath=resolve(process.env.BERLIN_AUDIT_HTML??'test-results/berlin_geometry_audit_report.html');
mkdirSync(dirname(jsonPath),{recursive:true});mkdirSync(dirname(htmlPath),{recursive:true});
// The JSON is the compact machine report.  Raster polygons are already
// represented by mathematical facade/cell metrics there and remain only in
// the visual HTML, avoiding a redundant 40+ MB payload.
const machineReport={...report,samples:report.samples.map(({visual:_,...sample})=>sample)};
writeFileSync(jsonPath,JSON.stringify(machineReport,null,2));writeFileSync(htmlPath,html);
console.log(JSON.stringify({jsonPath,htmlPath,...report.scope,...report.summary},null,2));
if(process.env.BERLIN_AUDIT_STRICT==='1'&&failedSamples)process.exitCode=1;
