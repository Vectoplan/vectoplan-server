from __future__ import annotations

import json
from unittest.mock import patch

from flask import Flask

from routes.realtime import realtime_bp


def _client(monkeypatch):
    monkeypatch.setenv("VECTOPLAN_EDITOR_REALTIME_INTERNAL_TOKEN", "test-realtime-token")
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(realtime_bp)
    return app.test_client()


def test_core_invalidation_is_broadcast_to_the_project_world_room(monkeypatch):
    client = _client(monkeypatch)
    with (
        patch("routes.realtime._HUB.peers", return_value=[object(), object()]),
        patch("routes.realtime._HUB.broadcast") as broadcast,
    ):
        response = client.post(
            "/editor/api/realtime/invalidate",
            headers={
                "X-Service-ID": "vectoplan-core",
                "X-Vectoplan-Internal-Token": "test-realtime-token",
            },
            json={
                "projectId": "chunk-project-1",
                "worldId": "world-1",
                "commandType": "PlaceObject",
                "eventIds": ["evt-1"],
                "changedChunks": ["-1:0:2"],
                "dirtyChunks": ["-1:0:2", "-2:-1:2"],
                "chunkVersions": {"-1:0:2": "v2"},
            },
        )

    assert response.status_code == 200
    response_payload = response.get_json()
    assert response_payload["recipientCount"] == 2
    assert response_payload["changedChunks"] == ["-1:0:2"]
    assert response_payload["dirtyChunks"] == ["-1:0:2", "-2:-1:2"]
    room_id, message = broadcast.call_args.args
    assert room_id == "chunk-project-1:world-1"
    envelope = json.loads(message)
    assert envelope["type"] == "world.invalidate"
    assert envelope["invalidation"]["changedChunks"] == ["-1:0:2"]
    assert envelope["invalidation"]["dirtyChunks"] == ["-1:0:2", "-2:-1:2"]
    assert envelope["invalidation"]["chunkVersions"] == {"-1:0:2": "v2"}
    assert envelope["invalidation"]["userId"] == "vectoplan-core"


def test_invalidation_rejects_an_invalid_internal_token(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/editor/api/realtime/invalidate",
        headers={
            "X-Service-ID": "vectoplan-core",
            "X-Vectoplan-Internal-Token": "wrong-token",
        },
        json={"projectId": "chunk-project-1", "worldId": "world-1"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "invalid_internal_token"
