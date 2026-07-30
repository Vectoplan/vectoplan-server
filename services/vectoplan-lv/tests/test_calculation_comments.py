from __future__ import annotations

from decimal import Decimal

from src.billing.calculation import evaluate_calculation_rows


def test_comment_only_calculation_rows_are_preserved_without_changing_total():
    rows, total = evaluate_calculation_rows(
        [
            {"expression": "2 * 3", "note": "Wandfläche"},
            {"expression": "", "note": "Öffnung wurde bereits abgezogen"},
        ]
    )

    assert total == Decimal("6")
    assert rows == [
        {"expression": "2 * 3", "note": "Wandfläche", "result": "6.000"},
        {
            "expression": "",
            "note": "Öffnung wurde bereits abgezogen",
            "result": "",
        },
    ]


def test_comment_only_update_keeps_existing_lv_quantity(client):
    lv = client.post("/v1/lvs", json={"name": "Kommentar-LV"}).get_json()
    position = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={
            "item_type": "position",
            "short_text": "Kommentarposition",
            "quantity": "7.5",
            "unit": "m²",
            "unit_price": "10",
        },
    ).get_json()

    response = client.patch(
        f"/v1/items/{position['public_id']}",
        json={
            "calculation_rows": [
                {
                    "expression": "",
                    "note": "Menge wurde aus dem Bestandsplan übernommen",
                }
            ]
        },
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["quantity"] == "7.500"
    assert payload["calculation_total"] is None
    assert payload["calculation_rows"][0]["note"].startswith("Menge wurde")
