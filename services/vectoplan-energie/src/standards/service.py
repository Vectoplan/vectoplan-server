"""Load immutable calculation/rule metadata profiles."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_rule_profile(root: str | Path, profile_id: str = "de-working-2026.1") -> dict[str, Any] | None:
    safe_id = "".join(character for character in str(profile_id) if character.isalnum() or character in {"-", "_", "."})
    if not safe_id or safe_id != profile_id:
        return None
    path = Path(root) / f"{safe_id}.json"
    if not path.is_file():
        return None
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    return value if isinstance(value, dict) else None


__all__ = ["load_rule_profile"]
