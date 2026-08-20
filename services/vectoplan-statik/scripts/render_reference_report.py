"""Generate the stable residential-plate report used for visual QA."""

from __future__ import annotations

from pathlib import Path

from src.pipeline import CalculationPipeline
from src.reference_cases import ReferenceCaseRepository
from src.reports.renderer import StructuralReportRenderer


SERVICE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = SERVICE_ROOT / "output" / "pdf" / "reference_residential_plate.pdf"


def main() -> None:
    job = ReferenceCaseRepository().get("residential_plate")
    result = CalculationPipeline().run(job)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(StructuralReportRenderer().render_pdf(job, result))
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
