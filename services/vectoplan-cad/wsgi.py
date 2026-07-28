from __future__ import annotations

import os

from app import create_app

app = create_app(os.getenv("VECTOPLAN_CAD_CONFIG"))
application = app


if __name__ == "__main__":
    app.run(host=app.config["HOST"], port=app.config["PORT"], debug=app.config["DEBUG"])
