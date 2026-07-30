"""The project-scoped Leistungsverzeichnis aggregate root."""

from __future__ import annotations

from extensions import db
from models.base import PRIMARY_KEY_TYPE, SoftDeleteMixin, TimestampMixin


LV_KINDS = {
    "tender",
    "estimate",
    "offer",
    "contract",
    "change_order",
    "billing",
    "internal",
}
LV_STATUSES = {"draft", "active", "archived"}


class LvDocument(TimestampMixin, SoftDeleteMixin, db.Model):
    __tablename__ = "lv_documents"
    __table_args__ = (
        db.CheckConstraint(
            "kind IN ('tender','estimate','offer','contract','change_order','billing','internal')",
            name="kind_allowed",
        ),
        db.CheckConstraint(
            "status IN ('draft','active','archived')",
            name="status_allowed",
        ),
        db.Index("ix_lv_documents_project_status", "project_public_id", "status"),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(40), nullable=False, unique=True, index=True)
    project_public_id = db.Column(db.String(128), nullable=False, index=True)
    name = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text, nullable=True)
    kind = db.Column(db.String(32), nullable=False, default="tender")
    status = db.Column(db.String(24), nullable=False, default="draft")
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    owner_user_id = db.Column(db.String(128), nullable=True)
    revision = db.Column(db.Integer, nullable=False, default=1)

    # The cyclic aggregate pointers are created as ALTER constraints on
    # PostgreSQL. They intentionally never point at a different LV document.
    current_draft_version_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey(
            "lv_versions.id",
            name="fk_lv_documents_current_draft_version_id_lv_versions",
            use_alter=True,
        ),
        nullable=True,
    )
    current_contract_version_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey(
            "lv_versions.id",
            name="fk_lv_documents_current_contract_version_id_lv_versions",
            use_alter=True,
        ),
        nullable=True,
    )

    versions = db.relationship(
        "LvVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="LvVersion.lv_document_id",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<LvDocument {self.public_id} {self.name!r}>"


__all__ = ["LV_KINDS", "LV_STATUSES", "LvDocument"]
