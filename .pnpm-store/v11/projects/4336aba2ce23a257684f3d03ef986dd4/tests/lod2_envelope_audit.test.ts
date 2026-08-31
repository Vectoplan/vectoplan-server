import assert from 'node:assert/strict';
import test from 'node:test';

import { auditLod2Envelope, type Lod2EnvelopeFixture } from '../src/frontend/scene/lod2_envelope_audit';

const closed=(points:readonly (readonly [number,number,number])[])=>[...points,points[0]!];

test('envelope audit rejects a wall whose top leans away from its independent ground edge',()=>{
  const fixture:Lod2EnvelopeFixture={
    buildingId:'leaning-wall',conversionError:null,converted:{wallCells:[],roofs:[]},
    surfaces:[
      {surface:'GroundSurface',rings:[closed([[0,0,0],[4,0,0],[4,0,4],[0,0,4]])]},
      {surface:'WallSurface',rings:[closed([[0,0,0],[4,0,0],[4,3,.4],[0,3,.4]])]},
    ],
  };
  const report=auditLod2Envelope(fixture);
  const lean=report.issues.find(issue=>issue.code==='source-wall-not-vertical');
  assert(lean,'a straight ground line must not make a leaning wall pass');
  assert.equal(lean.subjectId,'wall-1');
  assert(lean.measured>.35);
  assert(report.maximumSourceWallLeanM>.35);
});

test('envelope audit compares the facade top with independent roof triangles',()=>{
  const roofPoints=[[0,0,4000],[4000,0,4000],[4000,4000,4000],[0,4000,4000]];
  const calculation={ok:true,geometry:{faces:[{face_ref:'roof-a',polygon_3d_mm:roofPoints}]}};
  const facade={start:[0,0],end:[4,0],minimumY:0,maximumY:3,
    topProfile:[[0,3],[4,3]],bottomProfile:[[0,0],[4,0]]};
  const wallCells:Array<readonly [number,number,number]>=[];
  for(let x=0;x<4;x++)for(let y=0;y<3;y++)wallCells.push([x,y,0]);
  const fixture:Lod2EnvelopeFixture={
    buildingId:'roof-gap',conversionError:null,
    converted:{wallCells,roofs:[{metadata:{roofCalculation:calculation,
      roofParameters:{importedSource:{facadeSegments:[facade]}}}}]},
    surfaces:[
      {surface:'GroundSurface',rings:[closed([[0,0,0],[4,0,0],[4,0,4],[0,0,4]])]},
      {surface:'WallSurface',rings:[closed([[0,0,0],[4,0,0],[4,3,0],[0,3,0]])]},
      {surface:'RoofSurface',rings:[closed([[0,4,0],[4,4,0],[4,4,4],[0,4,4]])]},
    ],
  };
  const report=auditLod2Envelope(fixture);
  const seam=report.issues.find(issue=>issue.code==='wall-roof-seam-gap');
  assert(seam,'a wall may not validate itself against its own top profile');
  assert(Math.abs(seam.measured-1)<1e-6);
  assert.equal(seam.severity,'error');
  assert.equal(report.maximumWallRoofSeamGapM,1);
});

test('an elevated LoD2 connector is reported but never treated as a failed exterior eave',()=>{
  const calculation={ok:true,geometry:{faces:[{face_ref:'roof-a',polygon_3d_mm:[
    [0,0,5000],[4000,0,5000],[4000,4000,5000],[0,4000,5000],
  ]}]}};
  const facade={start:[0,0],end:[4,0],minimumY:2,maximumY:3,facadeRole:'connector',
    topProfile:[[0,3],[4,3]],bottomProfile:[[0,2],[4,2]]};
  const wallCells:Array<readonly [number,number,number]>=[];
  for(let x=0;x<4;x++)wallCells.push([x,2,0]);
  const fixture:Lod2EnvelopeFixture={buildingId:'roof-connector',conversionError:null,
    converted:{wallCells,roofs:[{metadata:{roofCalculation:calculation,
      roofParameters:{importedSource:{facadeSegments:[facade]}}}}]},
    surfaces:[
      {surface:'WallSurface',rings:[closed([[0,2,0],[4,2,0],[4,3,0],[0,3,0]])]},
      {surface:'RoofSurface',rings:[closed([[0,5,0],[4,5,0],[4,5,4],[0,5,4]])]},
    ]};
  const report=auditLod2Envelope(fixture);
  const seam=report.issues.find(issue=>issue.code==='wall-roof-seam-gap');
  assert(seam);assert.equal(seam.severity,'warning');
  assert.equal(report.status,'warning');
});
