from __future__ import annotations


PROJECT_HEADERS = {
    "X-Vectoplan-Project-Id": "prj_demo",
    "X-Vectoplan-User-Id": "usr_editor",
}


def test_create_lv_also_creates_initial_draft_version(client):
    response = client.post(
        "/v1/lvs",
        headers=PROJECT_HEADERS,
        json={
            "name": "Neubau Verwaltungsgebäude",
            "description": "Ausschreibung Rohbau",
            "kind": "tender",
            "currency": "EUR",
        },
    )
    payload = response.get_json()

    assert response.status_code == 201
    assert payload["public_id"].startswith("lv_")
    assert payload["project_public_id"] == "prj_demo"
    assert payload["current_draft_version_id"].startswith("lvv_")
    assert payload["versions"][0]["status"] == "draft"
    assert payload["versions"][0]["mutable"] is True
    assert response.headers["Location"].endswith(payload["public_id"])


def test_lv_list_is_always_project_scoped(client):
    client.post(
        "/v1/lvs",
        headers=PROJECT_HEADERS,
        json={"name": "Projekt A"},
    )

    own = client.get("/v1/lvs", headers=PROJECT_HEADERS)
    other = client.get(
        "/v1/lvs",
        headers={"X-Vectoplan-Project-Id": "prj_other"},
    )

    assert own.status_code == 200
    assert own.get_json()["count"] == 1
    assert other.status_code == 200
    assert other.get_json()["count"] == 0


def test_cross_project_lookup_returns_404(client):
    created = client.post(
        "/v1/lvs",
        headers=PROJECT_HEADERS,
        json={"name": "Nur Projekt A"},
    ).get_json()

    response = client.get(
        f"/v1/lvs/{created['public_id']}",
        headers={"X-Vectoplan-Project-Id": "prj_other"},
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "lv_not_found"


def test_project_context_defaults_to_project_one(client):
    created = client.post(
        "/v1/lvs",
        json={"name": "Fundament Projekt 1"},
    )
    response = client.get("/v1/lvs")

    assert created.status_code == 201
    assert created.get_json()["project_public_id"] == "1"
    assert response.status_code == 200
    assert response.get_json()["count"] == 1


def test_invalid_kind_is_rejected_without_partial_write(client):
    response = client.post(
        "/v1/lvs",
        headers=PROJECT_HEADERS,
        json={"name": "Fehlerhaft", "kind": "unknown"},
    )
    listed = client.get("/v1/lvs", headers=PROJECT_HEADERS).get_json()

    assert response.status_code == 400
    assert listed["count"] == 0
