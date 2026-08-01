from __future__ import annotations


def _lv_with_positions(client) -> tuple[dict, list[dict]]:
    lv = client.post(
        "/v1/lvs",
        json={"name": "Vergabe-LV", "currency": "EUR"},
    ).get_json()
    positions = [
        client.post(
            f"/v1/lvs/{lv['public_id']}/items",
            json={
                "item_type": "position",
                "short_text": "Beton C25/30",
                "quantity": "125.000",
                "unit": "m³",
            },
        ).get_json(),
        client.post(
            f"/v1/lvs/{lv['public_id']}/items",
            json={
                "item_type": "position",
                "short_text": "Bewehrungsstahl B500",
                "quantity": "8.500",
                "unit": "t",
            },
        ).get_json(),
    ]
    return lv, positions


def test_multiple_positions_can_be_queued_for_multiple_recipients(client):
    lv, positions = _lv_with_positions(client)
    response = client.post(
        f"/v1/lvs/{lv['public_id']}/inquiries",
        json={
            "item_public_ids": [item["public_id"] for item in positions],
            "title": "Rohbaupaket",
            "message": "Bitte bis zum Termin anbieten.",
            "due_date": "2026-08-15",
            "queue_for_delivery": True,
            "recipients": [
                {
                    "company_name": "Baupartner Nord GmbH",
                    "contact_email": "angebot@baupartner.example",
                    "external_company_id": "company_42",
                    "source": "suggestion",
                    "distance_km": "18.4",
                    "matched_services": ["Betonarbeiten", "Bewehrung"],
                    "match_reasons": ["Leistung passt", "regional"],
                },
                {
                    "company_name": "Rohbau Süd KG",
                    "contact_email": "kalkulation@rohbau.example",
                },
            ],
        },
        headers={"X-Vectoplan-User-Id": "usr_demo"},
    )

    assert response.status_code == 201
    inquiry = response.get_json()
    assert inquiry["status"] == "queued"
    assert inquiry["item_count"] == 2
    assert inquiry["recipient_count"] == 2
    assert inquiry["offer_count"] == 0
    assert inquiry["items"][0]["short_text"] == "Beton C25/30"
    assert inquiry["recipients"][0]["external_company_id"] == "company_42"
    assert inquiry["recipients"][0]["status"] == "queued"
    assert inquiry["created_by"] == "usr_demo"

    listed = client.get(
        f"/v1/lvs/{lv['public_id']}/inquiries"
    ).get_json()
    assert listed["count"] == 1
    assert listed["items"][0]["public_id"] == inquiry["public_id"]


def test_supplier_response_and_later_llm_assessment_are_separate(client):
    lv, positions = _lv_with_positions(client)
    inquiry = client.post(
        f"/v1/lvs/{lv['public_id']}/inquiries",
        json={
            "item_public_ids": [positions[0]["public_id"]],
            "queue_for_delivery": True,
            "recipients": [
                {
                    "company_name": "Beton Direkt GmbH",
                    "contact_email": "info@beton-direkt.example",
                }
            ],
        },
    ).get_json()
    recipient = inquiry["recipients"][0]

    delivered = client.patch(
        (
            f"/v1/inquiries/{inquiry['public_id']}/recipients/"
            f"{recipient['public_id']}/delivery"
        ),
        json={"status": "sent"},
    )
    assert delivered.status_code == 200
    assert delivered.get_json()["status"] == "sent"
    assert delivered.get_json()["recipients"][0]["sent_at"] is not None

    response = client.post(
        f"/v1/inquiries/{inquiry['public_id']}/responses",
        json={
            "recipient_public_id": recipient["public_id"],
            "response_type": "offer",
            "total_amount": "18450.75",
            "currency": "EUR",
            "delivery_days": 12,
            "valid_until": "2026-09-01",
            "message": "Preis frei Baustelle.",
        },
    )
    assert response.status_code == 201
    payload = response.get_json()
    assert payload["inquiry"]["status"] == "offers_received"
    assert payload["inquiry"]["offer_count"] == 1
    assert payload["offer"]["total_amount"] == "18450.7500"
    assert payload["offer"]["llm_assessment"] is None
    assert payload["offer"]["llm_assessment_status"] == "pending"

    assessed = client.patch(
        f"/v1/offers/{payload['offer']['public_id']}/assessment",
        json={
            "llm_assessment": {
                "recommendation": "prüfen",
                "score": 82,
                "summary": "Preis vollständig, Lieferfrist realistisch.",
                "confidence": 0.91,
            }
        },
    )
    assert assessed.status_code == 200
    assert assessed.get_json()["llm_assessment_status"] == "completed"
    assert assessed.get_json()["llm_assessment"]["score"] == 82


def test_inquiries_are_project_scoped_and_only_accept_positions(client):
    lv, _ = _lv_with_positions(client)
    text = client.post(
        f"/v1/lvs/{lv['public_id']}/items",
        json={"item_type": "text", "short_text": "Hinweis"},
    ).get_json()

    rejected = client.post(
        f"/v1/lvs/{lv['public_id']}/inquiries",
        json={"item_public_ids": [text["public_id"]]},
    )
    assert rejected.status_code == 400

    inquiry = client.post(
        f"/v1/lvs/{lv['public_id']}/inquiries",
        json={
            "item_public_ids": [
                client.get(
                    f"/v1/lvs/{lv['public_id']}/items"
                ).get_json()["items"][0]["public_id"]
            ]
        },
    ).get_json()
    hidden = client.get(
        f"/v1/inquiries/{inquiry['public_id']}",
        headers={"X-Vectoplan-Project-Id": "another-project"},
    )
    assert hidden.status_code == 404


def test_company_suggestion_endpoint_exposes_not_connected_boundary(client):
    lv, positions = _lv_with_positions(client)
    response = client.get(
        f"/v1/lvs/{lv['public_id']}/recipient-suggestions",
        query_string=[
            ("item_public_id", positions[0]["public_id"]),
            ("item_public_id", positions[1]["public_id"]),
        ],
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "items": [],
        "count": 0,
        "provider": "not_connected",
        "automation_ready": True,
    }
