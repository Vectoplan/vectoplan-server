"""Safe local loader for calculation reference cases."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ReferenceCaseRepository:
    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or Path(__file__).resolve().parent).resolve()
        self._index = self._read(self.root / "index.json")

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        with path.open("r", encoding="utf-8") as stream:
            return json.load(stream)

    def catalog(self) -> dict[str, Any]:
        return self._index

    def get(self, case_id: str) -> dict[str, Any]:
        match = next((item for item in self._index["cases"] if item["case_id"] == case_id), None)
        if not match:
            raise KeyError(case_id)
        path = (self.root / str(match["file"])).resolve()
        if path.parent != self.root or not path.is_file():
            raise ValueError("Reference case path is invalid")
        return self._read(path)
