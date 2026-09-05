import os,json
from sqlalchemy import create_engine, text
engine = create_engine(os.environ['DATABASE_URL'])
with engine.connect() as conn:
    rows = conn.execute(text("SELECT w.world_id,w.global_reference_json,w.spawn_x,w.spawn_y,w.spawn_z FROM world_instances w JOIN projects p ON p.id=w.project_db_id WHERE p.external_app_project_id=:p"), {'p':'prj_da09805bc6e54b29816c8cd6'}).mappings().all()
    print(json.dumps([dict(row) for row in rows], default=str))
