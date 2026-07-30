"""Tolerant and defensive GAEB DA XML 3.3 position parser."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree

from src.lvs.errors import LvValidationError


MAX_XML_BYTES = 100 * 1024 * 1024


@dataclass(frozen=True)
class ParsedGaeb:
    version: str
    phase: str
    items: list[dict]
    warnings: list[str]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _direct_child(element: ElementTree.Element, name: str):
    return next(
        (child for child in element if _local_name(child.tag) == name),
        None,
    )


def _first_descendant(element: ElementTree.Element, name: str):
    return next(
        (candidate for candidate in element.iter() if _local_name(candidate.tag) == name),
        None,
    )


def _element_text(element: ElementTree.Element | None) -> str | None:
    if element is None:
        return None
    parts = [" ".join(part.split()) for part in element.itertext() if part.strip()]
    return "\n".join(part for part in parts if part) or None


def _decimal(element: ElementTree.Element, name: str) -> str | None:
    candidate = _first_descendant(element, name)
    raw = _element_text(candidate)
    if not raw:
        return None
    normalized = raw.replace(" ", "").replace(",", ".")
    try:
        value = Decimal(normalized)
    except InvalidOperation:
        return None
    return format(value, "f")


def _parse_item(element: ElementTree.Element, prefix: list[str]) -> dict:
    rno = _element_text(_direct_child(element, "RNoPart"))
    ordinal_parts = [part for part in [*prefix, rno] if part]
    ordinal = ".".join(ordinal_parts) or None

    description = _first_descendant(element, "Description")
    outline = (
        _first_descendant(description, "OutlineText")
        if description is not None
        else None
    )
    complete = (
        _first_descendant(description, "CompleteText")
        if description is not None
        else None
    )
    short_text = _element_text(outline)
    long_text = _element_text(complete)
    if not long_text:
        long_text = _element_text(description)
    if not short_text and long_text:
        short_text = long_text.splitlines()[0][:500]

    item_type = str(element.attrib.get("VECTOPLANType") or "position").lower()
    unit = _element_text(_first_descendant(element, "QU"))
    if item_type != "text" and unit == "txt":
        item_type = "text"
    return {
        "item_type": "text" if item_type == "text" else "position",
        "ordinal_number": ordinal,
        "short_text": short_text or "Importierte GAEB-Position",
        "long_text": long_text,
        "quantity": _decimal(element, "Qty"),
        "unit": unit,
        "unit_price": _decimal(element, "UP"),
    }


def _walk_body(
    body: ElementTree.Element,
    prefix: list[str],
    destination: list[dict],
) -> None:
    for child in body:
        name = _local_name(child.tag)
        if name == "BoQCtgy":
            part = _element_text(_direct_child(child, "RNoPart"))
            nested = _direct_child(child, "BoQBody")
            if nested is not None:
                _walk_body(nested, [*prefix, *([part] if part else [])], destination)
        elif name == "Itemlist":
            for item in child:
                if _local_name(item.tag) == "Item":
                    destination.append(_parse_item(item, prefix))
        elif name == "Item":
            destination.append(_parse_item(child, prefix))


def parse_gaeb(xml_bytes: bytes) -> ParsedGaeb:
    if not xml_bytes:
        raise LvValidationError("the GAEB file is empty")
    if len(xml_bytes) > MAX_XML_BYTES:
        raise LvValidationError("the GAEB file exceeds the 100 MB limit")
    probe = xml_bytes[:4096].upper()
    if b"<!DOCTYPE" in probe or b"<!ENTITY" in probe:
        raise LvValidationError("DTD and entity declarations are not allowed")

    try:
        root = ElementTree.fromstring(xml_bytes)
    except ElementTree.ParseError as exc:
        raise LvValidationError(f"invalid GAEB XML: {exc}") from None
    if _local_name(root.tag) != "GAEB":
        raise LvValidationError("the XML root element must be GAEB")

    version = _element_text(_first_descendant(root, "Version")) or ""
    namespace = root.tag.partition("}")[0].lstrip("{")
    if not version and namespace.endswith("/3.3"):
        version = "3.3"
    if not version.startswith("3.3"):
        raise LvValidationError("only GAEB DA XML version 3.3 is supported")

    phase = _element_text(_first_descendant(root, "DP")) or ""
    warnings: list[str] = []
    if phase and phase not in {"80", "81", "82", "83", "84", "85", "86", "87"}:
        warnings.append(f"Die Austauschphase X{phase} wird als LV-Grundlage gelesen.")

    items: list[dict] = []
    body = _first_descendant(root, "BoQBody")
    if body is not None:
        _walk_body(body, [], items)
    if not items:
        for element in root.iter():
            if _local_name(element.tag) == "Item":
                items.append(_parse_item(element, []))
    if not items:
        warnings.append("Die Datei enthält keine importierbaren LV-Positionen.")
    warnings.append(
        "Es wurde keine vollständige XSD-Prüfung durchgeführt; dafür ist der "
        "offizielle GAEB-XML-Checker vorgesehen."
    )
    return ParsedGaeb(
        version=version,
        phase=phase,
        items=items,
        warnings=warnings,
    )


__all__ = ["MAX_XML_BYTES", "ParsedGaeb", "parse_gaeb"]
