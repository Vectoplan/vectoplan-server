from __future__ import annotations


def _position(client) -> tuple[dict, dict]:
    lv = client.post("/v1/lvs", json={"name": "Abrechnungs-LV"}).get_json()
    item = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={
            "item_type": "position",
            "short_text": "Mauerwerk",
            "quantity": "20",
            "unit": "m²",
            "unit_price": "50",
        },
    ).get_json()
    return lv, item


def test_measurement_and_billing_entry_can_be_reopened_and_changed(client):
    lv, item = _position(client)
    endpoint = f"/v1/items/{item['public_id']}/billings"

    created = client.post(
        endpoint,
        json={
            "invoice_number": "1",
            "billed_quantity": "7,5",
            "notes": "Aufmaß Blatt 01",
            "attachments": [
                {
                    "name": "aufmass-01.pdf",
                    "size": 34567,
                    "content_type": "application/pdf",
                }
            ],
        },
    )
    entry = created.get_json()

    assert created.status_code == 201
    assert entry["invoice_number"] == "1"
    assert entry["billed_quantity"] == "7.500"
    assert entry["line_total"].startswith("375")
    assert entry["attachments_placeholder"] is True
    assert entry["attachments"][0]["state"] == "metadata_only"

    changed = client.post(
        endpoint,
        json={
            "public_id": entry["public_id"],
            "invoice_number": "1. Abschlag",
            "billed_quantity": "8",
            "notes": "korrigiertes Aufmaß",
            "attachments": [],
        },
    )

    assert changed.status_code == 200
    assert changed.get_json()["revision"] == 2
    assert changed.get_json()["attachments"] == []

    overview = client.get(f"/v1/lvs/{lv['public_id']}/billings").get_json()
    assert overview["count"] == 1
    assert overview["items"][0]["invoice_number"] == "1. Abschlag"


def test_text_rows_cannot_be_billed(client):
    lv = client.post("/v1/lvs", json={"name": "Text-LV"}).get_json()
    item = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={"item_type": "text", "short_text": "Hinweis"},
    ).get_json()

    response = client.post(
        f"/v1/items/{item['public_id']}/billings",
        json={"invoice_number": "1"},
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "validation_error"
