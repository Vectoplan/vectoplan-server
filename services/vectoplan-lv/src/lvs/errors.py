"""Errors raised by LV use cases."""


class LvError(Exception):
    code = "lv_error"
    status_code = 400


class LvValidationError(LvError):
    code = "validation_error"


class LvNotFoundError(LvError):
    code = "lv_not_found"
    status_code = 404


class LvConflictError(LvError):
    code = "lv_conflict"
    status_code = 409


__all__ = [
    "LvConflictError",
    "LvError",
    "LvNotFoundError",
    "LvValidationError",
]
