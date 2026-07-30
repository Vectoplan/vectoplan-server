from __future__ import annotations

import pytest

from src.billing.calculation import evaluate_expression
from src.lvs.errors import LvValidationError


def _position(client) -> tuple[dict, dict]:
    lv = client.post("/v1/lvs", json={"name": "Rechenweg-LV"}).get_json()
    item = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={
            "item_type": "position",
            "short_text": "Wandfläche",
            "quantity": "20",
            "unit": "m²",
            "unit_price": "50",
        },
    ).get_json()
    return lv, item


def test_safe_expression_evaluator_supports_german_decimal_input():
    assert evaluate_expression("2,5 × 4 + (3 / 2)") == pytest.approx(11.5)


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os')",
        "2 ** 8",
        "1 / 0",
        "sqrt(4)",
    ],
)
def test_safe_expression_evaluator_rejects_unsafe_or_invalid_input(expression):
    with pytest.raises(LvValidationError):
        evaluate_expression(expression)


def test_calculation_rows_form_the_billed_quantity_and_can_be_changed(client):
    lv, item = _position(client)
    endpoint = f"/v1/items/{item['public_id']}/billings"
    created = client.post(
        endpoint,
        json={
            "invoice_number": "1",
            "notes": "Aufmaß Erdgeschoss",
            "calculation_rows": [
                {"expression": "2,5 * 4", "note": "Wand Nord"},
                {"expression": "3 * 1,2", "note": "Wand Ost"},
            ],
        },
    )
    entry = created.get_json()

    assert created.status_code == 201
    assert entry["billed_quantity"] == "13.600"
    assert entry["calculation_total"] == "13.600"
    assert [row["result"] for row in entry["calculation_rows"]] == [
        "10.000",
        "3.600",
    ]
    assert entry["line_total"] == "680.0000"

    changed = client.post(
        endpoint,
        json={
            "public_id": entry["public_id"],
            "invoice_number": "1",
            "calculation_rows": [
                {"expression": "2,5 * 5", "note": "korrigierte Wand Nord"},
            ],
        },
    )
    payload = changed.get_json()

    assert changed.status_code == 200
    assert payload["revision"] == 2
    assert payload["billed_quantity"] == "12.500"
    assert payload["calculation_total"] == "12.500"
    assert payload["notes"] == "Aufmaß Erdgeschoss"

    overview = client.get(f"/v1/lvs/{lv['public_id']}/billings").get_json()
    assert overview["items"][0]["calculation_rows"][0]["note"] == (
        "korrigierte Wand Nord"
    )


def test_negative_calculation_sum_is_rejected(client):
    _, item = _position(client)

    response = client.post(
        f"/v1/items/{item['public_id']}/billings",
        json={
            "invoice_number": "1",
            "calculation_rows": [{"expression": "2 - 3", "note": "Fehler"}],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "validation_error"
