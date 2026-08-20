"""Generate the reviewed multi-position structural calculation book."""

from __future__ import annotations

from pathlib import Path

from src.projects import ProjectCalculationPipeline, ProjectCaseRepository
from src.reports.project_renderer import ProjectReportRenderer


SERVICE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = SERVICE_ROOT / "output" / "pdf" / "complex_residential_structural_report.pdf"


def main() -> None:
    project = ProjectCaseRepository().get("complex_residential_building")
    result = ProjectCalculationPipeline().run(project)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(ProjectReportRenderer().render_pdf(project, result))
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
