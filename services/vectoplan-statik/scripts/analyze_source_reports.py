"""Build a page-level text and keyword index for structural-report PDFs."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


KEYWORDS = (
    "inhaltsverzeichnis",
    "vorbemerkungen",
    "baubeschreibung",
    "grundlagen",
    "baustoffe",
    "lastannahmen",
    "lastkombination",
    "position",
    "decke",
    "balken",
    "unterzug",
    "stütze",
    "wand",
    "fundament",
    "gründung",
    "bodenplatte",
    "dach",
    "halle",
    "brücke",
    "bemessung",
    "nachweis",
    "bewehrung",
    "verformung",
    "spannungen",
)


def clean(text: str) -> str:
    return re.sub(r"[ \t]+", " ", re.sub(r"\r\n?", "\n", text or "")).strip()


def inspect(path: Path, output: Path) -> dict:
    reader = PdfReader(path)
    pages = []
    report_text = []
    for index, page in enumerate(reader.pages, start=1):
        text = clean(page.extract_text() or "")
        report_text.append(f"\n\n===== SEITE {index} =====\n{text}")
        lower = text.casefold()
        matches = [keyword for keyword in KEYWORDS if keyword in lower]
        visible_lines = [line.strip() for line in text.splitlines() if line.strip()]
        pages.append(
            {
                "page": index,
                "characters": len(text),
                "head": visible_lines[:12],
                "keywords": matches,
            }
        )
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", path.stem)
    (output / f"{stem}.txt").write_text("".join(report_text), encoding="utf-8")
    return {
        "file": str(path),
        "pages": len(reader.pages),
        "text_pages": sum(item["characters"] > 80 for item in pages),
        "page_index": pages,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    index = [inspect(path.resolve(), args.output) for path in args.pdfs]
    target = args.output / "source_report_index.json"
    target.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(target)


if __name__ == "__main__":
    main()
