"""Generate the reviewed sample of the adaptive universal report template."""

from __future__ import annotations

from pathlib import Path

from src.pipeline import CalculationPipeline
from src.reference_cases import ReferenceCaseRepository
from src.reports.renderer import StructuralReportRenderer


SERVICE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = SERVICE_ROOT / "output" / "pdf" / "universal_structural_report.pdf"


def main() -> None:
    job = ReferenceCaseRepository().get("residential_plate")
    job = {
        **job,
        "element_ref": "P-01",
        "element_label": "P-01 · Stahlbetondecke über Erdgeschoss",
        "project_metadata": {
            "name": "Musterprojekt · adaptive Statikakte",
            "phase": "Entwurf / Rechenkern-Demonstrator",
            "location": "Deutschland · projektspezifisch festzulegen",
        },
    }
    result = CalculationPipeline().run(job)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(StructuralReportRenderer().render_pdf(job, result))
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
