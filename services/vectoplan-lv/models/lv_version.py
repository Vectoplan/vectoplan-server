"""Immutable-capable versions of an LV document."""

from __future__ import annotations

from extensions import db
from models.base import PRIMARY_KEY_TYPE, utc_now


LV_VERSION_STATUSES = {
    "draft",
    "in_review",
    "released",
    "contractual",
    "superseded",
    "archived",
}


class LvVersion(db.Model):
    __tablename__ = "lv_versions"
    __table_args__ = (
        db.UniqueConstraint(
            "lv_document_id",
            "version_number",
            name="uq_lv_versions_document_number",
        ),
        db.CheckConstraint(
            "status IN ('draft','in_review','released','contractual','superseded','archived')",
            name="status_allowed",
        ),
        db.Index("ix_lv_versions_document_status", "lv_document_id", "status"),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(40), nullable=False, unique=True, index=True)
    lv_document_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number = db.Column(db.Integer, nullable=False)
    label = db.Column(db.String(250), nullable=False)
    status = db.Column(db.String(24), nullable=False, default="draft")
    source_type = db.Column(db.String(32), nullable=False, default="manual")
    source_reference = db.Column(db.String(250), nullable=True)
    based_on_version_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by = db.Column(db.String(128), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utc_now
    )
    released_by = db.Column(db.String(128), nullable=True)
    released_at = db.Column(db.DateTime(timezone=True), nullable=True)
    content_hash = db.Column(db.String(64), nullable=True)

    document = db.relationship(
        "LvDocument",
        back_populates="versions",
        foreign_keys=[lv_document_id],
    )

    @property
    def is_mutable(self) -> bool:
        return self.status in {"draft", "in_review"}

    def __repr__(self) -> str:
        return (
            f"<LvVersion {self.public_id} v{self.version_number} "
            f"status={self.status}>"
        )


__all__ = ["LV_VERSION_STATUSES", "LvVersion"]
