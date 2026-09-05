import json, logging
logging.disable(logging.CRITICAL)
from wsgi import app
from routes.chunks import _resolve_project_world_context, _find_chunk_snapshot
from extensions import db
from models.event import WorldCommandLog
from sqlalchemy import Text, cast
with app.test_request_context('/'):
    _,_,world=_resolve_project_world_context('chk_prj_prj_da09805bc6e54b29816c8cd6_6931567e1657','world_spawn')
    for x,z in [(-1,2),(2,2),(-2,4),(-1,4),(1,5),(4,5),(3,6)]:
        s=_find_chunk_snapshot(world=world,chunk_x=x,chunk_y=0,chunk_z=z)
        rows=db.session.query(WorldCommandLog.command_id,WorldCommandLog.affected_cells_json,WorldCommandLog.affected_cell_count,
            WorldCommandLog.changed,WorldCommandLog.command_type,WorldCommandLog.result_payload_json).filter(
            WorldCommandLog.world_db_id==world.id,cast(WorldCommandLog.affected_chunks_json,Text).contains(f'"{x}:0:{z}"')).all()
        print(json.dumps({'chunk':[x,0,z],'snapshot_source':s.snapshot_source,'revision':s.chunk_revision,'last_command':s.last_command_id,
            'logCount':len(rows),'lastFound':any(r.command_id==s.last_command_id for r in rows),
            'incomplete':[{'id':r.command_id,'declared':r.affected_cell_count,'actual':len(r.affected_cells_json or [])} for r in rows if len(r.affected_cells_json or [])!=r.affected_cell_count],
            'metadata':s.metadata_json,'allLogs':[{'id':r.command_id,'changed':r.changed,'type':r.command_type,'versions':(r.result_payload_json or {}).get('chunkVersions'),'count':r.affected_cell_count} for r in rows]},default=str))
