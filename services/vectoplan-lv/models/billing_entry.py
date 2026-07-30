"""Editable measurement and billing information for a single LV position."""

from __future__ import annotations

from extensions import db
from models.base import PRIMARY_KEY_TYPE, TimestampMixin


class BillingEntry(TimestampMixin, db.Model):
    __tablename__ = "billing_entries"
    __table_args__ = (
        db.UniqueConstraint(
            "lv_item_id",
            "invoice_number",
            name="uq_billing_entries_item_invoice",
        ),
        db.Index(
            "ix_billing_entries_document_invoice",
            "lv_document_id",
            "invoice_number",
        ),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(40), nullable=False, unique=True, index=True)
    project_public_id = db.Column(db.String(128), nullable=False, index=True)
    lv_document_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    lv_version_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    lv_item_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    invoice_number = db.Column(db.String(80), nullable=False)
    billed_quantity = db.Column(db.Numeric(18, 3), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    attachment_manifest = db.Column(db.JSON, nullable=False, default=list)
    calculation_rows = db.Column(db.JSON, nullable=False, default=list)
    calculation_total = db.Column(db.Numeric(18, 3), nullable=True)
    revision = db.Column(db.Integer, nullable=False, default=1)

    item = db.relationship("LvItem", back_populates="billing_entries")
    document = db.relationship("LvDocument", foreign_keys=[lv_document_id])
    version = db.relationship("LvVersion", foreign_keys=[lv_version_id])

    def __repr__(self) -> str:
        return (
            f"<BillingEntry {self.public_id} invoice={self.invoice_number!r} "
            f"item={self.lv_item_id}>"
        )


__all__ = ["BillingEntry"]
