"""Refresh deterministic LoD2 conversions inside the Berlin audit fixture.

The fixture intentionally keeps the original classified surfaces.  This tool
only replaces ``envelope.converted`` so the TypeScript geometry audit exercises
the current production converter against the same 40 parcels on every run.
"""
from __future__ import annotations

import json
from pathlib import Path

from src.geodata.lod2_conversion import convert_building


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "berlin_parcel_grid_samples.json"


def main() -> None:
    document = json.loads(FIXTURE.read_text(encoding="utf-8"))
    converted = 0
    for sample in document.get("samples", []):
        envelope = sample.get("envelope")
        if not envelope or not envelope.get("surfaces"):
            continue
        previous = envelope.get("converted") or {}
        source_tile = envelope.get("sourceTile") or previous.get("sourceTile") or sample.get("sourceTiles", ["unknown"])[0]
        source_sha = previous.get("sourceSha256") or "0" * 64
        envelope["converted"] = convert_building({
            "id": envelope["buildingId"],
            "sourceTile": source_tile,
            "sourceSha256": source_sha,
            "polygons": envelope["surfaces"],
        })
        envelope["conversionError"] = None
        converted += 1
    FIXTURE.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Refreshed {converted} Berlin LoD2 envelope conversions in {FIXTURE}")


if __name__ == "__main__":
    main()
