"""Compose numbered contact sheets from rendered PDF page images."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw


def page_number(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    return int(match.group(1)) if match else 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--columns", type=int, default=5)
    parser.add_argument("--rows", type=int, default=5)
    args = parser.parse_args()
    files = sorted(args.source.glob("page-*.jpg"), key=page_number)
    if not files:
        raise SystemExit("No rendered page images found")
    args.output.mkdir(parents=True, exist_ok=True)
    with Image.open(files[0]) as first:
        width, height = first.size
    capacity = args.columns * args.rows
    for start in range(0, len(files), capacity):
        batch = files[start : start + capacity]
        sheet = Image.new("RGB", (args.columns * width, args.rows * (height + 24)), "white")
        draw = ImageDraw.Draw(sheet)
        for index, path in enumerate(batch):
            with Image.open(path) as page:
                x = (index % args.columns) * width
                y = (index // args.columns) * (height + 24)
                sheet.paste(page, (x, y))
                draw.text((x + 5, y + height + 4), f"Seite {page_number(path)}", fill="black")
        sheet.save(args.output / f"contact-{start // capacity + 1:02}.jpg", quality=82)
    print(f"{len(files)} pages -> {len(list(args.output.glob('*.jpg')))} contact sheets")


if __name__ == "__main__":
    main()
