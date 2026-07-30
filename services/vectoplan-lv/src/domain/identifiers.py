"""Stable public identifier generation and validation."""

from __future__ import annotations

import re
from uuid import uuid4


PUBLIC_ID_PATTERN = re.compile(r"^[a-z][a-z0-9]{1,7}_[0-9a-f]{24}$")


def new_public_id(prefix: str) -> str:
    normalized = str(prefix).strip().lower()
    if not re.fullmatch(r"[a-z][a-z0-9]{1,7}", normalized):
        raise ValueError("public ID prefix must contain 2-8 lowercase characters")
    return f"{normalized}_{uuid4().hex[:24]}"


def is_public_id(value: object, prefix: str | None = None) -> bool:
    text = str(value or "").strip().lower()
    if not PUBLIC_ID_PATTERN.fullmatch(text):
        return False
    return prefix is None or text.startswith(f"{prefix.lower()}_")


__all__ = ["PUBLIC_ID_PATTERN", "is_public_id", "new_public_id"]
