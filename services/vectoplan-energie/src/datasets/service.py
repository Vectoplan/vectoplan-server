"""Load immutable example/verification cases from disk."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _root(config: Any) -> Path:
    return Path(config["DATASET_ROOT"])


def _read(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("dataset must be a JSON object")
    return value


def list_datasets(config: Any) -> list[dict[str, Any]]:
    rows = []
    for path in sorted(_root(config).glob("*.json")):
        data = _read(path)
        rows.append(
            {
                "id": str(data.get("dataset_id") or path.stem),
                "label": str(data.get("dataset_label") or path.stem),
                "description": str(data.get("dataset_description") or ""),
                "building_type": data.get("building", {}).get("type"),
                "condition": data.get("building", {}).get("condition"),
            }
        )
    return rows


def get_dataset(config: Any, dataset_id: str) -> dict[str, Any] | None:
    safe_id = "".join(character for character in str(dataset_id) if character.isalnum() or character in {"-", "_"})
    if not safe_id or safe_id != dataset_id:
        return None
    path = _root(config) / f"{safe_id}.json"
    return _read(path) if path.is_file() else None


__all__ = ["get_dataset", "list_datasets"]
