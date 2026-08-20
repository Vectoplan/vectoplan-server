"""Adaptive HTML and PDF rendering from the universal calculation dossier."""

from __future__ import annotations

import html
import io
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping

from src.reports.dossier import StructuralDossierBuilder


def _fmt(value: Any, digits: int = 3) -> str:
    if value is None:
        return "–"
    if isinstance(value, float):
        return f"{value:.{digits}f}".rstrip("0").rstrip(".")
    return str(value)


def _pdf_fmt(value: Any) -> str:
    text = _fmt(value)
    for symbol, replacement in {
        "Σ": "Sum", "γ": "gamma", "ψ": "psi", "ν": "nu", "π": "pi",
        "φ": "phi", "Φ": "Phi", "Δ": "delta", "σ": "sigma", "α": "alpha",
        "⁶": "^6", "⁴": "^4",
        "ₐ": "a", "ₛ": "s", "ₖ": "k", "ᵢ": "i",
    }.items():
        text = text.replace(symbol, replacement)
    return text


def _editable_fields(job: Mapping[str, Any]) -> list[tuple[str, str, Any]]:
    fields: list[tuple[str, str, Any]] = []
    for key, value in (job.get("analysis_model") or {}).items():
        if isinstance(value, (int, float, str)) and not isinstance(value, bool):
            fields.append((f"analysis_model.{key}", f"Modell · {key}", value))
    for key, value in ((job.get("design") or {}).get("parameters") or {}).items():
        if isinstance(value, (int, float, str)) and not isinstance(value, bool):
            fields.append((f"design.parameters.{key}", f"Bemessung · {key}", value))
    for index, load_case in enumerate(job.get("load_cases") or []):
        value = load_case.get("value")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            fields.append((f"load_cases.{index}.value", f"Last · {load_case.get('label') or index + 1}", value))
    return fields


def _html_rows(items: list[list[Any]]) -> str:
    return "".join("<tr>" + "".join(f"<td>{html.escape(_fmt(cell))}</td>" for cell in row) + "</tr>" for row in items)


class StructuralReportRenderer:
    renderer_id = "vectoplan-universal-structural-report/0.3"

    def __init__(self, report_api: str = "/api/v1/statik/analysis-jobs/report") -> None:
        self.report_api = report_api
        self.dossier_builder = StructuralDossierBuilder()

    def render_html(self, job: Mapping[str, Any], result: Mapping[str, Any]) -> str:
        dossier = self.dossier_builder.build(job, result)
        control = dossier["document_control"]
        project = dossier["project"]
        summary = dossier["summary"]
        editable = "".join(
            f'<label><span>{html.escape(label)}</span><input data-path="{html.escape(path)}" value="{html.escape(_fmt(value))}" data-original="{html.escape(_fmt(value))}"></label>'
            for path, label, value in _editable_fields(job)
        )
        chapter_rows = _html_rows([[item["chapter_id"], item["title"], item["record_count"], item["status"]] for item in dossier["chapters"]])
        load_rows = _html_rows([[item.get("load_case_id"), item.get("label"), item.get("category"), item.get("value"), item.get("unit"), item.get("origin")] for item in dossier["load_path"]["sources"]])
        transfer_rows = _html_rows([[item.get("from"), item.get("to"), item.get("rule"), item.get("value"), item.get("unit"), item.get("status")] for item in dossier["load_path"]["transfers"]])
        combination_rows = _html_rows([[item.get("combination_id"), item.get("label"), item.get("limit_state"), item.get("situation"), item.get("value"), item.get("unit")] for item in dossier["load_combinations"]])
        check_rows = _html_rows([[item.get("label"), item.get("limit_state"), item.get("comparison"), f"{float(item.get('utilization') or 0) * 100:.1f} %", item.get("status"), item.get("explanation")] for item in dossier["checks"]])
        step_rows = _html_rows([[index, item.get("label"), item.get("formula"), item.get("substitutions"), item.get("value"), item.get("unit")] for index, item in enumerate(dossier["calculation_steps"], 1)])
        standard_rows = _html_rows([[item.get("designation"), item.get("edition"), item.get("role"), item.get("national_annex") or "–", item.get("status")] for item in dossier["standards"]])
        decision_rows = _html_rows([[item.get("subject"), item.get("selected"), item.get("reason"), ", ".join(item.get("standard_refs") or [])] for item in dossier["decisions"]])
        topic_rows = _html_rows([[item.get("label"), item.get("status"), item.get("evidence")] for item in dossier["applicability_matrix"]])
        limitation_items = "".join(f"<li>{html.escape(_fmt(item))}</li>" for item in dossier["limitations"])
        embedded = json.dumps({"job": job, "result": result, "dossier": dossier}, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")

        return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statikbericht · {html.escape(str(project['name']))}</title>
<link rel="stylesheet" href="/static/statik/css/report.css"></head>
<body data-report-api="{html.escape(self.report_api)}"><main>
<header class="report-cover"><small>VECTOPLAN · STATIK · BERECHNUNGSAKTE</small><h1>{html.escape(str(project['name']))}</h1><p>{html.escape(str(project['structure_type_label']))} · {html.escape(str(control['position_label']))}</p><div class="cover-grid"><span>Analyse<strong>{html.escape(str(control['analysis_ref']))}</strong></span><span>Revision<strong>{html.escape(str(control['model_revision_ref']))}</strong></span><span>Status<strong>{html.escape(str(summary.get('status')))}</strong></span><span>Prüfung<strong>Fachprüfung erforderlich</strong></span></div></header>
<section><h2>Inhalt und Bearbeitungsstand</h2><table><thead><tr><th>Kap.</th><th>Inhalt</th><th>Datensätze</th><th>Status</th></tr></thead><tbody>{chapter_rows}</tbody></table></section>
<section><h2>Ergebnisdarstellung im Rechenmodell</h2><p>Die Darstellung wird aus demselben Ergebnisdatensatz erzeugt wie die Tabellen und der PDF-Bericht.</p><canvas id="report-result-canvas" width="1100" height="330" aria-label="Berechnungsergebnis"></canvas></section>
<section><h2>Veränderbare Projektvariablen</h2><p>Änderungen werden vor der Ausgabe erneut durch die Analysis-Pipeline gerechnet.</p><div class="inputs">{editable}</div><div class="report-actions"><button type="button" data-action="recalculate">Neu berechnen</button><button type="button" class="primary" data-action="pdf">Als PDF exportieren</button></div><p id="report-status" role="status"></p></section>
<section><h2>Einwirkungen und Lastursprung</h2><table><thead><tr><th>LF</th><th>Bezeichnung</th><th>Kategorie</th><th>Wert</th><th>Einheit</th><th>Quelle</th></tr></thead><tbody>{load_rows}</tbody></table><h3>Lastweiterleitung</h3><table><thead><tr><th>Von</th><th>Nach</th><th>Ansatz</th><th>Wert</th><th>Einheit</th><th>Status</th></tr></thead><tbody>{transfer_rows}</tbody></table></section>
<section><h2>Lastkombinationen</h2><table><thead><tr><th>ID</th><th>Bezeichnung</th><th>GZ</th><th>Situation</th><th>Wert</th><th>Einheit</th></tr></thead><tbody>{combination_rows}</tbody></table></section>
<section><h2>Nachweise</h2><table><thead><tr><th>Nachweis</th><th>GZ</th><th>Vergleich</th><th>Ausnutzung</th><th>Status</th><th>Erläuterung</th></tr></thead><tbody>{check_rows}</tbody></table></section>
<section><h2>Rechenweg</h2><table><thead><tr><th>#</th><th>Schritt</th><th>Formel</th><th>Einsetzungen</th><th>Wert</th><th>Einheit</th></tr></thead><tbody>{step_rows}</tbody></table></section>
<section><h2>Normenbasis</h2><table><thead><tr><th>Regelwerk</th><th>Ausgabe</th><th>Rolle</th><th>Nationaler Anhang</th><th>Status</th></tr></thead><tbody>{standard_rows}</tbody></table></section>
<section><h2>Warum wurde so gerechnet?</h2><table><thead><tr><th>Thema</th><th>Entscheidung</th><th>Begründung</th><th>Referenzen</th></tr></thead><tbody>{decision_rows}</tbody></table></section>
<section><h2>Objektspezifische Prüfmatrix</h2><table><thead><tr><th>Thema</th><th>Status</th><th>Nachweisstand</th></tr></thead><tbody>{topic_rows}</tbody></table></section>
<section><h2>Offene Punkte und Anwendungsgrenzen</h2><ul>{limitation_items}</ul><div class="notice"><strong>Nicht prüffähig ohne Fachprüfung</strong><br>Der Bericht dokumentiert eine reproduzierbare, nicht zertifizierte Berechnung. Normtexte sind nicht eingebettet. Modell, Einwirkungen, nationale Anhänge, Anwendungsgrenzen und Ergebnisse sind vor Freigabe durch eine qualifizierte Fachperson zu prüfen.</div></section>
</main><script id="structural-report-data" type="application/json">{embedded}</script><script src="/static/statik/js/report.js" defer></script></body></html>"""

    def render_pdf(self, job: Mapping[str, Any], result: Mapping[str, Any]) -> bytes:
        try:
            import reportlab
            from reportlab.graphics.shapes import Drawing, Line, PolyLine, Rect, String
            from reportlab.lib import colors
            from reportlab.lib.enums import TA_CENTER, TA_LEFT
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
            from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError as exc:
            raise RuntimeError("PDF rendering requires reportlab") from exc

        dossier = self.dossier_builder.build(job, result)
        stream = io.BytesIO()
        font_root = Path(reportlab.__file__).resolve().parent / "fonts"
        if "Vera" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Vera", str(font_root / "Vera.ttf")))
            pdfmetrics.registerFont(TTFont("VeraBd", str(font_root / "VeraBd.ttf")))
        doc = SimpleDocTemplate(stream, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=19 * mm, bottomMargin=17 * mm, title=f"Statikbericht {job.get('project_ref','')}", author="VECTOPLAN")
        styles = getSampleStyleSheet()
        styles["Title"].fontName = "VeraBd"
        styles["Title"].fontSize = 24
        styles["Title"].leading = 29
        styles.add(ParagraphStyle(name="ReportSub", fontName="Vera", fontSize=11, leading=15, textColor=colors.HexColor("#48616F"), alignment=TA_CENTER))
        styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontName="VeraBd", fontSize=13, leading=16, textColor=colors.HexColor("#173B55"), spaceBefore=10, spaceAfter=6))
        styles.add(ParagraphStyle(name="Subsection", parent=styles["Heading3"], fontName="VeraBd", fontSize=10, leading=13, textColor=colors.HexColor("#173B55"), spaceBefore=7, spaceAfter=4))
        styles.add(ParagraphStyle(name="Small", fontName="Vera", fontSize=7.4, leading=9.5, textColor=colors.HexColor("#405966")))
        styles.add(ParagraphStyle(name="SmallHeader", fontName="VeraBd", fontSize=7.2, leading=9, textColor=colors.white))
        styles.add(ParagraphStyle(name="BodyCompact", fontName="Vera", fontSize=9, leading=12, alignment=TA_LEFT))
        styles.add(ParagraphStyle(name="Center", fontName="Vera", fontSize=9, leading=12, alignment=TA_CENTER))

        story: list[Any] = []
        control = dossier["document_control"]
        project = dossier["project"]
        summary = dossier["summary"]
        story.extend([
            Spacer(1, 22 * mm),
            Paragraph("VECTOPLAN · STATIK · BERECHNUNGSAKTE", styles["Center"]),
            Spacer(1, 8 * mm),
            Paragraph(html.escape(str(project["name"])), styles["Title"]),
            Paragraph(html.escape(str(project["structure_type_label"])), styles["ReportSub"]),
            Spacer(1, 12 * mm),
        ])
        cover = Table([
            ["Position", control.get("position_label")], ["Analyse", control.get("analysis_ref")],
            ["Modellrevision", control.get("model_revision_ref")], ["Normprofil", result.get("standards_profile", {}).get("label")],
            ["Ergebnisstatus", summary.get("status")], ["Freigabestatus", "Unabhängige Fachprüfung erforderlich"],
        ], colWidths=[42 * mm, 120 * mm])
        cover.setStyle(self._table_style(colors, header=False, font_size=8.5))
        story.extend([cover, Spacer(1, 13 * mm), Paragraph("Berechnungsstand", styles["Section"]), Paragraph("Reproduzierbare, nicht zertifizierte Berechnung. Der Bericht ist als prüfbare Rechenakte vorbereitet, ersetzt aber keine fachliche Prüfung oder bauaufsichtliche Freigabe.", styles["BodyCompact"]), Spacer(1, 28 * mm), Paragraph(f"Erzeugt {datetime.now(UTC).strftime('%d.%m.%Y · %H:%M UTC')}", styles["Center"]), PageBreak()])

        def section(title: str, headers: list[str], rows: list[list[Any]], widths: list[float] | None = None, empty: str = "Keine Datensätze") -> None:
            story.append(Paragraph(title, styles["Section"]))
            if not rows:
                story.append(Paragraph(empty, styles["Small"]))
                return
            body = [[Paragraph(html.escape(_pdf_fmt(cell)), styles["SmallHeader"]) for cell in headers]]
            body.extend([[Paragraph(html.escape(_pdf_fmt(cell)), styles["Small"]) for cell in row] for row in rows])
            table = LongTable(body, colWidths=widths, repeatRows=1, splitByRow=True)
            table.setStyle(self._table_style(colors, header=True, font_size=7.4))
            story.append(table)

        section("Inhalts- und Prüfverzeichnis", ["Kap.", "Inhalt", "Datensätze", "Status"], [[item["chapter_id"], item["title"], item["record_count"], item["status"]] for item in dossier["chapters"]], [13*mm, 112*mm, 23*mm, 28*mm])
        story.append(Spacer(1, 4 * mm))
        chart = self._pdf_result_chart(result, Drawing, Line, PolyLine, Rect, String, colors)
        if chart:
            story.extend([Paragraph("Ergebnisdarstellung", styles["Section"]), chart])

        section("1 · System- und Bemessungseingaben", ["Bereich", "Parameter", "Wert"], [[item["group"], item["path"], item["value"]] for item in dossier["inputs"]], [42*mm, 92*mm, 42*mm])
        section("2 · Einwirkungen und Lastursprung", ["LF", "Bezeichnung", "Kategorie", "Wert", "Einheit", "Quelle"], [[item.get("load_case_id"), item.get("label"), item.get("category"), item.get("value"), item.get("unit"), item.get("origin")] for item in dossier["load_path"]["sources"]], [14*mm, 49*mm, 26*mm, 21*mm, 20*mm, 46*mm])
        section("3 · Lastweiterleitung und Auflagerreaktionen", ["Von", "Nach", "Ansatz", "Einsetzung", "Wert", "Einheit", "Status"], [[item.get("from"), item.get("to"), item.get("rule"), item.get("substitutions"), item.get("value"), item.get("unit"), item.get("status")] for item in dossier["load_path"]["transfers"]], [20*mm, 30*mm, 28*mm, 44*mm, 18*mm, 14*mm, 22*mm])
        story.append(PageBreak())
        section("4 · Lastkombinationen", ["ID", "Bezeichnung", "GZ", "Situation", "Leitend", "Wert", "Einheit"], [[item.get("combination_id"), item.get("label"), item.get("limit_state"), item.get("situation"), item.get("leading_action") or "–", item.get("value"), item.get("unit")] for item in dossier["load_combinations"]], [24*mm, 46*mm, 13*mm, 30*mm, 20*mm, 23*mm, 20*mm])
        section("5 · Analysefälle und Ergebnisumhüllende", ["Kombination", "GZ", "Solver", "Theorie", "Umhüllende"], [[item.get("combination_id"), item.get("limit_state"), item.get("solver"), item.get("theory"), json.dumps(item.get("envelope"), ensure_ascii=False)] for item in dossier["analysis_cases"]], [27*mm, 14*mm, 43*mm, 50*mm, 42*mm])
        section("6 · Nachweise", ["Nachweis", "GZ", "Einwirkung ≤ Widerstand", "Ausnutzung", "Status", "Erläuterung"], [[item.get("label"), item.get("limit_state"), item.get("comparison"), f"{float(item.get('utilization') or 0)*100:.1f} %", item.get("status"), item.get("explanation")] for item in dossier["checks"]], [37*mm, 12*mm, 43*mm, 22*mm, 24*mm, 38*mm])
        story.append(PageBreak())
        section("7 · Rechenweg", ["#", "Schritt", "Formel", "Einsetzungen", "Ergebnis"], [[index, item.get("label"), item.get("formula"), item.get("substitutions"), f"{_fmt(item.get('value'))} {item.get('unit','')}"] for index, item in enumerate(dossier["calculation_steps"], 1)], [9*mm, 35*mm, 43*mm, 57*mm, 32*mm])
        section("8 · Normenbasis", ["Regelwerk", "Ausgabe", "Rolle", "Nationaler Anhang", "Status"], [[item.get("designation"), item.get("edition"), item.get("role"), item.get("national_annex") or "–", item.get("status")] for item in dossier["standards"]], [31*mm, 29*mm, 42*mm, 46*mm, 28*mm])
        section("9 · Warum wurde so gerechnet?", ["Thema", "Entscheidung", "Begründung", "Referenzen"], [[item.get("subject"), item.get("selected"), item.get("reason"), ", ".join(item.get("standard_refs") or [])] for item in dossier["decisions"]], [34*mm, 42*mm, 75*mm, 25*mm])
        section("10 · Objektspezifische Prüfmatrix", ["Thema", "Status", "Nachweisstand"], [[item.get("label"), item.get("status"), item.get("evidence")] for item in dossier["applicability_matrix"]], [66*mm, 29*mm, 81*mm])
        section("11 · Offene Punkte und Anwendungsgrenzen", ["Nr.", "Hinweis"], [[index, item] for index, item in enumerate(dossier["limitations"], 1)], [13*mm, 163*mm])
        story.extend([Spacer(1, 7*mm), Paragraph("Freigabe", styles["Section"]), Paragraph("Aufgestellt: ____________________    Geprüft: ____________________    Datum: ____________________", styles["BodyCompact"])])

        def page(canvas: Any, document: Any) -> None:
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor("#C7D3D9"))
            canvas.line(16 * mm, 13 * mm, 194 * mm, 13 * mm)
            canvas.setFont("Vera", 7)
            canvas.setFillColor(colors.HexColor("#607480"))
            canvas.drawString(16 * mm, 8.5 * mm, f"VECTOPLAN Statik · {control.get('analysis_ref')}")
            canvas.drawRightString(194 * mm, 8.5 * mm, f"Seite {document.page}")
            canvas.restoreState()

        doc.build(story, onFirstPage=page, onLaterPages=page)
        return stream.getvalue()

    @staticmethod
    def _table_style(colors: Any, *, header: bool, font_size: float) -> Any:
        from reportlab.platypus import TableStyle
        commands = [
            ("FONTNAME", (0, 0), (-1, -1), "Vera"), ("FONTSIZE", (0, 0), (-1, -1), font_size),
            ("LEADING", (0, 0), (-1, -1), font_size + 2), ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#C7D3D9")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, colors.HexColor("#F3F7F8")]),
        ]
        if header:
            commands.extend([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#173B55")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "VeraBd")])
        else:
            commands.extend([("FONTNAME", (0, 0), (0, -1), "VeraBd"), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E9F1F3"))])
        return TableStyle(commands)

    @staticmethod
    def _pdf_result_chart(result: Mapping[str, Any], Drawing: Any, Line: Any, PolyLine: Any, Rect: Any, String: Any, colors: Any) -> Any | None:
        analyses = ((result.get("analysis") or {}).get("analyses") or [])
        if not analyses:
            return None
        selected = analyses[0].get("result") or {}
        drawing = Drawing(500, 165)
        drawing.add(Rect(0, 0, 500, 165, fillColor=colors.HexColor("#F7FAFB"), strokeColor=colors.HexColor("#CBD6DC")))
        drawing.add(String(12, 146, "Ergebnisdarstellung · identischer Rechenkern", fontName="VeraBd", fontSize=9, fillColor=colors.HexColor("#173B55")))
        if selected.get("analysis_type") == "linear_static_beam_line":
            samples = [point for span in selected.get("spans", []) for point in span.get("samples", [])]
            if not samples:
                return drawing
            max_x = max(float(item["x_global_m"]) for item in samples) or 1.0
            max_m = max(abs(float(item["moment_knm"])) for item in samples) or 1.0
            points = [(20 + 460 * float(item["x_global_m"]) / max_x, 78 + 55 * float(item["moment_knm"]) / max_m) for item in samples]
            drawing.add(Line(20, 78, 480, 78, strokeColor=colors.HexColor("#718591")))
            drawing.add(PolyLine(points, strokeColor=colors.HexColor("#0C9AA0"), strokeWidth=2))
            drawing.add(String(20, 18, f"Momentenlinie · |M|max = {max_m:.2f} kNm", fontName="Vera", fontSize=8, fillColor=colors.HexColor("#405966")))
            return drawing
        grid = (selected.get("grid") or {}).get("rows") or []
        if grid:
            values = [abs(float(cell["w_mm"])) for row in grid for cell in row if cell.get("w_mm") is not None and cell.get("active", True)]
            maximum = max(values) or 1.0
            ny, nx = len(grid), len(grid[0])
            cell_w, cell_h = 460 / nx, 105 / ny
            palette = [colors.HexColor("#173BFF"), colors.HexColor("#06B6D4"), colors.HexColor("#20C875"), colors.HexColor("#F5D547"), colors.HexColor("#EF553B")]
            for iy, row in enumerate(grid):
                for ix, cell in enumerate(row):
                    if cell.get("w_mm") is None or not cell.get("active", True):
                        color = colors.white
                    else:
                        ratio = abs(float(cell["w_mm"])) / maximum
                        color = palette[min(len(palette) - 1, int(ratio * len(palette)))]
                    drawing.add(Rect(20 + ix * cell_w, 28 + iy * cell_h, cell_w + .2, cell_h + .2, fillColor=color, strokeColor=None))
            drawing.add(String(20, 16, f"Verformungsfeld · |w|max = {maximum:.3f} mm", fontName="Vera", fontSize=8, fillColor=colors.HexColor("#405966")))
            return drawing
        if selected.get("analysis_type") == "linear_static_truss_2d":
            nodes = selected.get("nodes") or []
            members = selected.get("members") or []
            if not nodes:
                return drawing
            node_map = {str(item["node_id"]): item for item in nodes}
            min_x = min(float(item["x_m"]) for item in nodes); max_x = max(float(item["x_m"]) for item in nodes)
            min_y = min(float(item["y_m"]) for item in nodes); max_y = max(float(item["y_m"]) for item in nodes)
            def point(item: Mapping[str, Any]) -> tuple[float, float]:
                return (30 + (float(item["x_m"]) - min_x) / max(max_x-min_x, 1e-9) * 440, 35 + (float(item["y_m"]) - min_y) / max(max_y-min_y, 1e-9) * 90)
            for member in members:
                start = point(node_map[str(member["start_node"])]); end = point(node_map[str(member["end_node"])])
                color = colors.HexColor("#EF553B") if float(member["axial_force_kn"]) < 0 else colors.HexColor("#0C9AA0")
                drawing.add(Line(start[0], start[1], end[0], end[1], strokeColor=color, strokeWidth=2.5))
            for node in nodes:
                x, y = point(node); drawing.add(Rect(x-2, y-2, 4, 4, fillColor=colors.HexColor("#173B55"), strokeColor=None))
            drawing.add(String(20, 16, "Stabkräfte · Zug türkis · Druck rot", fontName="Vera", fontSize=8, fillColor=colors.HexColor("#405966")))
        return drawing


__all__ = ["StructuralReportRenderer"]
