"""Read-only diagnosis through the actual persisted World -> route adapter."""
import json
import logging
import pathlib
logging.disable(logging.CRITICAL)
from wsgi import app
from routes.chunks import _resolve_project_world_context, _load_or_generate_chunk, _serialize_chunk_load_result
from src.world.earth.terrain_pipeline import generate_earth_terrain_chunk, get_earth_terrain_region_preview

with app.test_request_context('/?contentProfile=surface-shell.v1'):
    project, universe, world = _resolve_project_world_context('chk_prj_prj_da09805bc6e54b29816c8cd6_6931567e1657', 'world_spawn')
    results = []
    bodies = []
    for x,z in [(0,0),(1,1),(5,5),(10,10),(-10,-10),(14,0),(0,14)]:
        result = _load_or_generate_chunk(project=project,universe=universe,world=world,chunk_x=x,chunk_y=0,chunk_z=z)
        body = _serialize_chunk_load_result(project=project,universe=universe,world=world,result=result,compact_cells=False,structure_hints={})
        c = body['chunk']
        corners=(c.get('metadata') or {}).get('terrainSurface',{}).get('cornerHeights',[])
        generated=generate_earth_terrain_chunk(world=world,provider=world.build_earth_provider(),chunk_x=x,chunk_y=0,chunk_z=z)
        rawcorners=(generated.get('metadata') or {}).get('terrainSurface',{}).get('cornerHeights',[])
        results.append({'chunkKey':c.get('chunkKey'),'source':result['source'], 'routeCornerCount':len(corners),
            'routeRange':[min(corners),max(corners)] if corners else None,'generatedRange':[min(rawcorners),max(rawcorners)] if rawcorners else None,
            'terrain':c.get('terrain'),'stats':c.get('stats'),'snapshotRevision':getattr(result.get('snapshot'),'chunk_revision',None),
            'metadataKeys':list((c.get('metadata') or {}).keys()),'nonAir':sum(v!=0 for v in c.get('cells',[]))})
        # No user geometry, project identifiers, or authentication in exported public terrain samples.
        if result['source']=='generated':
            body['chunk'].pop('objectRefs',None)
            body['chunk'].pop('geodataOverlays',None)
            bodies.append(body['chunk'])
    pathlib.Path('/tmp/terrain-live-generated.json').write_text(json.dumps(bodies))
    print('TERRAIN_DIAGNOSIS='+json.dumps(results,default=str))
