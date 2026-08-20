"""Create a complete page and equation-candidate index for EC1 through EC9.

This script does not claim that extracted equation text is verified. It creates
the reproducible evidence layer used by the human-readable formula catalog:
document identity, page text quality, clauses, tables, figures and candidate
equation snippets with exact PDF pages.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from pypdf import PdfReader


CLAUSE_RE = re.compile(r"^\s*(\d+(?:\.\d+){0,5})\s+([A-ZÄÖÜ][^=]{3,180})$")
DESIGNATION_RE = re.compile(
    r"DIN\s+EN\s+(199[1-9](?:[-–]\d+){1,3})(?:\s*[/]\s*(NA))?",
    re.IGNORECASE,
)
EQUATION_NUMBER_RE = re.compile(r"(?:^|\s)\((\d+(?:\.\d+)?[a-z]?)\)\s*$", re.IGNORECASE)
TABLE_RE = re.compile(r"\b(?:Tabelle|Table)\s+([A-Z]?(?:\d+(?:\.\d+)*))", re.IGNORECASE)
FIGURE_RE = re.compile(r"\b(?:Bild|Figure)\s+([A-Z]?(?:\d+(?:\.\d+)*))", re.IGNORECASE)


def clean_text(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", text).strip("_")


def classify(path: Path) -> str:
    name = path.stem.casefold()
    if "berichtigung" in name:
        return "corrigendum"
    if re.search(r"(?:^|\s)a\d+(?:\s|$)", name):
        return "amendment"
    if re.search(r"(?:^|\s)na(?:\s|$)", name):
        return "national_annex"
    return "base_standard"


def fallback_designation(path: Path, family: int) -> str:
    part_match = re.search(r"Teil\s+([0-9]+(?:-[0-9]+)?)", path.stem, re.IGNORECASE)
    part = part_match.group(1) if part_match else "unvollständig"
    return f"DIN EN 199{family}-{part}"


def formula_candidate(lines: list[str], index: int) -> bool:
    line = lines[index]
    if len(line) > 320 or len(line) < 2:
        return False
    if EQUATION_NUMBER_RE.search(line):
        return True
    if "=" in line and not re.search(r"https?://|www\.", line, re.IGNORECASE):
        return True
    if re.search(r"\b(?:Gleichung|Formel)\s*\(?\d+", line, re.IGNORECASE):
        return True
    return False


def inspect_pdf(path: Path, root: Path, output: Path) -> dict[str, Any]:
    relative = path.relative_to(root)
    family = int(relative.parts[0].replace("EC", "").strip())
    doc_slug = slug(f"EC{family}__{path.stem}")
    reader = PdfReader(path)
    pages: list[dict[str, Any]] = []
    text_chunks: list[str] = []
    clauses: list[dict[str, Any]] = []
    equations: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    figures: list[dict[str, Any]] = []
    designation = ""

    for page_number, page in enumerate(reader.pages, start=1):
        text = clean_text(page.extract_text() or "")
        text_chunks.append(f"\n\n===== PDF-SEITE {page_number} =====\n{text}")
        if page_number <= 8 and not designation:
            match = DESIGNATION_RE.search(text)
            if match:
                designation = "DIN EN " + match.group(1).replace("–", "-")
                if match.group(2):
                    designation += "/NA"
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        page_clauses = []
        page_equation_count = 0
        for line_index, line in enumerate(lines):
            clause_match = CLAUSE_RE.match(line)
            if clause_match:
                entry = {"clause": clause_match.group(1), "title": clause_match.group(2).strip(), "pdf_page": page_number}
                clauses.append(entry)
                page_clauses.append(entry["clause"])
            if formula_candidate(lines, line_index):
                page_equation_count += 1
                start = max(0, line_index - 2)
                end = min(len(lines), line_index + 3)
                number_match = EQUATION_NUMBER_RE.search(line)
                equations.append(
                    {
                        "pdf_page": page_number,
                        "equation_number": number_match.group(1) if number_match else "unvollständig",
                        "line": line,
                        "context": " | ".join(lines[start:end]),
                        "review_status": "machine_candidate_unverified",
                    }
                )
            for match in TABLE_RE.finditer(line):
                tables.append({"label": match.group(1), "pdf_page": page_number, "line": line[:240]})
            for match in FIGURE_RE.finditer(line):
                figures.append({"label": match.group(1), "pdf_page": page_number, "line": line[:240]})
        pages.append(
            {
                "pdf_page": page_number,
                "characters": len(text),
                "text_layer": "usable" if len(text) >= 120 else "weak_or_scanned",
                "clauses": page_clauses,
                "equation_candidates": page_equation_count,
            }
        )

    if not designation:
        designation = fallback_designation(path, family)
    kind = classify(path)
    if kind == "national_annex" and not designation.endswith("/NA"):
        designation += "/NA"
    payload = {
        "document_id": slug(designation.replace("DIN EN", "EN") + "__" + kind + "__" + path.stem),
        "eurocode_family": f"EC{family}",
        "designation": designation,
        "document_kind": kind,
        "file_name": path.name,
        "relative_path": str(relative).replace("\\", "/"),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "pages": len(reader.pages),
        "text_pages": sum(page["text_layer"] == "usable" for page in pages),
        "weak_or_scanned_pages": sum(page["text_layer"] != "usable" for page in pages),
        "clause_count": len(clauses),
        "equation_candidate_count": len(equations),
        "table_reference_count": len(tables),
        "figure_reference_count": len(figures),
        "metadata": {str(key).lstrip("/"): str(value) for key, value in (reader.metadata or {}).items()},
        "clauses": clauses,
        "equation_candidates": equations,
        "tables": tables,
        "figures": figures,
        "page_quality": pages,
    }
    (output / "text" / f"{doc_slug}.txt").write_text("".join(text_chunks), encoding="utf-8")
    (output / "documents" / f"{doc_slug}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output.resolve()
    (output / "text").mkdir(parents=True, exist_ok=True)
    (output / "documents").mkdir(parents=True, exist_ok=True)
    pdfs = sorted(
        path for folder in root.iterdir()
        if folder.is_dir() and re.fullmatch(r"EC\s*[1-9]", folder.name)
        for path in folder.rglob("*.pdf")
    )
    results = []
    errors = []
    pending = []
    for path in pdfs:
        relative = path.relative_to(root)
        family = int(relative.parts[0].replace("EC", "").strip())
        cached = output / "documents" / f"{slug(f'EC{family}__{path.stem}')}.json"
        if args.resume and cached.exists():
            try:
                results.append(json.loads(cached.read_text(encoding="utf-8")))
                continue
            except (OSError, json.JSONDecodeError):
                pass
        pending.append(path)
    if results:
        print(f"Resume: {len(results)} Dokumente aus vorhandenem Index übernommen.", flush=True)
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_map = {pool.submit(inspect_pdf, path, root, output): path for path in pending}
        for number, future in enumerate(as_completed(future_map), start=1):
            path = future_map[future]
            try:
                result = future.result()
                results.append(result)
                print(f"[{len(results):03d}/{len(pdfs):03d}] {result['designation']} - {path.name}", flush=True)
            except Exception as error:  # keep the inventory useful when one PDF is damaged
                errors.append({"file": str(path), "error": repr(error)})
                print(f"[{len(results) + len(errors):03d}/{len(pdfs):03d}] ERROR {path.name}: {error}", flush=True)
    results.sort(key=lambda item: (item["eurocode_family"], item["designation"], item["file_name"]))
    families = {}
    for family in [f"EC{number}" for number in range(1, 10)]:
        docs = [item for item in results if item["eurocode_family"] == family]
        families[family] = {
            "documents": len(docs),
            "pages": sum(item["pages"] for item in docs),
            "text_pages": sum(item["text_pages"] for item in docs),
            "equation_candidates": sum(item["equation_candidate_count"] for item in docs),
            "clauses": sum(item["clause_count"] for item in docs),
        }
    inventory = {
        "schema_version": "eurocode-source-inventory/0.1",
        "root_label": root.name,
        "scope": "EC1 through EC9 folders only",
        "documents": len(results),
        "pages": sum(item["pages"] for item in results),
        "text_pages": sum(item["text_pages"] for item in results),
        "weak_or_scanned_pages": sum(item["weak_or_scanned_pages"] for item in results),
        "equation_candidates": sum(item["equation_candidate_count"] for item in results),
        "clauses": sum(item["clause_count"] for item in results),
        "families": families,
        "errors": errors,
        "document_records": results,
    }
    (output / "eurocode_inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: inventory[key] for key in ("documents", "pages", "text_pages", "weak_or_scanned_pages", "equation_candidates", "clauses", "errors")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
