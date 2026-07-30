"""Common SQLAlchemy model building blocks."""

from __future__ import annotations

from datetime import UTC, datetime

from extensions import db


def utc_now() -> datetime:
    return datetime.now(UTC)


PRIMARY_KEY_TYPE = db.BigInteger().with_variant(db.Integer, "sqlite")


class TimestampMixin:
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )


class SoftDeleteMixin:
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


__all__ = [
    "PRIMARY_KEY_TYPE",
    "SoftDeleteMixin",
    "TimestampMixin",
    "utc_now",
]
