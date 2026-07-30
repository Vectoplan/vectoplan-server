"""Safe decimal evaluation for measurement calculation rows."""

from __future__ import annotations

import ast
from decimal import Decimal, DivisionByZero, InvalidOperation
from typing import Any, Mapping, Sequence

from src.lvs.errors import LvValidationError


MAX_EXPRESSION_LENGTH = 200
MAX_CALCULATION_ROWS = 100
MAX_AST_NODES = 64
MAX_ABSOLUTE_RESULT = Decimal("1000000000000")


def _evaluate_node(node: ast.AST) -> Decimal:
    if isinstance(node, ast.Expression):
        return _evaluate_node(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise LvValidationError("calculation expressions may only contain numbers")
        return Decimal(str(node.value))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _evaluate_node(node.operand)
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.BinOp):
        left = _evaluate_node(node.left)
        right = _evaluate_node(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            if right == 0:
                raise LvValidationError("division by zero is not allowed")
            return left / right
    raise LvValidationError(
        "calculation expressions support only +, -, *, / and parentheses"
    )


def evaluate_expression(expression: str) -> Decimal:
    normalized = str(expression or "").strip()
    if not normalized:
        raise LvValidationError("a calculation expression is required")
    if len(normalized) > MAX_EXPRESSION_LENGTH:
        raise LvValidationError(
            f"calculation expressions must not exceed {MAX_EXPRESSION_LENGTH} characters"
        )
    normalized = (
        normalized.replace("×", "*")
        .replace("·", "*")
        .replace(":", "/")
        .replace(",", ".")
    )
    try:
        tree = ast.parse(normalized, mode="eval")
    except SyntaxError:
        raise LvValidationError(
            f"invalid calculation expression: {expression}"
        ) from None
    if sum(1 for _ in ast.walk(tree)) > MAX_AST_NODES:
        raise LvValidationError("calculation expression is too complex")
    try:
        result = _evaluate_node(tree)
    except (DivisionByZero, InvalidOperation):
        raise LvValidationError(
            f"invalid calculation expression: {expression}"
        ) from None
    if not result.is_finite() or abs(result) > MAX_ABSOLUTE_RESULT:
        raise LvValidationError("calculation result is outside the allowed range")
    return result


def evaluate_calculation_rows(
    raw_rows: Any,
) -> tuple[list[dict[str, str]], Decimal]:
    if raw_rows is None:
        return [], Decimal("0")
    if not isinstance(raw_rows, Sequence) or isinstance(raw_rows, (str, bytes)):
        raise LvValidationError("calculation_rows must be an array")
    if len(raw_rows) > MAX_CALCULATION_ROWS:
        raise LvValidationError(
            f"calculation_rows must not contain more than {MAX_CALCULATION_ROWS} rows"
        )

    rows: list[dict[str, str]] = []
    total = Decimal("0")
    for raw in raw_rows:
        if not isinstance(raw, Mapping):
            raise LvValidationError("each calculation row must be an object")
        expression = str(raw.get("expression") or "").strip()
        note = str(raw.get("note") or "").strip()
        if len(note) > 250:
            raise LvValidationError(
                "calculation row notes must not exceed 250 characters"
            )
        if not expression:
            if not note:
                continue
            rows.append(
                {
                    "expression": "",
                    "note": note,
                    "result": "",
                }
            )
            continue
        result = evaluate_expression(expression)
        total += result
        rows.append(
            {
                "expression": expression,
                "note": note,
                "result": format(result, ".3f"),
            }
        )
    return rows, total


__all__ = ["evaluate_calculation_rows", "evaluate_expression"]
