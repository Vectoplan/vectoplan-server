"""Project-level HTML and PDF calculation books for multi-position projects."""

from __future__ import annotations

import html
import io
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping

from src.reports.renderer import StructuralReportRenderer, _fmt, _pdf_fmt


def _rows(items: list[list[Any]]) -> str:
    return "".join("<tr>" + "".join(f"<td>{html.escape(_fmt(cell))}</td>" for cell in row) + "</tr>" for row in items)


class ProjectReportRenderer:
    renderer_id = "vectoplan-project-structural-report/0.2"

    @staticmethod
    def _step_cards(steps: list[Mapping[str, Any]]) -> str:
        if not steps:
            return '<p class="empty">Für diese Position wurde kein Rechenschritt geliefert.</p>'
        return "".join(f"""
<article class="calculation-step">
  <span class="step-number">{index:02}</span>
  <div><h4>{html.escape(str(item.get('label') or item.get('step_id')))}</h4>
  <code>{html.escape(str(item.get('formula') or '–'))}</code>
  <p><b>Einsetzen:</b> {html.escape(str(item.get('substitutions') or '–'))}</p>
  <p class="step-result"><b>Ergebnis:</b> {html.escape(_fmt(item.get('value')))} {html.escape(str(item.get('unit') or ''))}</p>
  <small>Bezug: {html.escape(', '.join(item.get('standard_refs') or []) or 'Grundlagenstatik')} · Annahmen: {html.escape(', '.join(item.get('assumptions') or []) or 'siehe Eingaben')}</small></div>
</article>""" for index, item in enumerate(steps, 1))

    def render_html(
        self,
        project: Mapping[str, Any],
        result: Mapping[str, Any],
        *,
        pdf_url: str,
        calculation_template: Mapping[str, Any] | None = None,
    ) -> str:
        meta = result["project_metadata"]
        summary = result["summary"]
        preview_url = pdf_url.removesuffix("/report.pdf") + "/preview"
        variables = list(result.get("editable_variables") or [])

        def input_fields(scope: str, scope_ref: str) -> str:
            records = [item for item in variables if item.get("scope") == scope and str(item.get("scope_ref")) == scope_ref]
            return "".join(
                f'<label class="variable-field"><span>{html.escape(str(item["label"]))}</span>'
                f'<span class="variable-control"><input type="number" step="any" value="{html.escape(str(item["value"]))}" '
                f'data-edit-input data-path="{html.escape(str(item["path"]))}" data-initial="{html.escape(str(item["value"]))}">'
                f'<small>{html.escape(str(item.get("unit") or "–"))}</small></span></label>'
                for item in records
            )

        position_rows = _rows([[
            item["position_ref"], item["label"], item["group"], item.get("level") or "–",
            item["result"]["analysis"]["kind"], item["result"]["summary"]["check_count"], item["result"]["summary"]["status"],
        ] for item in result["positions"]])
        link_rows = _rows([[item.get("from"), item.get("to"), item.get("kind"), item.get("rule")] for item in result["load_links"]])
        capability_rows = _rows([[
            item["label"], ", ".join(item.get("positions") or []) or "nicht erforderlich", item["status"], item["implementation"], item["evidence"],
        ] for item in result["capability_matrix"]])

        raw_actions = {str(item.get("action_id")): item for item in project.get("environmental_actions") or []}
        environmental_sections = []
        for action in result.get("environmental_actions") or []:
            action_id = str(action["action_id"])
            raw = raw_actions.get(action_id, {})
            outputs = []
            for key, label, unit in (
                ("roof_snow_load_kn_m2", "Dachschneelast s", "kN/m²"),
                ("nodal_load_kn", "Abgeleitete Knotenlast", "kN"),
                ("basic_velocity_pressure_kn_m2", "Basisdruck qᵦ", "kN/m²"),
                ("peak_velocity_pressure_kn_m2", "Böendruck qₚ", "kN/m²"),
                ("net_pressure_kn_m2", "Resultierender Druck w", "kN/m²"),
                ("resultant_kn", "Windresultierende", "kN"),
            ):
                if action.get(key) is not None:
                    outputs.append(f'<span><small>{label}</small><strong data-env-value="{key}">{_fmt(action[key])} {unit}</strong></span>')
            environmental_sections.append(f"""
<section class="environment-card" id="environment-{html.escape(action_id)}" data-environment-result="{html.escape(action_id)}">
  <div class="position-heading"><div><small>{html.escape(action_id)} · {html.escape(str(action.get('position_ref') or 'projektweit'))}</small><h2>{html.escape(str(action['title']))}</h2></div><strong>{'SCHNEE' if action['kind'] == 'snow' else 'WIND'}</strong></div>
  <p class="source-note">{html.escape(str(raw.get('source_note') or 'Explizite Projekteingabe'))}</p>
  <div class="variable-grid">{input_fields('environment', action_id)}</div>
  <div class="result-strip">{''.join(outputs)}</div>
  <div class="calculation-sheet" data-environment-steps="{html.escape(action_id)}">{self._step_cards(action.get('calculation_steps') or [])}</div>
</section>""")

        position_sections = []
        for position in result["positions"]:
            position_result = position["result"]
            checks = list((position_result.get("design") or {}).get("checks") or [])
            check_rows = _rows([[
                item.get("label"), item.get("limit_state"), item.get("design_value"), item.get("resistance_value"),
                item.get("unit"), f"{float(item.get('utilization') or 0) * 100:.1f} %", item.get("status"),
            ] for item in checks])
            load_rows = _rows([[
                item.get("load_case_id"), item.get("label"), item.get("category"), item.get("value"), item.get("unit"), item.get("action_type"),
            ] for item in position["job"].get("load_cases") or []])
            position_sections.append(f"""
<section class="project-position" id="position-{html.escape(position['position_ref'])}">
  <div class="position-heading"><div><small>{html.escape(position['position_ref'])} · {html.escape(position['group'])} · {html.escape(str(position.get('level') or '–'))}</small><h2>{html.escape(position['label'])}</h2></div><strong data-position-status="{html.escape(position['position_ref'])}" data-status="{html.escape(position_result['summary']['status'])}">{html.escape(position_result['summary']['status'])}</strong></div>
  <canvas class="project-result-canvas" width="1180" height="360" data-position="{html.escape(position['position_ref'])}" aria-label="Ergebnis {html.escape(position['label'])}"></canvas>
  <h3>Veränderbare Rechenwerte</h3><p class="section-help">Die Eingaben werden nur in dieser Vorschau verändert. Das gespeicherte Testmodell bleibt unverändert.</p><div class="variable-grid position-variables">{input_fields('position', str(position['position_ref']))}</div>
  <h3>Einwirkungen</h3><table><thead><tr><th>LF</th><th>Bezeichnung</th><th>Kategorie</th><th>Wert</th><th>Einheit</th><th>Typ</th></tr></thead><tbody>{load_rows}</tbody></table>
  <h3>Nachweise</h3><table><thead><tr><th>Nachweis</th><th>GZ</th><th>Einwirkung</th><th>Widerstand</th><th>Einheit</th><th>Ausnutzung</th><th>Status</th></tr></thead><tbody data-checks-for="{html.escape(position['position_ref'])}">{check_rows}</tbody></table>
  <h3>Rechenweg · Formel → Einsetzung → Ergebnis</h3><div class="calculation-sheet" data-steps-for="{html.escape(position['position_ref'])}">{self._step_cards(position_result.get('calculation_steps') or [])}</div>
</section>""")

        formula_rows = "".join(f"""
<tr data-formula-row data-search="{html.escape(' '.join([str(item.get('formula_id')), str(item.get('chapter')), str(item.get('title')), str(item.get('equation'))]).lower())}">
 <td><strong>{html.escape(str(item['formula_id']))}</strong><br><small>{html.escape(str(item['chapter']))}</small></td>
 <td><strong>{html.escape(str(item['title']))}</strong><br><span>{html.escape(str(item['description']))}</span></td>
 <td><code>{html.escape(str(item['equation']))}</code></td>
 <td>{html.escape(str((item.get('source') or {}).get('book_pages') or '–'))}<br><small>{html.escape(str((item.get('source') or {}).get('section') or ''))}</small></td>
 <td><span class="formula-status" data-formula-status="{html.escape(str(item['status']))}">{html.escape(str(item['status']))}</span><br><small>{html.escape(str(item.get('backend') or ''))}</small></td>
</tr>""" for item in result.get("formula_catalog") or [])
        template = calculation_template or {}
        template_pipelines = list((template.get("pipeline_binding") or {}).get("pipeline_ids") or [])
        template_strip = f'<section class="template-binding"><h2>Berechnungstemplate</h2><div class="regulation"><span>Vorlage<strong>{html.escape(str(template.get("title") or "Projekt-Rechenakte"))}</strong></span><span>ID<strong>{html.escape(str(template.get("template_id") or "lokal"))}</strong></span><span>Pipelines<strong>{len(template_pipelines)}</strong></span><span>Grafiken<strong>{len(template.get("visualization_plan") or [])}</strong></span></div><p>Die Gliederung und Visualisierungen sind an die aktiven Pipelines gebunden. Offene Gates bleiben auch in der Ausgabe offen.</p></section>'
        embedded = json.dumps({"project": project, "result": result, "preview_url": preview_url, "calculation_template": template}, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
        warnings = "".join(f"<li>{html.escape(item)}</li>" for item in result.get("warnings") or []) or "<li>Keine ungeklärten Punkte im angeforderten Rechenumfang.</li>"
        regulation = result.get("regulatory_context") or {}
        nav_positions = "".join(f'<a href="#position-{html.escape(item["position_ref"])}">{html.escape(item["position_ref"])} · {html.escape(item["label"])}</a>' for item in result["positions"])
        coverage = result.get("formula_coverage") or {}
        return f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Projektstatik · {html.escape(str(meta.get('name')))}</title><link rel="stylesheet" href="/static/statik/css/project-report.css"></head>
<body><div class="report-app"><aside class="report-nav"><strong>Rechenakte</strong><a href="#overview">Projektübersicht</a><a href="#environment">Wind &amp; Schnee</a>{nav_positions}<a href="#formulas">Rechenmethoden</a><a href="#approval">Offene Punkte</a></aside><main>
<header class="project-cover" id="overview"><small>VECTOPLAN · STATIK · EDITIERBARE PROJEKTRECHENAKTE</small><h1>{html.escape(str(meta.get('name')))}</h1><p>{html.escape(str(meta.get('description')))}</p><div class="project-metrics"><span>Positionen<strong data-summary="position_count">{summary['position_count']}</strong></span><span>Nachweise<strong data-summary="check_count">{summary['check_count']}</strong></span><span>Status<strong data-summary="status">{summary['status']}</strong></span><span>Rechenmethoden<strong>{coverage.get('catalogued_formula_count', 0)}</strong></span></div><div class="cover-actions"><button type="button" id="recalculate-project">Änderungen neu berechnen</button><button type="button" id="reset-project" class="secondary">Eingaben zurücksetzen</button><a class="pdf-action" href="{html.escape(pdf_url)}">Gesamtbericht als PDF öffnen</a></div><p class="preview-state" id="preview-state">Original-Testfall · keine ungespeicherten Änderungen</p></header>
{template_strip}
<section><h2>Bauwerks- und Lastpfadübersicht</h2><canvas id="project-system-canvas" width="1180" height="440" aria-label="Bauwerkslastpfad"></canvas><table><thead><tr><th>Von</th><th>Nach</th><th>Übergabe</th><th>Regel</th></tr></thead><tbody>{link_rows}</tbody></table></section>
<section><h2>Positions- und Prüfverzeichnis</h2><table><thead><tr><th>Pos.</th><th>Bezeichnung</th><th>Gruppe</th><th>Ebene</th><th>Modell</th><th>Nachweise</th><th>Status</th></tr></thead><tbody>{position_rows}</tbody></table></section>
<section><h2>Norm- und Rechtsstand</h2><div class="regulation"><span>Land<strong>{html.escape(str(regulation.get('country')))}</strong></span><span>Bundesland<strong>{html.escape(str(regulation.get('federal_state')))}</strong></span><span>Technische Baubestimmungen<strong>{html.escape(str(regulation.get('technical_building_rules')))}</strong></span><span>Stand<strong>{html.escape(str(regulation.get('as_of')))}</strong></span></div><p>{html.escape(str(regulation.get('decision_note')))}</p></section>
<section><h2>Fähigkeitsmatrix</h2><table><thead><tr><th>Fähigkeit</th><th>Positionen</th><th>Status</th><th>Rechenkern</th><th>Beleg</th></tr></thead><tbody>{capability_rows}</tbody></table></section>
<div id="environment"><div class="chapter-heading"><small>Lastannahmen</small><h1>Wind- und Schneelasten</h1><p>Alle maßgebenden Parameter bleiben sichtbar und können für eine Variantenrechnung geändert werden.</p></div>{''.join(environmental_sections)}</div>
{''.join(position_sections)}
<section id="formulas"><div class="position-heading"><div><small>Literatur → Rechenmethode → Test · nichtnormative Umsetzung</small><h2>Rechenmethoden &amp; Implementierungen</h2></div><strong>{coverage.get('catalogued_formula_count', 0)} METHODEN</strong></div><p>{html.escape(str(coverage.get('statement') or ''))}</p><label class="formula-search">Methode suchen<input id="formula-search" type="search" placeholder="z. B. Schnee, Biegung, Fundament"></label><div class="table-scroll"><table class="formula-table"><thead><tr><th>ID / Kapitel</th><th>Bedeutung</th><th>Ansatz</th><th>Literaturstelle</th><th>Umsetzung</th></tr></thead><tbody>{formula_rows}</tbody></table></div></section>
<section id="approval"><h2>Offene Punkte und Freigabe</h2><ul>{warnings}</ul><div class="notice"><strong>Fachprüfung erforderlich</strong><br>Diese Vorschau ist ein nachvollziehbarer, reproduzierbarer Rechenkern – kein prüffähiger oder bauaufsichtlich freigegebener Nachweis. Eingaben, Modell, Nationaler Anhang und Ergebnisse sind projektbezogen durch Tragwerksplanung und Prüfingenieur zu bestätigen.</div></section>
</main></div><script id="project-report-data" type="application/json">{embedded}</script><script src="/static/statik/js/project-report.js" defer></script></body></html>"""

    def render_pdf(
        self,
        project: Mapping[str, Any],
        result: Mapping[str, Any],
        calculation_template: Mapping[str, Any] | None = None,
    ) -> bytes:
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
            from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table
        except ImportError as exc:
            raise RuntimeError("PDF rendering requires reportlab") from exc

        stream = io.BytesIO()
        font_root = Path(reportlab.__file__).resolve().parent / "fonts"
        if "Vera" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Vera", str(font_root / "Vera.ttf")))
            pdfmetrics.registerFont(TTFont("VeraBd", str(font_root / "VeraBd.ttf")))
        meta, summary = result["project_metadata"], result["summary"]
        doc = SimpleDocTemplate(stream, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=18*mm, bottomMargin=17*mm, title=f"Projektstatik {meta.get('name')}", author="VECTOPLAN")
        styles = getSampleStyleSheet()
        styles["Title"].fontName = "VeraBd"; styles["Title"].fontSize = 23; styles["Title"].leading = 28
        styles.add(ParagraphStyle(name="PSub", fontName="Vera", fontSize=10, leading=14, textColor=colors.HexColor("#48616F"), alignment=TA_CENTER))
        styles.add(ParagraphStyle(name="PSection", fontName="VeraBd", fontSize=14, leading=17, textColor=colors.HexColor("#173B55"), spaceBefore=8, spaceAfter=6))
        styles.add(ParagraphStyle(name="PSubsection", fontName="VeraBd", fontSize=10, leading=13, textColor=colors.HexColor("#173B55"), spaceBefore=7, spaceAfter=4))
        styles.add(ParagraphStyle(name="PSmall", fontName="Vera", fontSize=7.1, leading=9.1, textColor=colors.HexColor("#405966")))
        styles.add(ParagraphStyle(name="PHeader", fontName="VeraBd", fontSize=6.9, leading=8.6, textColor=colors.white))
        styles.add(ParagraphStyle(name="PBody", fontName="Vera", fontSize=9, leading=12, alignment=TA_LEFT))
        styles.add(ParagraphStyle(name="PCenter", fontName="Vera", fontSize=9, leading=12, alignment=TA_CENTER))
        story: list[Any] = [Spacer(1, 18*mm), Paragraph("VECTOPLAN · STATIK · PROJEKTRECHENAKTE", styles["PCenter"]), Spacer(1, 7*mm), Paragraph(html.escape(str(meta.get("name"))), styles["Title"]), Paragraph(html.escape(str(meta.get("description"))), styles["PSub"]), Spacer(1, 12*mm)]
        template = calculation_template or {}
        cover_rows = [["Projektanalyse", result["project_analysis_ref"]], ["Modellrevision", result["model_revision_ref"]], ["Berechnungstemplate", f"{template.get('template_id', 'lokal')} · {template.get('title', 'Projekt-Rechenakte')}"], ["Template-Pipelines", len((template.get("pipeline_binding") or {}).get("pipeline_ids") or [])], ["Positionen / Nachweise", f"{summary['position_count']} / {summary['check_count']}"], ["Ergebnisstatus", summary["status"]], ["Technische Baubestimmungen", result.get("regulatory_context", {}).get("technical_building_rules")], ["Freigabestatus", "Unabhängige Fachprüfung erforderlich"]]
        cover = Table(cover_rows, colWidths=[46*mm, 116*mm]); cover.setStyle(self._table_style(colors, header=False)); story.extend([cover, Spacer(1, 16*mm), Paragraph("Dokumentzweck", styles["PSection"]), Paragraph("Durchgängige Test- und Rechenakte eines komplexen Wohngebäudes. Aufbau nach den untersuchten Musterstatiken: Grundlagen, Lastannahmen, System, Kombinationen, Schnittgrößen, Nachweise und gewählte Konstruktion.", styles["PBody"]), Spacer(1, 20*mm), Paragraph(f"Erzeugt {datetime.now(UTC).strftime('%d.%m.%Y · %H:%M UTC')}", styles["PCenter"]), PageBreak()])

        def table_section(title: str, headers: list[str], rows: list[list[Any]], widths: list[float]) -> None:
            story.append(Paragraph(title, styles["PSection"]))
            if not rows:
                story.append(Paragraph("Keine Datensätze", styles["PSmall"])); return
            body = [[Paragraph(html.escape(_pdf_fmt(cell)), styles["PHeader"]) for cell in headers]]
            body.extend([[Paragraph(html.escape(_pdf_fmt(cell)), styles["PSmall"]) for cell in row] for row in rows])
            table = LongTable(body, colWidths=widths, repeatRows=1, splitByRow=True); table.setStyle(self._table_style(colors, header=True)); story.append(table)

        story.extend([Paragraph("1 · Vorbemerkungen und Grundlagen", styles["PSection"]), Paragraph(html.escape(str((result.get("regulatory_context") or {}).get("decision_note") or "–")), styles["PBody"])])
        table_section("1.1 · Positionsverzeichnis", ["Pos.", "Bezeichnung", "Gruppe", "Ebene", "Rechenkern", "Checks", "Status"], [[item["position_ref"], item["label"], item["group"], item.get("level") or "–", item["result"]["analysis"]["kind"], item["result"]["summary"]["check_count"], item["result"]["summary"]["status"]] for item in result["positions"]], [14*mm, 47*mm, 26*mm, 14*mm, 32*mm, 16*mm, 31*mm])
        table_section("1.2 · Lastpfad", ["Von", "Nach", "Übergabe", "Regel"], [[item.get("from"), item.get("to"), item.get("kind"), item.get("rule")] for item in result["load_links"]], [18*mm, 18*mm, 48*mm, 96*mm])

        story.append(PageBreak())
        story.append(Paragraph("2 · Lastannahmen · Wind und Schnee", styles["PSection"]))
        story.append(Paragraph("Die klimatischen Grundwerte und Beiwerte sind explizite Testeingaben. Das System wählt weder Windzone noch Schneezone automatisch.", styles["PBody"]))
        for action_index, action in enumerate(result.get("environmental_actions") or [], 1):
            story.append(Paragraph(f"2.{action_index} · {html.escape(str(action['title']))}", styles["PSubsection"]))
            table_section("Rechenweg", ["Schritt", "Formel", "Einsetzung", "Ergebnis", "Bezug"], [[step.get("label"), step.get("formula"), step.get("substitutions"), f"{_fmt(step.get('value'))} {step.get('unit','')}", ", ".join(step.get("standard_refs") or [])] for step in action.get("calculation_steps") or []], [34*mm, 35*mm, 48*mm, 28*mm, 35*mm])
            unsupported = ", ".join((action.get("applicability") or {}).get("not_supported") or [])
            story.append(Paragraph(f"Abgrenzung: {html.escape(unsupported or 'keine')}", styles["PSmall"]))

        chart_helper = StructuralReportRenderer()
        for number, position in enumerate(result["positions"], 3):
            position_result = position["result"]
            story.append(PageBreak())
            story.append(Paragraph(f"{number} · {position['position_ref']} · {html.escape(position['label'])}", styles["PSection"]))
            facts = Table([["Gruppe / Ebene", f"{position['group']} / {position.get('level') or '–'}"], ["Analyse", position_result.get("analysis_ref")], ["Modell / Status", f"{position_result['analysis']['kind']} / {position_result['summary']['status']}"], ["Abhängigkeiten", ", ".join(position.get("dependencies") or []) or "keine"]], colWidths=[42*mm, 120*mm]); facts.setStyle(self._table_style(colors, header=False)); story.append(facts)
            chart = chart_helper._pdf_result_chart(position_result, Drawing, Line, PolyLine, Rect, String, colors)
            if chart:
                story.extend([Spacer(1, 4*mm), chart])
            table_section(f"{number}.1 · Einwirkungen", ["LF", "Bezeichnung", "Kategorie", "Wert", "Einheit", "Typ"], [[item.get("load_case_id"), item.get("label"), item.get("category"), item.get("value"), item.get("unit"), item.get("action_type")] for item in position["job"].get("load_cases") or []], [16*mm, 55*mm, 28*mm, 22*mm, 22*mm, 37*mm])
            combinations = list(position_result.get("combinations") or [])
            if combinations:
                table_section(f"{number}.2 · Lastkombinationen", ["Kombination", "GZT", "Faktoren", "Wert"], [[item.get("combination_id"), item.get("limit_state"), json.dumps(item.get("factors") or {}, ensure_ascii=False), item.get("value")] for item in combinations], [38*mm, 22*mm, 82*mm, 38*mm])
            checks = list((position_result.get("design") or {}).get("checks") or [])
            table_section(f"{number}.3 · Nachweise", ["Nachweis", "GZ", "Einwirkung", "Widerstand", "Einheit", "Ausn.", "Status"], [[item.get("label"), item.get("limit_state"), item.get("design_value"), item.get("resistance_value"), item.get("unit"), f"{float(item.get('utilization') or 0)*100:.1f} %", item.get("status")] for item in checks], [44*mm, 17*mm, 26*mm, 26*mm, 18*mm, 21*mm, 28*mm])
            table_section(f"{number}.4 · Rechenweg", ["#", "Schritt", "Formel", "Einsetzungen", "Ergebnis / Bezug"], [[index, item.get("label"), item.get("formula"), item.get("substitutions"), f"{_fmt(item.get('value'))} {item.get('unit','')} · {', '.join(item.get('standard_refs') or [])}"] for index, item in enumerate(position_result.get("calculation_steps") or [], 1)], [9*mm, 37*mm, 43*mm, 56*mm, 35*mm])

        story.append(PageBreak())
        table_section("Rechenmethoden-Anhang · Literatur und Umsetzungsstand", ["ID", "Kapitel / Ansatz", "Beschreibung", "Quelle", "Status / Backend"], [[item["formula_id"], f"{item['chapter']} · {item['equation']}", item["description"], f"S. {(item.get('source') or {}).get('book_pages','–')}", f"{item['status']} · {item.get('backend','')}" ] for item in result.get("formula_catalog") or []], [16*mm, 48*mm, 54*mm, 22*mm, 40*mm])
        table_section("Offene Punkte", ["Nr.", "Hinweis"], [[index, item] for index, item in enumerate(result.get("warnings") or [], 1)], [12*mm, 168*mm])
        story.extend([Spacer(1, 7*mm), Paragraph("Freigabe", styles["PSection"]), Paragraph("Diese Rechenakte ist nicht prüffähig. Aufgestellt: ____________________    Geprüft: ____________________    Datum: ____________________", styles["PBody"])])

        def page(canvas: Any, document: Any) -> None:
            canvas.saveState(); canvas.setStrokeColor(colors.HexColor("#C7D3D9")); canvas.line(15*mm, 13*mm, 195*mm, 13*mm); canvas.setFont("Vera", 7); canvas.setFillColor(colors.HexColor("#607480")); canvas.drawString(15*mm, 8.5*mm, f"VECTOPLAN Statik · {result['project_analysis_ref']}"); canvas.drawRightString(195*mm, 8.5*mm, f"Seite {document.page}"); canvas.restoreState()
        doc.build(story, onFirstPage=page, onLaterPages=page)
        return stream.getvalue()

    @staticmethod
    def _table_style(colors: Any, *, header: bool) -> Any:
        from reportlab.platypus import TableStyle
        commands = [("FONTNAME", (0,0), (-1,-1), "Vera"), ("FONTSIZE", (0,0), (-1,-1), 7.1), ("LEADING", (0,0), (-1,-1), 9.1), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#C7D3D9")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 4), ("RIGHTPADDING", (0,0), (-1,-1), 4), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4), ("ROWBACKGROUNDS", (0,1 if header else 0), (-1,-1), [colors.white, colors.HexColor("#F3F7F8")])]
        if header:
            commands.extend([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#173B55")), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTNAME", (0,0), (-1,0), "VeraBd")])
        else:
            commands.extend([("FONTNAME", (0,0), (0,-1), "VeraBd"), ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#E9F1F3"))])
        return TableStyle(commands)


__all__ = ["ProjectReportRenderer"]
