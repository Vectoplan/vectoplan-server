import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app

application = create_app("development")
application.run(host="127.0.0.1", port=5114, debug=False, use_reloader=False)
