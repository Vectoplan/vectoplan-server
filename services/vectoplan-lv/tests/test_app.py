from __future__ import annotations


def test_health_is_a_lightweight_liveness_probe(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {
        "status": "ok",
        "service": "vectoplan-lv",
        "version": "0.1.0",
    }


def test_testing_readiness_checks_database_and_startup(client):
    response = client.get("/ready")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["status"] == "ok"
    assert payload["checks"]["database"]["status"] == "ok"
    assert payload["checks"]["startup"]["status"] == "ok"


def test_ui_shell_is_available(client):
    response = client.get("/lv?project_public_id=prj_demo")

    assert response.status_code == 200
    assert b"VECTOPLAN LV" in response.data
    assert b"prj_demo" in response.data
    csp = response.headers["Content-Security-Policy"]
    assert "http://localhost:5103" in csp
    assert "http://localhost:5200" in csp
