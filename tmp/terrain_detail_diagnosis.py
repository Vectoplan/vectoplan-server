import json, logging, time
from dataclasses import replace
from pathlib import Path
logging.disable(logging.CRITICAL)
from wsgi import app
from routes.chunks import _resolve_project_world_context
from src.world.earth.terrain_pipeline import generate_earth_terrain_chunk, get_default_terrain_config, TerrainChunkCache
with app.test_request_context('/'):
    _, _, world = _resolve_project_world_context('chk_prj_prj_da09805bc6e54b29816c8cd6_6931567e1657', 'world_spawn')
    config=replace(get_default_terrain_config(),region_enabled=False,sample_step_m=1)
    results=[]
    for x,z in [(0,0),(10,10)]:
        start=time.monotonic()
        result=generate_earth_terrain_chunk(world=world,provider=world.build_earth_provider(),chunk_x=x,chunk_y=0,chunk_z=z,
            config=config,cache=TerrainChunkCache(Path('/tmp/terrain-detail-diagnosis')))
        corners=result.get('metadata',{}).get('terrainSurface',{}).get('cornerHeights',[])
        results.append({'chunk':[x,0,z],'seconds':round(time.monotonic()-start,3),'range':[min(corners),max(corners)] if corners else None,'terrain':result.get('terrain'),'corners':corners})
    print('TERRAIN_DETAIL='+json.dumps(results))
