import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { auditLod2Envelope, type Lod2EnvelopeFixture } from "../src/frontend/scene/lod2_envelope_audit";

import { auditParcelGrid } from "../src/frontend/world_edit/systems/parcel_grid/audit";
import {
  deriveLod2BuildingGridReference,
  lod2BuildingFacadeBands,
  type BuildingGridPoint,
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
  readonly occupiedAreaM2:number;
  readonly buildableAreaM2:number;
  readonly parcelTriangles:readonly (readonly ParcelGridPoint[])[];
  readonly parcelBoundarySegments:readonly ParcelGridBoundarySegmentInput[];
  readonly buildings:readonly FixtureBuilding[];
  readonly envelope:Lod2EnvelopeFixture;
}

const fixture=JSON.parse(readFileSync(resolve("tests/fixtures/berlin_parcel_grid_samples.json"),"utf8")) as {
  readonly schemaVersion:string;
  readonly sampleCount:number;
  readonly samples:readonly FixtureSample[];
};

function bounds(points:readonly ParcelGridPoint[]) {
  return {
    minimumX:Math.floor(Math.min(...points.map((point)=>point[0]))),
    maximumX:Math.ceil(Math.max(...points.map((point)=>point[0]))),
    minimumZ:Math.floor(Math.min(...points.map((point)=>point[1]))),
    maximumZ:Math.ceil(Math.max(...points.map((point)=>point[1]))),
  };
}

test("40 real Berlin parcels keep complete building-aligned grids",()=>{
  assert.equal(fixture.schemaVersion,"vectoplan-berlin-parcel-grid-samples.v2");
  assert(fixture.sampleCount>=30);
  const failures:string[]=[];
  let auditedBuildings=0;
  const selectedSamples=process.env.BERLIN_GRID_SAMPLE
    ?fixture.samples.filter((sample)=>sample.sampleId===process.env.BERLIN_GRID_SAMPLE)
    :fixture.samples;
  assert(selectedSamples.length>0,"requested Berlin grid sample does not exist");
  for(const sample of selectedSamples){
    const references=sample.buildings.map((building)=>({
      building,
      reference:deriveLod2BuildingGridReference(building.buildingId,building.footprints),
    })).filter((entry):entry is {building:FixtureBuilding;reference:NonNullable<typeof entry.reference>}=>entry.reference!==null);
    if(!references.length){failures.push(`${sample.sampleId}: no GroundSurface reference`);continue;}
    references.sort((first,second)=>second.building.parcelOverlapM2-first.building.parcelOverlapM2);
    const primary=references[0]!.reference;
    const exclusions=sample.buildings.flatMap((building)=>building.triangles);
    const partition=buildParcelGridPartition({
      boundarySegments:[
        ...sample.parcelBoundarySegments,
        ...references.flatMap((entry)=>lod2BuildingFacadeBands(entry.reference)),
      ],
      coverageTriangles:sample.parcelTriangles,
      excludedTriangles:exclusions,
      bounds:bounds(sample.parcelTriangles.flat()),
      regularGrid:{
        id:primary.buildingId,
        origin:primary.origin,
        axisU:primary.axisU,
        axisV:primary.axisV,
        stepU:primary.stepU,
        stepV:primary.stepV,
        uAnchors:primary.uAnchors,
        vAnchors:primary.vAnchors,
      },
      minimumArea:1e-6,
    });
    // Every building contributes facade bands to the same parcel partition.
    // Auditing only the largest building hid errors at annexes and secondary
    // buildings although those cells were visible in the editor.
    for(const entry of references){
      auditedBuildings+=1;
      const report=auditParcelGrid({
        reference:entry.reference,
        partition,
        coverageTriangles:sample.parcelTriangles,
        excludedTriangles:exclusions,
      });
      if(process.env.BERLIN_GRID_VERBOSE)console.error(JSON.stringify({
        sampleId:sample.sampleId,
        buildingId:entry.reference.buildingId,
        parcelAreaM2:sample.parcelAreaM2,
        expectedBuildableAreaM2:report.expectedBuildableAreaM2,
        partitionCoveredAreaM2:partition.coveredArea,
        slantedAreaM2:partition.slantedArea,
        straightAreaM2:partition.straightArea,
        blockedAreaM2:partition.blockedArea,
        cellCount:partition.cells.length,
        buildingCount:sample.buildings.length,
        issues:report.issues,
      },null,2));
      if(report.expectedBuildableAreaM2===null
        ||Math.abs(report.expectedBuildableAreaM2-sample.buildableAreaM2)>.02)failures.push(
          `${sample.sampleId}: independent Shapely buildable area ${sample.buildableAreaM2.toFixed(3)} differs from audit ${report.expectedBuildableAreaM2?.toFixed(3)??"null"}`,
        );
      if(report.status!=="pass")failures.push([
        sample.sampleId,entry.reference.buildingId,report.status,
        report.issues.map((issue)=>`${issue.code}=${issue.measured.toFixed(4)}`).join(","),
        `coverage=${report.minimumFacadeCoverageRatio.toFixed(5)}`,
        `gap=${report.maximumFacadeLineGapM.toFixed(3)}`,
        `partial=${report.partialFacadeCellCount}`,
        `uncovered=${report.uncoveredBuildableAreaM2.toFixed(3)}`,
        `expected=${report.expectedBuildableAreaM2?.toFixed(3)??"n/a"}`,
        `covered=${partition.coveredArea.toFixed(3)}`,
      ].join(":"));
    }
  }
  assert(auditedBuildings>=(process.env.BERLIN_GRID_SAMPLE?1:40),
    `expected all selected real parcel samples to be audited, received ${auditedBuildings}`);
  assert.deepEqual(failures,[]);
});

test("40 real Berlin LoD2 buildings keep closed roofs, complete walls and one deterministic facade owner",()=>{
  assert.equal(fixture.schemaVersion,"vectoplan-berlin-parcel-grid-samples.v2");
  assert(fixture.sampleCount>=40);
  const selectedSamples=process.env.BERLIN_GRID_SAMPLE
    ?fixture.samples.filter((sample)=>sample.sampleId===process.env.BERLIN_GRID_SAMPLE)
    :fixture.samples;
  assert(selectedSamples.length>0,"requested Berlin envelope sample does not exist");
  const failures:string[]=[];
  for(const sample of selectedSamples){
    const report=auditLod2Envelope(sample.envelope);
    if(process.env.BERLIN_GRID_VERBOSE)console.error(JSON.stringify({
      sampleId:sample.sampleId,buildingId:sample.envelope.buildingId,...report,
    },null,2));
    if(report.status==='fail')failures.push([
      sample.sampleId,sample.envelope.buildingId,
      report.issues.map(issue=>`${issue.code}=${issue.measured.toFixed(4)}>${issue.limit.toFixed(4)}`).join(','),
      `roof=${report.convertedRoofAreaM2.toFixed(2)}/${report.sourceRoofAreaM2.toFixed(2)}`,
      `aligned=${report.alignedWallCellCount}/${report.wallCellCount}`,
      `retained=${report.retainedWorldGridCellCount}`,
      `bodies=${report.renderedWallBodyCount}`,
    ].join(':'));
  }
  assert.equal(selectedSamples.length,process.env.BERLIN_GRID_SAMPLE?1:40);
  assert.deepEqual(failures,[]);
});
