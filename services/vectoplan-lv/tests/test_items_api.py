from __future__ import annotations


def _create_lv(client, name: str = "Test-LV") -> dict:
    response = client.post("/v1/lvs", json={"name": name})
    assert response.status_code == 201
    return response.get_json()


def test_position_can_be_created_and_edited_manually(client):
    lv = _create_lv(client)

    created = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={
            "item_type": "position",
            "ordinal_number": "01.01.0010",
            "short_text": "Beton liefern",
            "long_text": "Beton C25/30 liefern und einbauen",
            "quantity": "2,500",
            "unit": "m³",
            "unit_price": "120.40",
        },
    )
    item = created.get_json()

    assert created.status_code == 201
    assert item["ordinal_number"] == "01.01.0010"
    assert item["quantity"] == "2.500"
    assert item["unit_price"] == "120.4000"
    assert item["total_price"].startswith("301.0")

    changed = client.patch(
        f"/v1/items/{item['public_id']}",
        json={"short_text": "Beton C30/37 liefern", "unit_price": "130"},
    )
    payload = changed.get_json()

    assert changed.status_code == 200
    assert payload["short_text"] == "Beton C30/37 liefern"
    assert payload["unit_price"] == "130.0000"
    assert payload["revision"] == 2


def test_free_text_row_has_no_calculation_fields(client):
    lv = _create_lv(client)

    response = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={
            "item_type": "text",
            "short_text": "Ausführungshinweis",
            "long_text": "Alle Maße sind vor Ort zu prüfen.",
            "quantity": "99",
            "unit": "St",
            "unit_price": "10",
        },
    )
    payload = response.get_json()

    assert response.status_code == 201
    assert payload["item_type"] == "text"
    assert payload["ordinal_number"] is None
    assert payload["quantity"] is None
    assert payload["unit"] is None
    assert payload["unit_price"] is None


def test_ordinal_number_is_unique_inside_current_version(client):
    lv = _create_lv(client)
    endpoint = f"/v1/lvs/{lv['public_id']}/items"
    position = {
        "item_type": "position",
        "ordinal_number": "01.01.0010",
        "short_text": "Erste Position",
    }

    assert client.post(endpoint, json=position).status_code == 201
    duplicate = client.post(
        endpoint,
        json={**position, "short_text": "Doppelte OZ"},
    )

    assert duplicate.status_code == 409
    assert duplicate.get_json()["error"]["code"] == "lv_conflict"
