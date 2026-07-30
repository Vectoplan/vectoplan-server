from __future__ import annotations


def _create_lv(client) -> dict:
    response = client.post("/v1/lvs", json={"name": "Struktur-LV"})
    assert response.status_code == 201
    return response.get_json()


def _create_item(client, lv_id: str, **payload) -> dict:
    response = client.post(f"/v1/lvs/{lv_id}/items", json=payload)
    assert response.status_code == 201
    return response.get_json()


def test_titles_group_positions_and_order_can_be_persisted(client):
    lv = _create_lv(client)
    title_01 = _create_item(
        client,
        lv["public_id"],
        item_type="title",
        short_text="Rohbau",
    )
    position_01 = _create_item(
        client,
        lv["public_id"],
        item_type="position",
        parent_public_id=title_01["public_id"],
        short_text="Mauerwerk",
        quantity="5",
        unit="m²",
        unit_price="40",
    )
    position_02 = _create_item(
        client,
        lv["public_id"],
        item_type="position",
        parent_public_id=title_01["public_id"],
        short_text="Beton",
        quantity="2",
        unit="m³",
        unit_price="120",
    )
    title_02 = _create_item(
        client,
        lv["public_id"],
        item_type="title",
        short_text="Ausbau",
    )

    assert title_01["ordinal_number"] == "01"
    assert title_02["ordinal_number"] == "02"
    assert position_01["parent_public_id"] == title_01["public_id"]

    order = [
        {"public_id": title_02["public_id"], "parent_public_id": None},
        {
            "public_id": position_01["public_id"],
            "parent_public_id": title_02["public_id"],
        },
        {"public_id": title_01["public_id"], "parent_public_id": None},
        {
            "public_id": position_02["public_id"],
            "parent_public_id": title_01["public_id"],
        },
    ]
    response = client.post(
        f"/v1/lvs/{lv['public_id']}/items/reorder",
        json={"order": order},
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert [item["public_id"] for item in payload["items"]] == [
        entry["public_id"] for entry in order
    ]
    assert payload["items"][1]["parent_public_id"] == title_02["public_id"]
    assert payload["items"][3]["parent_public_id"] == title_01["public_id"]
    assert [item["sort_order"] for item in payload["items"]] == [10, 20, 30, 40]


def test_parent_must_be_a_title_in_the_same_lv(client):
    first_lv = _create_lv(client)
    second_lv = client.post("/v1/lvs", json={"name": "Zweites LV"}).get_json()
    foreign_title = _create_item(
        client,
        second_lv["public_id"],
        item_type="title",
        short_text="Fremder Titel",
    )

    response = client.post(
        f"/v1/lvs/{first_lv['public_id']}/items",
        json={
            "item_type": "position",
            "parent_public_id": foreign_title["public_id"],
            "short_text": "Unzulässige Position",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "validation_error"


def test_reorder_requires_every_active_item_exactly_once(client):
    lv = _create_lv(client)
    title = _create_item(
        client,
        lv["public_id"],
        item_type="title",
        short_text="Titel",
    )
    _create_item(
        client,
        lv["public_id"],
        item_type="position",
        parent_public_id=title["public_id"],
        short_text="Position",
    )

    response = client.post(
        f"/v1/lvs/{lv['public_id']}/items/reorder",
        json={"order": [{"public_id": title["public_id"]}]},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "validation_error"
