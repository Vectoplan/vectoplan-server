"""Read real project route output; export terrain only, with no credentials/user objects."""
import json, logging, pathlib, time
logging.disable(logging.CRITICAL)
from wsgi import app
from routes.chunks import _resolve_project_world_context, _load_or_generate_chunk, _serialize_chunk_load_result
with app.test_request_context('/?contentProfile=surface-shell.v1'):
    project,universe,world=_resolve_project_world_context('chk_prj_prj_da09805bc6e54b29816c8cd6_6931567e1657','world_spawn')
    output=[];start=time.monotonic()
    def load(x,y,z):
        result=_load_or_generate_chunk(project=project,universe=universe,world=world,chunk_x=x,chunk_y=y,chunk_z=z)
        body=_serialize_chunk_load_result(project=project,universe=universe,world=world,result=result,compact_cells=False,structure_hints={})
        chunk=body['chunk']
        terrain_values={index+1 for index,entry in enumerate(chunk['palette']) if str(entry.get('blockTypeId','') if isinstance(entry,dict) else entry).startswith('system_terrain')}
        chunk['cells']=[value if value in terrain_values else 0 for value in chunk['cells']]
        for key in ['objectRefs','geodataOverlays','snapshotId','metadata']:
            if key!='metadata':chunk.pop(key,None)
        chunk['metadata']={'terrainSurface':chunk.get('metadata',{}).get('terrainSurface')}
        chunk['projectId']='berlin-terrain-route-audit';chunk['universeId']='public-terrain';chunk['worldId']='earth'
        output.append(chunk)
        return chunk
    for z in range(-2,11):
        for x in range(-2,11):
            chunk=load(x,0,z)
            low=int(chunk.get('stats',{}).get('minimumSurfaceY') or 0)//16
            high=int(chunk.get('stats',{}).get('maximumSurfaceY') or 0)//16
            for y in range(low,high+1):
                if y:load(x,y,z)
        print('TERRAIN_ROW='+str(z),flush=True)
    path=pathlib.Path('/tmp/terrain-world-route.json');path.write_text(json.dumps(output,separators=(',',':')))
    print('TERRAIN_WORLD_EXPORT='+json.dumps({'count':len(output),'seconds':round(time.monotonic()-start,2),'bytes':path.stat().st_size}))
