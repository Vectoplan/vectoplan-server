from __future__ import annotations

from io import BytesIO


def test_gaeb_33_export_can_be_imported_and_manually_edited(client):
    source_lv = client.post("/v1/lvs", json={"name": "GAEB Quelle"}).get_json()
    source_items = f"/v1/lvs/{source_lv['public_id']}/items"
    client.post(
        source_items,
        json={
            "item_type": "position",
            "ordinal_number": "01.01.0010",
            "short_text": "Baustelle einrichten",
            "long_text": "Baustelleneinrichtung vollständig herstellen.",
            "quantity": "1",
            "unit": "psch",
            "unit_price": "2500",
        },
    )
    client.post(
        source_items,
        json={
            "item_type": "text",
            "short_text": "Vorbemerkung",
            "long_text": "Die VOB ist zu beachten.",
        },
    )

    exported = client.get(
        f"/v1/lvs/{source_lv['public_id']}/exports/gaeb?phase=84"
    )

    assert exported.status_code == 200
    assert exported.headers["X-GAEB-Version"] == "3.3"
    assert b"<GAEB" in exported.data
    assert b"<Version>3.3</Version>" in exported.data

    target_lv = client.post("/v1/lvs", json={"name": "GAEB Ziel"}).get_json()
    imported = client.post(
        f"/v1/lvs/{target_lv['public_id']}/imports/gaeb",
        data={"file": (BytesIO(exported.data), "quelle.X84")},
        content_type="multipart/form-data",
    )
    report = imported.get_json()

    assert imported.status_code == 201
    assert report["version"] == "3.3"
    assert report["phase"] == "X84"
    assert report["imported_count"] == 2
    assert report["schema_validation"] == "not_performed"

    listed = client.get(f"/v1/lvs/{target_lv['public_id']}/items").get_json()
    position = next(
        item for item in listed["items"] if item["item_type"] == "position"
    )
    changed = client.patch(
        f"/v1/items/{position['public_id']}",
        json={"short_text": "Manuell angepasste Baustelleneinrichtung"},
    )

    assert changed.status_code == 200
    assert changed.get_json()["short_text"].startswith("Manuell angepasst")


def test_gaeb_import_rejects_entity_declarations(client):
    lv = client.post("/v1/lvs", json={"name": "Sicherer Import"}).get_json()
    malicious = b"""<?xml version="1.0"?>
<!DOCTYPE GAEB [<!ENTITY x "unsafe">]>
<GAEB><GAEBInfo><Version>3.3</Version></GAEBInfo><Award><DP>83</DP></Award></GAEB>
"""

    response = client.post(
        f"/v1/lvs/{lv['public_id']}/imports/gaeb",
        data={"file": (BytesIO(malicious), "unsafe.X83")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "entity" in response.get_json()["error"]["message"].lower()
