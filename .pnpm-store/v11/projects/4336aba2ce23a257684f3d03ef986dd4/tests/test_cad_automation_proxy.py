from __future__ import annotations

import json
from urllib.error import URLError

from flask import Flask

import routes.cad as cad_routes


class _FakeUpstream:
    status = 200
    headers = {"Content-Type": "application/json"}

    def __init__(self, payload: dict):
        self._body = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _limit: int) -> bytes:
        return self._body


def _client():
    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        VECTOPLAN_EDITOR_CAD_SERVICE_INTERNAL_URL="http://cad.internal:5000",
        VECTOPLAN_EDITOR_CAD_AUTOMATION_TIMEOUT_SECONDS=12,
    )
    app.register_blueprint(cad_routes.cad_bp)
    return app.test_client()


def test_roof_calculation_is_forwarded_to_the_internal_cad_service(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["method"] = request.method
        captured["payload"] = json.loads(request.data)
        captured["timeout"] = timeout
        return _FakeUpstream({"ok": True, "roof_type": "gable"})

    monkeypatch.setattr(cad_routes, "urlopen", fake_urlopen)
    response = _client().post(
        "/editor/api/cad/automation/roof/calculate",
        json={"roof_type": "gable", "footprint": {"outer_ring_mm": []}},
    )

    assert response.status_code == 200
    assert response.get_json() == {"ok": True, "roof_type": "gable"}
    assert captured == {
        "url": "http://cad.internal:5000/api/v1/cad/automation/roof/calculate",
        "method": "POST",
        "payload": {"roof_type": "gable", "footprint": {"outer_ring_mm": []}},
        "timeout": 12.0,
    }


def test_roof_calculation_proxy_rejects_non_object_json():
    response = _client().post(
        "/editor/api/cad/automation/roof/calculate",
        json=["not", "an", "object"],
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_roof_calculation_request"


def test_roof_calculation_proxy_reports_an_unavailable_cad_service(monkeypatch):
    def fail_urlopen(_request, timeout):
        assert timeout == 12.0
        raise URLError("offline")

    monkeypatch.setattr(cad_routes, "urlopen", fail_urlopen)
    response = _client().post(
        "/editor/api/cad/automation/roof/calculate",
        json={"roof_type": "hipped"},
    )

    assert response.status_code == 502
    assert response.get_json()["error"] == "cad_roof_calculation_unavailable"
