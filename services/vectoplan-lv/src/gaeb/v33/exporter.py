"""GAEB DA XML 3.3 foundation exporter for editable LV rows."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5
from xml.etree import ElementTree

from models import LvDocument, LvItem
from src.lvs.errors import LvValidationError


SUPPORTED_PHASES = {"83", "84"}


def _q(namespace: str, name: str) -> str:
    return f"{{{namespace}}}{name}"


def _element(
    parent: ElementTree.Element,
    namespace: str,
    name: str,
    text: object | None = None,
    **attributes: str,
) -> ElementTree.Element:
    child = ElementTree.SubElement(parent, _q(namespace, name), attributes)
    if text is not None:
        child.text = str(text)
    return child


def _number(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(Decimal(value), "f")


def _description(
    parent: ElementTree.Element,
    namespace: str,
    item: LvItem,
) -> None:
    description = _element(parent, namespace, "Description")
    complete = _element(description, namespace, "CompleteText")
    detail = _element(complete, namespace, "DetailTxt")
    detail_text = _element(detail, namespace, "Text")
    _element(
        detail_text,
        namespace,
        "p",
        item.long_text or item.short_text or "",
    )
    outline = _element(description, namespace, "OutlineText")
    outline_text = _element(outline, namespace, "OutlTxt")
    text = _element(outline_text, namespace, "Text")
    _element(text, namespace, "p", item.short_text or item.long_text or "")


def export_gaeb(
    document: LvDocument,
    items: list[LvItem],
    *,
    phase: str = "84",
) -> bytes:
    phase = str(phase).strip()
    if phase not in SUPPORTED_PHASES:
        raise LvValidationError("GAEB export phase must be 83 or 84")

    namespace = f"http://www.gaeb.de/GAEB_DA_XML/DA{phase}/3.3"
    ElementTree.register_namespace("", namespace)
    root = ElementTree.Element(_q(namespace, "GAEB"))
    now = datetime.now(UTC)

    info = _element(root, namespace, "GAEBInfo")
    _element(info, namespace, "Version", "3.3")
    _element(info, namespace, "VersDate", "2021-05")
    _element(info, namespace, "Date", now.date().isoformat())
    _element(info, namespace, "Time", now.time().replace(microsecond=0).isoformat())
    _element(info, namespace, "ProgSystem", "VECTOPLAN")
    _element(info, namespace, "ProgName", "vectoplan-lv")

    project = _element(root, namespace, "PrjInfo")
    _element(project, namespace, "NamePrj", document.name)
    _element(project, namespace, "LblPrj", document.project_public_id)

    award = _element(root, namespace, "Award")
    _element(award, namespace, "DP", phase)
    boq = _element(
        award,
        namespace,
        "BoQ",
        ID=str(uuid5(NAMESPACE_URL, document.public_id)),
    )
    boq_info = _element(boq, namespace, "BoQInfo")
    _element(boq_info, namespace, "Name", document.name)
    _element(boq_info, namespace, "Cur", document.currency)
    body = _element(boq, namespace, "BoQBody")
    item_list = _element(body, namespace, "Itemlist")

    for item in items:
        if item.item_type in {"title", "section"}:
            continue
        item_element = _element(
            item_list,
            namespace,
            "Item",
            ID=str(uuid5(NAMESPACE_URL, item.public_id)),
        )
        _element(
            item_element,
            namespace,
            "RNoPart",
            item.ordinal_number or f"TXT-{item.sort_order}",
        )
        _element(
            item_element,
            namespace,
            "Qty",
            _number(item.quantity) if item.item_type == "position" else "0",
        )
        _element(
            item_element,
            namespace,
            "QU",
            item.unit if item.item_type == "position" else "txt",
        )
        _description(item_element, namespace, item)
        if phase == "84" and item.unit_price is not None:
            _element(item_element, namespace, "UP", _number(item.unit_price))
            if item.total_price is not None:
                _element(item_element, namespace, "IT", _number(item.total_price))

    ElementTree.indent(root, space="  ")
    return ElementTree.tostring(
        root,
        encoding="utf-8",
        xml_declaration=True,
    )


__all__ = ["SUPPORTED_PHASES", "export_gaeb"]
