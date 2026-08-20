"""UI and stateless preparation APIs for structural engineering."""

from __future__ import annotations

import io

from flask import Blueprint, Response, current_app, jsonify, redirect, render_template, request, send_file, url_for

from src.analysis.service import calculate_concept, validate_analysis_request
from src.commands.service import build_command_receipt, validate_command
from src.exchange import Saf22Exporter, build_neutral_exchange
from src.materials import default_material_catalog
from src.knowledge import CalculationPathRegistry, EurocodeRegistry, FormulaRegistry, LiteratureRegistry, StructuralPipelineRegistry
from src.pipeline import CalculationPathPlanner, CalculationPipeline, StructuralPipelinePlanner, validate_analysis_job
from src.projects import ProjectCalculationPipeline, ProjectCaseRepository, apply_numeric_overrides, build_project_workspace
from src.reference_cases import ReferenceCaseRepository
from src.report_templates import ReportTemplateRepository
from src.reports.service import build_report_receipt, validate_report_request
from src.reports.renderer import StructuralReportRenderer
from src.reports.dossier import StructuralDossierBuilder
from src.reports.project_renderer import ProjectReportRenderer
from src.standards import default_standards_registry
from src.workspace.service import (
    build_bootstrap_payload,
    load_json_file,
    validate_structural_model,
)


statik_ui_bp = Blueprint("statik", __name__)
statik_api_bp = Blueprint("statik_api", __name__)


def _pipeline() -> CalculationPipeline:
    return CalculationPipeline()


def _report_renderer() -> StructuralReportRenderer:
    prefix = str(current_app.config["ROUTE_PREFIX"]).rstrip("/")
    return StructuralReportRenderer(report_api=f"{prefix}/analysis-jobs/report")


def _reference_case(case_id: str):
    try:
        return ReferenceCaseRepository().get(case_id)
    except KeyError:
        return None


def _project_case(case_id: str):
    try:
        return ProjectCaseRepository().get(case_id)
    except KeyError:
        return None


def _report_templates() -> ReportTemplateRepository:
    return ReportTemplateRepository()


@statik_ui_bp.get("/statik")
def index():
    return render_template(
        "statik/index.html",
        service_name=current_app.config["SERVICE_NAME"],
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
    )


@statik_ui_bp.get("/statik/formelkatalog")
def formula_catalog_page():
    """The primary formula catalog is the Eurocode rule register."""
    if request.args.get("embedded") != "1":
        return redirect(url_for(
            "statik.structural_catalog_page",
            bereich="eurocodes",
            regel=request.args.get("regel"),
        ))
    return render_template(
        "statik/eurocode_catalog.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
        embedded=True,
    )


@statik_ui_bp.get("/statik/methoden")
def implementation_method_catalog_page():
    """Non-normative engineering methods and executable implementation functions."""
    if request.args.get("embedded") != "1":
        return redirect(url_for(
            "statik.structural_catalog_page",
            bereich="methoden",
            formel=request.args.get("methode") or request.args.get("formel"),
        ))
    return render_template(
        "statik/formula_catalog.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
        embedded=True,
    )


@statik_ui_bp.get("/statik/formelkatalog/eurocodes")
def eurocode_catalog_page():
    if request.args.get("embedded") != "1":
        return redirect(url_for("statik.structural_catalog_page", bereich="eurocodes"))
    return render_template(
        "statik/eurocode_catalog.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
        embedded=True,
    )


@statik_ui_bp.get("/statik/rechenwege")
def calculation_path_catalog_page():
    """Human-readable rule graph between formula knowledge and pipeline."""
    if request.args.get("embedded") != "1":
        return redirect(url_for(
            "statik.structural_catalog_page",
            bereich="rechenwege",
            rechenweg=request.args.get("rechenweg"),
        ))
    return render_template(
        "statik/calculation_paths.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
        embedded=True,
    )


@statik_ui_bp.get("/statik/pipelines")
def structural_pipeline_catalog_page():
    """Human-readable workflow graph above the calculation paths."""
    if request.args.get("embedded") != "1":
        return redirect(url_for(
            "statik.structural_catalog_page",
            bereich="pipelines",
            pipeline=request.args.get("pipeline"),
        ))
    return render_template(
        "statik/pipeline_catalog.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
        embedded=True,
    )


@statik_ui_bp.get("/statik/katalog")
def structural_catalog_page():
    """Single entry point for formulas, source register, paths and pipelines."""
    return render_template(
        "statik/structural_catalog.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
    )


@statik_ui_bp.get("/statik/berichtsvorlagen")
@statik_ui_bp.get("/statik/ausgabevorlagen")
def report_template_catalog_page():
    """Pure HTML preview library for versioned structural report templates."""
    return render_template(
        "statik/report_templates.html",
        service_version=current_app.config["SERVICE_VERSION"],
        route_prefix=str(current_app.config["ROUTE_PREFIX"]).rstrip("/"),
    )


@statik_api_bp.get("/status")
def status():
    return jsonify(
        {
            "ok": True,
            "service": current_app.config["SERVICE_NAME"],
            "version": current_app.config["SERVICE_VERSION"],
            "stateful_storage": False,
            "integrations_enabled": False,
            "mode": "standalone_engineering_kernel",
            "contracts": {
                "model": current_app.config["CONTRACT_VERSION"],
                "analysis": current_app.config["ANALYSIS_CONTRACT_VERSION"],
                "analysis_job": current_app.config["ANALYSIS_JOB_CONTRACT_VERSION"],
                "analysis_result": current_app.config["ANALYSIS_RESULT_CONTRACT_VERSION"],
                "exchange": current_app.config["EXCHANGE_CONTRACT_VERSION"],
                "command": current_app.config["COMMAND_CONTRACT_VERSION"],
                "report": current_app.config["REPORT_CONTRACT_VERSION"],
            },
        }
    )


@statik_api_bp.get("/report-templates")
def report_template_catalog():
    return jsonify(_report_templates().catalog())


@statik_api_bp.get("/report-template-test-cases")
def report_template_test_cases():
    return jsonify(_report_templates().test_cases())


@statik_api_bp.get("/report-template-test-cases/<case_id>")
def report_template_test_case(case_id: str):
    try:
        return jsonify(_report_templates().preview_case(case_id))
    except KeyError:
        return jsonify({
            "ok": False,
            "error": "report_template_test_case_not_found",
            "case_id": case_id,
        }), 404


@statik_api_bp.get("/report-templates/schema")
def report_template_schema():
    return jsonify(_report_templates().schema())


@statik_api_bp.get("/report-templates/outline-schema")
def report_template_outline_schema():
    return jsonify(_report_templates().outline_schema())


@statik_api_bp.get("/report-section-templates")
def report_section_template_catalog():
    return jsonify(_report_templates().section_templates())


@statik_api_bp.get("/report-templates/<template_id>/outline")
def report_template_outline(template_id: str):
    try:
        return jsonify(_report_templates().outline(
            template_id,
            variant=request.args.get("variant", "regelfall"),
        ))
    except KeyError:
        return jsonify({"ok": False, "error": "report_template_not_found", "template_id": template_id}), 404
    except ValueError as error:
        return jsonify({"ok": False, "error": "invalid_outline_request", "message": str(error)}), 422


@statik_api_bp.post("/report-templates/<template_id>/outline")
def compose_report_template_outline(template_id: str):
    payload = request.get_json(silent=True) or {}
    facts = payload.get("facts") or {}
    enabled_modules = payload.get("enabled_modules") or []
    disabled_modules = payload.get("disabled_modules") or []
    if not isinstance(facts, dict) or not isinstance(enabled_modules, list) or not isinstance(disabled_modules, list):
        return jsonify({
            "ok": False,
            "error": "invalid_outline_request",
            "message": "facts must be an object; enabled_modules and disabled_modules must be arrays",
        }), 422
    try:
        return jsonify(_report_templates().outline(
            template_id,
            variant=payload.get("variant", "regelfall"),
            facts=facts,
            enabled_modules=enabled_modules,
            disabled_modules=disabled_modules,
        ))
    except KeyError:
        return jsonify({"ok": False, "error": "report_template_not_found", "template_id": template_id}), 404
    except (TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "invalid_outline_request", "message": str(error)}), 422


@statik_api_bp.get("/report-templates/<template_id>")
def report_template_detail(template_id: str):
    try:
        return jsonify(_report_templates().get(template_id))
    except KeyError:
        return jsonify({"ok": False, "error": "report_template_not_found", "template_id": template_id}), 404


@statik_api_bp.get("/bootstrap")
def bootstrap():
    return jsonify(build_bootstrap_payload(current_app.config))


@statik_api_bp.get("/profiles")
def profiles():
    return jsonify(load_json_file(current_app.config["PROFILE_CATALOG_PATH"]))


@statik_api_bp.get("/standards")
def standards_catalog():
    return jsonify(default_standards_registry().catalog())


@statik_api_bp.get("/materials")
def materials_catalog():
    return jsonify(default_material_catalog().to_dict())


@statik_api_bp.get("/reference-cases")
def reference_cases_catalog():
    return jsonify(ReferenceCaseRepository().catalog())


@statik_api_bp.get("/literature")
def literature_catalog():
    return jsonify(LiteratureRegistry().catalog())


@statik_api_bp.get("/formulas")
def formula_catalog():
    registry = EurocodeRegistry()
    catalog = registry.catalog()
    try:
        rules = registry.query_rules(
            query=request.args.get("q", ""),
            family=request.args.get("family", ""),
            document_id=request.args.get("document_id", ""),
            document_kind=request.args.get("document_kind", ""),
            confidence=request.args.get("confidence", ""),
            topic=request.args.get("topic", ""),
            page=int(request.args.get("page", "1")),
            page_size=int(request.args.get("page_size", "100")),
        )
    except ValueError:
        return jsonify({"ok": False, "error": "invalid_pagination"}), 400
    return jsonify({
        **catalog,
        "catalog_role": "primary_normative_formula_catalog",
        "formula_count": (catalog.get("statistics") or {}).get("rules", 0),
        "formula_identity": "formula_id == rule_id",
        "formulas": [registry.as_formula(item) for item in rules["items"]],
        "pagination": rules["pagination"],
    })


@statik_api_bp.get("/formulas/<formula_id>")
def formula_detail(formula_id: str):
    try:
        return jsonify(EurocodeRegistry().get_formula(formula_id))
    except KeyError:
        return jsonify({"ok": False, "error": "formula_not_found", "formula_id": formula_id}), 404


@statik_api_bp.get("/formula-variables")
def formula_variables():
    eurocodes = EurocodeRegistry().catalog()
    return jsonify({
        "schema_version": "eurocode-formula-variable-catalog/0.1",
        "formula_count": (eurocodes.get("statistics") or {}).get("rules", 0),
        "verified_formula_count": 0,
        "variable_count": 0,
        "variables": [],
        "status": "curation_required",
        "policy": {
            "identity": "Eurocode-Variablen werden erst nach fachlicher Regelkuratierung stabil vergeben.",
            "blocking": "Maschinell erkannte Gleichungsstellen ohne Variablen, Einheiten, Grenzen und NA-Overlay sind nicht ausführbar.",
        },
    })


@statik_api_bp.get("/formulas/<formula_id>/variables")
def formula_variables_for_formula(formula_id: str):
    try:
        formula = EurocodeRegistry().get_formula(formula_id)
    except KeyError:
        return jsonify({"ok": False, "error": "formula_not_found", "formula_id": formula_id}), 404
    return jsonify({
        "schema_version": "eurocode-formula-variable-catalog/0.1",
        "formula_id": formula_id,
        "variables": formula.get("variables") or [],
        "status": "curation_required",
    })


@statik_api_bp.get("/implementation-methods")
def implementation_method_catalog():
    return jsonify(FormulaRegistry().catalog())


@statik_api_bp.get("/implementation-methods/<method_id>")
def implementation_method_detail(method_id: str):
    try:
        return jsonify(FormulaRegistry().get(method_id))
    except KeyError:
        return jsonify({"ok": False, "error": "implementation_method_not_found", "method_id": method_id}), 404


@statik_api_bp.get("/implementation-variables")
def implementation_variables():
    return jsonify(FormulaRegistry().variable_catalog())


@statik_api_bp.get("/calculation-paths")
def calculation_path_catalog():
    return jsonify(CalculationPathRegistry().catalog())


@statik_api_bp.get("/calculation-paths/coverage")
def calculation_path_coverage():
    return jsonify(CalculationPathRegistry().coverage(include_eurocodes=True))


@statik_api_bp.get("/calculation-path-variants")
def calculation_path_variants():
    try:
        return jsonify(CalculationPathRegistry().query_variants(
            query=request.args.get("q", ""),
            structure_type=request.args.get("structure_type", ""),
            material=request.args.get("material", ""),
            calculation_scope=request.args.get("calculation_scope", ""),
            page=int(request.args.get("page", "1")),
            page_size=int(request.args.get("page_size", "50")),
        ))
    except ValueError:
        return jsonify({"ok": False, "error": "invalid_pagination"}), 400


@statik_api_bp.get("/calculation-paths/<path_id>")
def calculation_path_detail(path_id: str):
    try:
        return jsonify(CalculationPathRegistry().get(path_id))
    except KeyError:
        return jsonify({"ok": False, "error": "calculation_path_not_found", "path_id": path_id}), 404


@statik_api_bp.post("/calculation-paths/plan")
def calculation_path_plan():
    payload = request.get_json(silent=True) or {}
    planner = CalculationPathPlanner()
    try:
        if isinstance(payload.get("facts"), dict):
            plan = planner.plan_from_facts(payload["facts"], payload.get("runtime_steps") or [])
        else:
            job = payload.get("job") if isinstance(payload.get("job"), dict) else payload
            plan = planner.plan(job, payload.get("runtime_steps") or [])
        return jsonify(plan)
    except (TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "calculation_path_planning_failed", "message": str(error)}), 422


@statik_api_bp.get("/pipelines")
def structural_pipeline_catalog():
    return jsonify(StructuralPipelineRegistry().catalog())


@statik_api_bp.get("/pipelines/coverage")
def structural_pipeline_coverage():
    return jsonify(StructuralPipelineRegistry().coverage())


@statik_api_bp.get("/pipeline-variants")
def structural_pipeline_variants():
    try:
        return jsonify(StructuralPipelineRegistry().query_variants(
            query=request.args.get("q", ""),
            structure_type=request.args.get("structure_type", ""),
            material=request.args.get("material", ""),
            domain=request.args.get("domain", ""),
            page=int(request.args.get("page", "1")),
            page_size=int(request.args.get("page_size", "50")),
        ))
    except ValueError:
        return jsonify({"ok": False, "error": "invalid_pagination"}), 400


@statik_api_bp.get("/pipelines/<pipeline_id>")
def structural_pipeline_detail(pipeline_id: str):
    try:
        return jsonify(StructuralPipelineRegistry().get(pipeline_id))
    except KeyError:
        return jsonify({"ok": False, "error": "structural_pipeline_not_found", "pipeline_id": pipeline_id}), 404


@statik_api_bp.post("/pipelines/plan")
def structural_pipeline_plan():
    payload = request.get_json(silent=True) or {}
    planner = StructuralPipelinePlanner()
    try:
        if isinstance(payload.get("facts"), dict):
            plan = planner.plan_from_facts(
                payload["facts"],
                payload.get("calculation_plan"),
                payload.get("runtime_steps") or [],
            )
        else:
            job = payload.get("job") if isinstance(payload.get("job"), dict) else payload
            plan = planner.plan(
                job,
                payload.get("calculation_plan"),
                payload.get("runtime_steps") or [],
            )
        return jsonify(plan)
    except (TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "structural_pipeline_planning_failed", "message": str(error)}), 422


@statik_api_bp.get("/eurocodes")
def eurocode_catalog():
    return jsonify(EurocodeRegistry().catalog())


@statik_api_bp.get("/eurocodes/rules")
def eurocode_rules():
    try:
        page = int(request.args.get("page", "1"))
        page_size = int(request.args.get("page_size", "50"))
    except ValueError:
        return jsonify({"ok": False, "error": "invalid_pagination"}), 400
    return jsonify(
        EurocodeRegistry().query_rules(
            query=request.args.get("q", ""),
            family=request.args.get("family", ""),
            document_id=request.args.get("document_id", ""),
            document_kind=request.args.get("document_kind", ""),
            confidence=request.args.get("confidence", ""),
            topic=request.args.get("topic", ""),
            page=page,
            page_size=page_size,
        )
    )


@statik_api_bp.get("/eurocodes/calculation-path-candidates")
def eurocode_calculation_path_candidates():
    try:
        return jsonify(EurocodeRegistry().query_workflow_candidates(
            query=request.args.get("q", ""),
            family=request.args.get("family", ""),
            topic=request.args.get("topic", ""),
            page=int(request.args.get("page", "1")),
            page_size=int(request.args.get("page_size", "50")),
        ))
    except ValueError:
        return jsonify({"ok": False, "error": "invalid_pagination"}), 400


@statik_api_bp.get("/eurocodes/rules/<rule_id>")
def eurocode_rule_detail(rule_id: str):
    try:
        return jsonify(EurocodeRegistry().get_rule(rule_id))
    except KeyError:
        return jsonify({"ok": False, "error": "eurocode_rule_not_found", "rule_id": rule_id}), 404


@statik_api_bp.get("/eurocodes/documents/<document_id>")
def eurocode_document_detail(document_id: str):
    try:
        return jsonify(EurocodeRegistry().get_document(document_id))
    except KeyError:
        return jsonify({"ok": False, "error": "eurocode_document_not_found", "document_id": document_id}), 404


@statik_api_bp.get("/project-cases")
def project_cases_catalog():
    return jsonify(ProjectCaseRepository().catalog())


@statik_api_bp.get("/project-cases/<case_id>")
def project_case(case_id: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    return jsonify(payload)


def _compose_project_workspace(case_id: str, payload: dict):
    result = ProjectCalculationPipeline().run(payload)
    template_id = str((payload.get("workspace") or {}).get("template_id") or "")
    if not template_id:
        raise ValueError("project case has no calculation template binding")
    template = _report_templates().get(template_id)
    prefix = str(current_app.config["ROUTE_PREFIX"]).rstrip("/")
    return build_project_workspace(case_id, payload, result, template, api_prefix=prefix)


@statik_api_bp.get("/project-cases/<case_id>/workspace")
def project_case_workspace(case_id: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    try:
        return jsonify(_compose_project_workspace(case_id, payload))
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "project_workspace_failed", "message": str(error)}), 422


@statik_api_bp.post("/project-cases/<case_id>/workspace")
def preview_project_case_workspace(case_id: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    request_payload = request.get_json(silent=True) or {}
    try:
        preview_payload = apply_numeric_overrides(payload, request_payload.get("overrides", []))
        return jsonify(_compose_project_workspace(case_id, preview_payload))
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "invalid_workspace_override", "message": str(error)}), 422


@statik_api_bp.get("/project-cases/<case_id>/run")
def run_project_case(case_id: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    try:
        return jsonify(ProjectCalculationPipeline().run(payload))
    except ValueError as error:
        return jsonify({"ok": False, "error": "project_calculation_failed", "message": str(error)}), 422


@statik_api_bp.post("/project-cases/<case_id>/preview")
def preview_project_case(case_id: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    request_payload = request.get_json(silent=True) or {}
    try:
        preview_payload = apply_numeric_overrides(payload, request_payload.get("overrides", []))
        return jsonify(ProjectCalculationPipeline().run(preview_payload))
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "invalid_preview_override", "message": str(error)}), 422


def _project_report_response(case_id: str, payload: dict, output_format: str):
    result = ProjectCalculationPipeline().run(payload)
    renderer = ProjectReportRenderer()
    template_id = str((payload.get("workspace") or {}).get("template_id") or "")
    calculation_template = _report_templates().get(template_id) if template_id else None
    prefix = str(current_app.config["ROUTE_PREFIX"]).rstrip("/")
    if output_format == "html":
        pdf_url = f"{prefix}/project-cases/{case_id}/report.pdf"
        return Response(renderer.render_html(payload, result, pdf_url=pdf_url, calculation_template=calculation_template), mimetype="text/html")
    pdf = renderer.render_pdf(payload, result, calculation_template=calculation_template)
    return send_file(io.BytesIO(pdf), mimetype="application/pdf", as_attachment=False, download_name=f"{case_id}-projektstatik.pdf")


def _render_project_report(case_id: str, output_format: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    return _project_report_response(case_id, payload, output_format)


@statik_api_bp.get("/project-cases/<case_id>/report.html")
def project_report_html(case_id: str):
    return _render_project_report(case_id, "html")


@statik_api_bp.get("/project-cases/<case_id>/report.pdf")
def project_report_pdf(case_id: str):
    return _render_project_report(case_id, "pdf")


@statik_api_bp.post("/project-cases/<case_id>/report")
def render_project_preview_report(case_id: str):
    payload = _project_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "project_case_not_found"}), 404
    request_payload = request.get_json(silent=True) or {}
    output_format = str(request_payload.get("format") or "html").lower()
    if output_format not in {"html", "pdf"}:
        return jsonify({"ok": False, "error": "unsupported_report_format"}), 400
    try:
        preview_payload = apply_numeric_overrides(payload, request_payload.get("overrides", []))
        return _project_report_response(case_id, preview_payload, output_format)
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "invalid_report_override", "message": str(error)}), 422


@statik_api_bp.get("/reference-cases/<case_id>")
def reference_case(case_id: str):
    payload = _reference_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "reference_case_not_found"}), 404
    return jsonify(payload)


@statik_api_bp.get("/reference-cases/<case_id>/run")
def run_reference_case(case_id: str):
    payload = _reference_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "reference_case_not_found"}), 404
    try:
        return jsonify(_pipeline().run(payload))
    except ValueError as error:
        return jsonify({"ok": False, "error": "calculation_failed", "message": str(error)}), 422


@statik_api_bp.get("/sample-model")
def sample_model():
    payload = load_json_file(current_app.config["SAMPLE_MODEL_PATH"])
    errors = validate_structural_model(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_sample_model", "errors": errors}), 500
    return jsonify(payload)


@statik_api_bp.post("/analysis-preview")
def analysis_preview():
    payload = request.get_json(silent=True)
    errors = validate_analysis_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_analysis_request", "errors": errors}), 400
    return jsonify(calculate_concept(payload))


@statik_api_bp.post("/analysis-jobs")
def run_analysis_job():
    payload = request.get_json(silent=True)
    errors = validate_analysis_job(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_analysis_job", "errors": errors}), 400
    try:
        return jsonify(_pipeline().run(payload))
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "calculation_failed", "message": str(error)}), 422


@statik_api_bp.post("/analysis-jobs/dossier")
def build_analysis_dossier():
    """Run once and return the same calculation dossier consumed by every output."""
    payload = request.get_json(silent=True)
    job = payload.get("job") if isinstance(payload, dict) and "job" in payload else payload
    errors = validate_analysis_job(job)
    if errors:
        return jsonify({"ok": False, "error": "invalid_analysis_job", "errors": errors}), 400
    try:
        result = _pipeline().run(job)
        dossier = StructuralDossierBuilder().build(job, result)
        return jsonify({"ok": True, "result": result, "dossier": dossier})
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"ok": False, "error": "calculation_failed", "message": str(error)}), 422


@statik_api_bp.get("/reference-cases/<case_id>/dossier.json")
def reference_dossier(case_id: str):
    payload = _reference_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "reference_case_not_found"}), 404
    result = _pipeline().run(payload)
    return jsonify(StructuralDossierBuilder().build(payload, result))


def _render_reference_report(case_id: str, output_format: str):
    payload = _reference_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "reference_case_not_found"}), 404
    result = _pipeline().run(payload)
    renderer = _report_renderer()
    if output_format == "html":
        return Response(renderer.render_html(payload, result), mimetype="text/html")
    pdf = renderer.render_pdf(payload, result)
    return send_file(io.BytesIO(pdf), mimetype="application/pdf", as_attachment=False, download_name=f"{case_id}-statikbericht.pdf")


@statik_api_bp.get("/reference-cases/<case_id>/report.html")
def reference_report_html(case_id: str):
    return _render_reference_report(case_id, "html")


@statik_api_bp.get("/reference-cases/<case_id>/report.pdf")
def reference_report_pdf(case_id: str):
    return _render_reference_report(case_id, "pdf")


@statik_api_bp.post("/analysis-jobs/report")
def render_analysis_report():
    payload = request.get_json(silent=True)
    job = payload.get("job") if isinstance(payload, dict) else None
    errors = validate_analysis_job(job)
    if errors:
        return jsonify({"ok": False, "error": "invalid_analysis_job", "errors": errors}), 400
    result = _pipeline().run(job)
    output_format = str(payload.get("format", "html"))
    renderer = _report_renderer()
    if output_format == "html":
        return Response(renderer.render_html(job, result), mimetype="text/html")
    if output_format == "pdf":
        pdf = renderer.render_pdf(job, result)
        return send_file(io.BytesIO(pdf), mimetype="application/pdf", as_attachment=True, download_name=f"{job['job_ref']}-statikbericht.pdf")
    return jsonify({"ok": False, "error": "unsupported_report_format"}), 400


def _export_reference(case_id: str, output_format: str):
    payload = _reference_case(case_id)
    if payload is None:
        return jsonify({"ok": False, "error": "reference_case_not_found"}), 404
    result = _pipeline().run(payload)
    if output_format == "json":
        return jsonify(build_neutral_exchange(payload, result))
    workbook = Saf22Exporter().to_bytes(payload, result)
    return send_file(
        io.BytesIO(workbook),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"{case_id}-SAF-2.2.xlsx",
    )


@statik_api_bp.get("/reference-cases/<case_id>/exchange.json")
def reference_exchange_json(case_id: str):
    return _export_reference(case_id, "json")


@statik_api_bp.get("/reference-cases/<case_id>/exchange.saf")
def reference_exchange_saf(case_id: str):
    return _export_reference(case_id, "saf")


@statik_api_bp.post("/analysis-jobs/exchange")
def export_analysis_job():
    payload = request.get_json(silent=True)
    job = payload.get("job") if isinstance(payload, dict) else None
    errors = validate_analysis_job(job)
    if errors:
        return jsonify({"ok": False, "error": "invalid_analysis_job", "errors": errors}), 400
    result = _pipeline().run(job)
    output_format = str(payload.get("format", "json"))
    if output_format == "json":
        return jsonify(build_neutral_exchange(job, result))
    if output_format == "saf":
        workbook = Saf22Exporter().to_bytes(job, result)
        return send_file(io.BytesIO(workbook), mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name=f"{job['job_ref']}-SAF-2.2.xlsx")
    return jsonify({"ok": False, "error": "unsupported_exchange_format"}), 400


@statik_api_bp.post("/commands")
def create_command_draft():
    payload = request.get_json(silent=True)
    errors = validate_command(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_structural_command", "errors": errors}), 400
    return jsonify(build_command_receipt(payload)), 202


@statik_api_bp.post("/reports")
def create_report_draft():
    payload = request.get_json(silent=True)
    errors = validate_report_request(payload)
    if errors:
        return jsonify({"ok": False, "error": "invalid_report_request", "errors": errors}), 400
    return jsonify(build_report_receipt(payload)), 202


__all__ = ["statik_api_bp", "statik_ui_bp"]
