import json, logging
logging.disable(logging.CRITICAL)
from wsgi import app
from routes.chunks import _resolve_project_world_context
from extensions import db
from models.event import ChunkEvent
with app.test_request_context('/'):
    _,_,world=_resolve_project_world_context('chk_prj_prj_da09805bc6e54b29816c8cd6_6931567e1657','world_spawn')
    for x,z in [(-1,2),(2,2),(-2,4),(-1,4),(1,5),(4,5),(3,6)]:
        rows=db.session.query(ChunkEvent.command_id,ChunkEvent.chunk_revision_before,ChunkEvent.chunk_revision_after,
            ChunkEvent.command_type).filter(ChunkEvent.world_db_id==world.id,ChunkEvent.chunk_x==x,ChunkEvent.chunk_y==0,ChunkEvent.chunk_z==z).all()
        print(json.dumps({'chunk':[x,0,z],'events':[dict(id=r.command_id,before=r.chunk_revision_before,after=r.chunk_revision_after,type=r.command_type) for r in rows]},default=str))
