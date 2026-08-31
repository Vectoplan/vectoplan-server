from __future__ import annotations

from unittest.mock import patch

from src.core.client import CoreClientError, project_chunks_to_projection


CONFIG = {
    "CORE_INTERNAL_URL": "http://vectoplan-core:5000",
    "CORE_SERVICE_API_KEY": "test-key",
    "CORE_TIMEOUT_SECONDS": 45,
}


def test_initial_projection_load_uses_requested_stored_snapshot():
    stored = {"ok": True, "snapshot": {"projectionKey": "semantic-floor-plan-v2-storey-01"}}
    with patch("src.core.client._request", return_value=stored) as request:
        result = project_chunks_to_projection(
            CONFIG,
            "core-project-1",
            {
                "projectionKey": "semantic-floor-plan-v2-storey-01",
                "preferStoredSnapshot": True,
            },
        )

    assert result["snapshot"] == stored["snapshot"]
    assert result["snapshotSource"] == "stored"
    assert result["snapshotFallback"] is None
    assert request.call_count == 1
    assert request.call_args.kwargs["method"] == "GET"


def test_initial_projection_load_falls_back_to_stored_default_snapshot():
    stored = {"ok": True, "snapshot": {"projectionKey": "semantic-floor-plan-v2-default"}}
    with patch(
        "src.core.client._request",
        side_effect=[CoreClientError("projection missing"), stored],
    ) as request:
        result = project_chunks_to_projection(
            CONFIG,
            "core-project-1",
            {
                "projectionKey": "semantic-floor-plan-v2-new-storey",
                "preferStoredSnapshot": True,
            },
        )

    assert result["snapshot"] == stored["snapshot"]
    assert result["snapshotFallback"] == "semantic-floor-plan-v2-default"
    assert request.call_count == 2
    assert all(call.kwargs["method"] == "GET" for call in request.call_args_list)


def test_projection_rebuild_removes_internal_cache_preference_flag():
    rebuilt = {"ok": True, "snapshot": {"projectionKey": "semantic-floor-plan-v2-default"}}
    with patch("src.core.client._request", return_value=rebuilt) as request:
        result = project_chunks_to_projection(
            CONFIG,
            "core-project-1",
            {
                "projectionKey": "semantic-floor-plan-v2-default",
                "preferStoredSnapshot": False,
            },
        )

    assert result == rebuilt
    assert request.call_args.kwargs["method"] == "POST"
    assert "preferStoredSnapshot" not in request.call_args.kwargs["body"]
