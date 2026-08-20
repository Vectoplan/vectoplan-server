"""Normalize the raw EC1-EC9 source inventory into a queryable rule catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any


FAMILIES = {
    "EC1": ("Einwirkungen auf Tragwerke", "actions"),
    "EC2": ("Beton-, Stahlbeton- und Spannbetonbau", "concrete"),
    "EC3": ("Stahlbau", "steel"),
    "EC4": ("Verbundbau", "composite"),
    "EC5": ("Holzbau", "timber"),
    "EC6": ("Mauerwerksbau", "masonry"),
    "EC7": ("Geotechnische Bemessung", "geotechnics"),
    "EC8": ("Erdbebenbemessung", "seismic"),
    "EC9": ("Aluminiumbau", "aluminium"),
}

TOPICS = [
    ("fire", ("brand", "feuer", "temperatur")),
    ("fatigue", ("ermüd", "fatigue", "schwingbreite", "lastspiel")),
    ("stability", ("knick", "beul", "kip", "stabil", "imperfektion", "zweiter ordnung")),
    ("connections", ("anschluss", "verbindung", "schraub", "schweiß", "dübel", "bolzen")),
    ("serviceability", ("gebrauchstaug", "verform", "durchbieg", "riss", "schwingung")),
    ("resistance", ("tragfähig", "widerstand", "bemessungswert", "querschnitt", "beanspruchbarkeit")),
    ("actions", ("einwirkung", "last", "wind", "schnee", "temperatur", "verkehr")),
    ("combinations", ("kombination", "teilsicherheit", "grenzzustand", "zuverlässigkeit")),
    ("materials", ("festigkeit", "elastizität", "material", "baustoff", "kennwert")),
    ("detailing", ("konstruktiv", "mindest", "abstand", "bewehr", "detail")),
    ("analysis", ("berechnung", "schnittgröße", "moment", "normalkraft", "querkraft", "spannung")),
]


def topic_for(text: str, family: str) -> str:
    folded = text.casefold()
    for topic, terms in TOPICS:
        if any(term in folded for term in terms):
            return topic
    return FAMILIES[family][1]


def confidence_for(candidate: dict[str, Any]) -> str:
    line = str(candidate.get("line") or "")
    number = str(candidate.get("equation_number") or "unvollständig")
    if number != "unvollständig" and "=" in str(candidate.get("context") or ""):
        return "high"
    if "=" in line and re.search(r"[A-Za-zΑ-ω]\s*(?:=|≤|≥)", line):
        return "high"
    if "=" in line or number != "unvollständig":
        return "medium"
    return "low"


def short_excerpt(context: str, limit: int = 420) -> str:
    value = clean_display(re.sub(r"\s*\|\s*", " · ", context.strip()))
    value = re.sub(r"\s+", " ", value)
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def clean_display(value: str) -> str:
    cleaned = []
    for character in str(value):
        category = unicodedata.category(character)
        if character == "�" or category in {"Cc", "Cs", "Co"}:
            cleaned.append(" ")
        else:
            cleaned.append(character)
    return re.sub(r"\s+", " ", "".join(cleaned)).strip()


def valid_clause(item: dict[str, Any]) -> bool:
    clause = str(item.get("clause") or "")
    title = str(item.get("title") or "").strip()
    try:
        top_level = int(clause.split(".", 1)[0])
    except ValueError:
        return False
    return top_level <= 12 and len(title) <= 150 and not title.endswith((".", ";", ","))


def nearest_clause(clauses: list[dict[str, Any]], page: int) -> dict[str, Any] | None:
    matches = [item for item in clauses if int(item.get("pdf_page") or 0) <= page and valid_clause(item)]
    return matches[-1] if matches else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    documents = []
    rules = []

    for document in inventory["document_records"]:
        family = document["eurocode_family"]
        family_title, family_domain = FAMILIES[family]
        reduced_document = {
            "document_id": document["document_id"],
            "eurocode_family": family,
            "family_title": family_title,
            "family_domain": family_domain,
            "designation": document["designation"],
            "document_kind": document["document_kind"],
            "file_name": document["file_name"],
            "relative_path": document["relative_path"],
            "pages": document["pages"],
            "text_pages": document["text_pages"],
            "weak_or_scanned_pages": document["weak_or_scanned_pages"],
            "clause_count": document["clause_count"],
            "equation_candidate_count": document["equation_candidate_count"],
            "source_status": "project_source_edition",
            "current_legal_status": "unvollständig",
            "national_application_status": "unvollständig",
        }
        documents.append(reduced_document)
        clauses = document.get("clauses") or []
        occurrence: Counter[str] = Counter()
        for candidate in document.get("equation_candidates") or []:
            page = int(candidate["pdf_page"])
            equation_number = str(candidate.get("equation_number") or "unvollständig")
            occurrence[equation_number] += 1
            digest = hashlib.sha1(
                f"{document['document_id']}|{page}|{equation_number}|{occurrence[equation_number]}|{candidate.get('line')}".encode("utf-8")
            ).hexdigest()[:10]
            rule_id = f"{family}-{digest.upper()}"
            clause = nearest_clause(clauses, page)
            context = clean_display(str(candidate.get("context") or candidate.get("line") or "unvollständig"))
            topic = topic_for(" ".join([context, (clause or {}).get("title", "")]), family)
            title = (
                f"Gleichung ({equation_number}) · {(clause or {}).get('title', 'Abschnitt unvollständig')}"
                if equation_number != "unvollständig"
                else f"Berechnungsansatz · {(clause or {}).get('title', 'Abschnitt unvollständig')}"
            )
            rules.append(
                {
                    "rule_id": rule_id,
                    "eurocode_family": family,
                    "family_title": family_title,
                    "family_domain": family_domain,
                    "document_id": document["document_id"],
                    "designation": document["designation"],
                    "document_kind": document["document_kind"],
                    "title": title,
                    "topic": topic,
                    "rule_type": "equation_candidate",
                    "equation_number": equation_number,
                    "equation_text": clean_display(str(candidate.get("line") or "unvollständig"))[:500],
                    "source_excerpt": short_excerpt(context),
                    "source": {
                        "file_name": document["file_name"],
                        "pdf_page": page,
                        "clause": (clause or {}).get("clause", "unvollständig"),
                        "section": (clause or {}).get("title", "unvollständig"),
                        "excerpt_kind": "short_text_extraction",
                        "image_excerpt": "unvollständig",
                    },
                    "confidence": confidence_for(candidate),
                    "verification_status": "machine_candidate_unverified",
                    "catalog_status": "incomplete",
                    "implementation_status": "unvollständig",
                    "processing": {
                        "applicability": "unvollständig",
                        "variables": "unvollständig",
                        "units": "unvollständig",
                        "algorithm": "unvollständig",
                        "example": "unvollständig",
                        "tests": "unvollständig",
                    },
                    "normative_context": {
                        "source_edition": "project_source_edition",
                        "national_annex_overlay": "present" if document["document_kind"] == "national_annex" else "not_in_this_document",
                        "amendment_overlay": "present" if document["document_kind"] == "amendment" else "not_in_this_document",
                        "corrigendum_overlay": "present" if document["document_kind"] == "corrigendum" else "not_in_this_document",
                        "current_legal_status": "unvollständig",
                    },
                }
            )

    document_groups: dict[str, list[str]] = {}
    for document in documents:
        base = document["designation"].replace("/NA", "")
        document_groups.setdefault(base, []).append(document["document_id"])
    for document in documents:
        base = document["designation"].replace("/NA", "")
        document["related_documents"] = [item for item in document_groups[base] if item != document["document_id"]]

    topic_counts = Counter(rule["topic"] for rule in rules)
    confidence_counts = Counter(rule["confidence"] for rule in rules)
    kind_counts = Counter(document["document_kind"] for document in documents)
    payload = {
        "schema_version": "eurocode-rule-catalog/0.1",
        "status": "machine_index_complete_professional_verification_in_progress",
        "scope": "All PDFs below project folders EC1 through EC9",
        "unknown_marker": "unvollständig",
        "families": [
            {
                "id": family,
                "order": int(family[2:]),
                "title": FAMILIES[family][0],
                "domain": FAMILIES[family][1],
                **inventory["families"][family],
            }
            for family in FAMILIES
        ],
        "statistics": {
            "documents": len(documents),
            "pages": inventory["pages"],
            "text_pages": inventory["text_pages"],
            "weak_or_scanned_pages": inventory["weak_or_scanned_pages"],
            "clauses": inventory["clauses"],
            "rules": len(rules),
            "by_confidence": dict(confidence_counts),
            "by_topic": dict(topic_counts),
            "by_document_kind": dict(kind_counts),
            "verified_rules": 0,
            "implemented_rules": 0,
        },
        "documents": documents,
        "rules": rules,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["statistics"], ensure_ascii=False, indent=2))
    print(f"Wrote {args.output} ({args.output.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
