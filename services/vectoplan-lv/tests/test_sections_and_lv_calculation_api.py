from __future__ import annotations


def _create_lv(client) -> dict:
    response = client.post("/v1/lvs", json={"name": "Gliederungs-LV"})
    assert response.status_code == 201
    return response.get_json()


def _create_item(client, lv_id: str, **payload) -> dict:
    response = client.post(f"/v1/lvs/{lv_id}/items", json=payload)
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_sections_build_three_level_ordinals_and_reorder_renumbers_them(client):
    lv = _create_lv(client)
    title_01 = _create_item(
        client,
        lv["public_id"],
        item_type="title",
        short_text="Rohbau",
    )
    section_01 = _create_item(
        client,
        lv["public_id"],
        item_type="section",
        parent_public_id=title_01["public_id"],
        short_text="Mauerarbeiten",
    )
    position_a = _create_item(
        client,
        lv["public_id"],
        item_type="position",
        parent_public_id=section_01["public_id"],
        short_text="Außenwand",
    )
    position_b = _create_item(
        client,
        lv["public_id"],
        item_type="position",
        parent_public_id=section_01["public_id"],
        short_text="Innenwand",
    )
    direct_position = _create_item(
        client,
        lv["public_id"],
        item_type="position",
        parent_public_id=title_01["public_id"],
        short_text="Baustelleneinrichtung",
    )
    title_02 = _create_item(
        client,
        lv["public_id"],
        item_type="title",
        short_text="Ausbau",
    )

    assert title_01["ordinal_number"] == "01"
    assert section_01["ordinal_number"] == "01.01"
    assert position_a["ordinal_number"] == "01.01.0010"
    assert position_b["ordinal_number"] == "01.01.0020"
    assert direct_position["ordinal_number"] == "01.0010"
    assert title_02["ordinal_number"] == "02"

    order = [
        {"public_id": title_02["public_id"], "parent_public_id": None},
        {"public_id": title_01["public_id"], "parent_public_id": None},
        {
            "public_id": section_01["public_id"],
            "parent_public_id": title_01["public_id"],
        },
        {
            "public_id": position_b["public_id"],
            "parent_public_id": section_01["public_id"],
        },
        {
            "public_id": direct_position["public_id"],
            "parent_public_id": title_01["public_id"],
        },
        {
            "public_id": position_a["public_id"],
            "parent_public_id": title_01["public_id"],
        },
    ]
    response = client.post(
        f"/v1/lvs/{lv['public_id']}/items/reorder",
        json={"order": order},
    )
    items = {
        item["public_id"]: item
        for item in response.get_json()["items"]
    }

    assert response.status_code == 200
    assert items[title_02["public_id"]]["ordinal_number"] == "01"
    assert items[title_01["public_id"]]["ordinal_number"] == "02"
    assert items[section_01["public_id"]]["ordinal_number"] == "02.01"
    assert items[position_b["public_id"]]["ordinal_number"] == "02.01.0010"
    assert items[direct_position["public_id"]]["ordinal_number"] == "02.0010"
    assert items[position_a["public_id"]]["ordinal_number"] == "02.0020"


def test_section_requires_a_title_parent(client):
    lv = _create_lv(client)
    response = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={"item_type": "section", "short_text": "Ohne Titel"},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "validation_error"


def test_lv_calculation_rows_set_quantity_and_keep_document_metadata(client):
    lv = _create_lv(client)
    position = _create_item(
        client,
        lv["public_id"],
        item_type="position",
        short_text="Wandfläche",
        quantity="1",
        unit="m²",
        unit_price="50",
    )

    response = client.patch(
        f"/v1/items/{position['public_id']}",
        json={
            "calculation_rows": [
                {"expression": "2,5 * 4", "note": "Wand Nord"},
                {"expression": "3 * 1,2", "note": "Wand Ost"},
            ],
            "calculation_note": "Mengenermittlung nach Plan A-01",
            "calculation_attachments": [
                {
                    "name": "plan-a-01.pdf",
                    "size": 12000,
                    "content_type": "application/pdf",
                }
            ],
        },
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["quantity"] == "13.600"
    assert payload["calculation_total"] == "13.600"
    assert payload["total_price"] == "680.0000"
    assert len(payload["calculation_rows"]) == 2
    assert payload["calculation_note"] == "Mengenermittlung nach Plan A-01"
    assert payload["calculation_attachments"][0]["name"] == "plan-a-01.pdf"
    assert payload["calculation_attachments"][0]["state"] == "metadata_only"
