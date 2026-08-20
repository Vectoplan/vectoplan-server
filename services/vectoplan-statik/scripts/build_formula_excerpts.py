"""Build small, local source excerpts for the formula catalog.

The inputs are disposable PDF renderings under ``tmp``. Only deliberately
cropped excerpts are copied into the web assets; the original PDFs are never
served by the application.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "tmp" / "pdfs" / "catalog_sources_v2" / "rendered"
OUTPUT = ROOT / "static" / "statik" / "source-excerpts"

# output name: (rendered page, left, top, right, bottom), all crop values are
# relative and make the extraction reproducible when render resolution changes.
EXCERPTS = {
    "tragwerke-kraft.jpg": ("tragwerke-p052.jpg", 0.06, 0.10, 0.94, 0.83),
    "tragwerke-moment.jpg": ("tragwerke-p058.jpg", 0.06, 0.08, 0.94, 0.49),
    "tragwerke-gleichgewicht.jpg": ("tragwerke-p058.jpg", 0.06, 0.43, 0.94, 0.88),
    "tragwerke-normalspannung.jpg": ("tragwerke-p060.jpg", 0.06, 0.09, 0.94, 0.86),
    "tragwerke-lasten.jpg": ("tragwerke-p075.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-auflager.jpg": ("tragwerke-p083.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-schnittgroessen.jpg": ("tragwerke-p095.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-bemessung.jpg": ("tragwerke-p117.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-verformung.jpg": ("tragwerke-p125.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-fundament.jpg": ("tragwerke-p137.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-stahlbeton.jpg": ("tragwerke-p145.jpg", 0.06, 0.09, 0.94, 0.88),
    "tragwerke-stuetze.jpg": ("tragwerke-p154.jpg", 0.06, 0.09, 0.94, 0.88),
    "din1055-1-beton.jpg": ("din1055_1-p007.jpg", 0.05, 0.08, 0.95, 0.91),
    "din1055-1-mauerwerk.jpg": ("din1055_1-p008.jpg", 0.05, 0.08, 0.95, 0.91),
    "din1055-100-bemessungswert.jpg": ("din1055_100-p020.jpg", 0.05, 0.08, 0.95, 0.86),
    "din1055-100-widerstand.jpg": ("din1055_100-p022.jpg", 0.05, 0.08, 0.95, 0.86),
    "din1055-100-nachweis.jpg": ("din1055_100-p023.jpg", 0.05, 0.08, 0.95, 0.86),
    "din1055-100-kombination.jpg": ("din1055_100-p024.jpg", 0.05, 0.07, 0.95, 0.72),
    "din1055-100-gzg.jpg": ("din1055_100-p028.jpg", 0.05, 0.08, 0.95, 0.86),
    "din1055-4-geschwindigkeitsdruck.jpg": ("din1055_4-p014.jpg", 0.05, 0.08, 0.95, 0.86),
    "din1055-4-druck.jpg": ("din1055_4-p015.jpg", 0.05, 0.08, 0.95, 0.74),
    "din1055-4-berichtigung.jpg": ("din1055_4_ber-p005.jpg", 0.05, 0.08, 0.95, 0.90),
    "din1055-5-bodenschnee.jpg": ("din1055_5-p006.jpg", 0.05, 0.08, 0.95, 0.90),
    "din1055-5-lastanordnung.jpg": ("din1055_5-p008.jpg", 0.05, 0.08, 0.95, 0.88),
    "din1055-5-formbeiwert.jpg": ("din1055_5-p010.jpg", 0.05, 0.15, 0.95, 0.82),
}


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for output_name, (input_name, left, top, right, bottom) in EXCERPTS.items():
        with Image.open(INPUT / input_name) as source:
            width, height = source.size
            crop = source.crop((int(width * left), int(height * top), int(width * right), int(height * bottom)))
            crop = ImageOps.exif_transpose(crop)
            if crop.width > 1100:
                crop.thumbnail((1100, 1400), Image.Resampling.LANCZOS)
            crop.convert("RGB").save(OUTPUT / output_name, "JPEG", quality=86, optimize=True)
    print(f"Built {len(EXCERPTS)} excerpts in {OUTPUT}")


if __name__ == "__main__":
    main()
