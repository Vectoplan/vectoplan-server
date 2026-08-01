"""Procurement inquiries, recipients and supplier responses."""

from __future__ import annotations

from extensions import db
from models.base import PRIMARY_KEY_TYPE, TimestampMixin, utc_now


INQUIRY_STATUSES = {
    "draft",
    "queued",
    "sent",
    "offers_received",
    "completed",
    "cancelled",
}
RECIPIENT_STATUSES = {
    "queued",
    "sent",
    "responded",
    "declined",
    "failed",
}
OFFER_STATUSES = {
    "received",
    "reviewing",
    "shortlisted",
    "rejected",
    "accepted",
}


class ProcurementInquiry(TimestampMixin, db.Model):
    """A project-scoped request for prices for one or more LV positions."""

    __tablename__ = "procurement_inquiries"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('draft','queued','sent','offers_received','completed','cancelled')",
            name="status_allowed",
        ),
        db.Index(
            "ix_procurement_inquiries_document_status",
            "lv_document_id",
            "status",
        ),
        db.Index(
            "ix_procurement_inquiries_project_created",
            "project_public_id",
            "created_at",
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
    title = db.Column(db.String(250), nullable=False)
    message = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(24), nullable=False, default="draft")
    due_date = db.Column(db.Date, nullable=True)
    created_by = db.Column(db.String(128), nullable=True)
    queued_at = db.Column(db.DateTime(timezone=True), nullable=True)
    sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    revision = db.Column(db.Integer, nullable=False, default=1)

    document = db.relationship("LvDocument", foreign_keys=[lv_document_id])
    version = db.relationship("LvVersion", foreign_keys=[lv_version_id])
    items = db.relationship(
        "ProcurementInquiryItem",
        back_populates="inquiry",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProcurementInquiryItem.sort_order",
    )
    recipients = db.relationship(
        "ProcurementRecipient",
        back_populates="inquiry",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProcurementRecipient.id",
    )


class ProcurementInquiryItem(db.Model):
    """Immutable position snapshot belonging to an inquiry."""

    __tablename__ = "procurement_inquiry_items"
    __table_args__ = (
        db.UniqueConstraint(
            "inquiry_id",
            "lv_item_id",
            name="uq_procurement_inquiry_items_inquiry_item",
        ),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    inquiry_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("procurement_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    lv_item_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    item_public_id_snapshot = db.Column(db.String(40), nullable=False)
    ordinal_number = db.Column(db.String(64), nullable=True)
    short_text = db.Column(db.String(500), nullable=True)
    long_text = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Numeric(18, 3), nullable=True)
    unit = db.Column(db.String(32), nullable=True)
    sort_order = db.Column(db.Integer, nullable=False, default=10)

    inquiry = db.relationship("ProcurementInquiry", back_populates="items")
    item = db.relationship("LvItem", foreign_keys=[lv_item_id])


class ProcurementRecipient(TimestampMixin, db.Model):
    """A snapshotted company/contact selected for an inquiry."""

    __tablename__ = "procurement_recipients"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('queued','sent','responded','declined','failed')",
            name="status_allowed",
        ),
        db.UniqueConstraint(
            "inquiry_id",
            "contact_email",
            name="uq_procurement_recipients_inquiry_email",
        ),
        db.Index(
            "ix_procurement_recipients_inquiry_status",
            "inquiry_id",
            "status",
        ),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(40), nullable=False, unique=True, index=True)
    inquiry_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("procurement_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    external_company_id = db.Column(db.String(128), nullable=True, index=True)
    company_name = db.Column(db.String(250), nullable=False)
    contact_name = db.Column(db.String(250), nullable=True)
    contact_email = db.Column(db.String(320), nullable=False)
    source = db.Column(db.String(32), nullable=False, default="manual")
    distance_km = db.Column(db.Numeric(10, 2), nullable=True)
    matched_services = db.Column(db.JSON, nullable=False, default=list)
    match_reasons = db.Column(db.JSON, nullable=False, default=list)
    status = db.Column(db.String(24), nullable=False, default="queued")
    queued_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    responded_at = db.Column(db.DateTime(timezone=True), nullable=True)
    delivery_error = db.Column(db.Text, nullable=True)

    inquiry = db.relationship("ProcurementInquiry", back_populates="recipients")
    offer = db.relationship(
        "ProcurementOffer",
        back_populates="recipient",
        cascade="all, delete-orphan",
        lazy="selectin",
        uselist=False,
    )


class ProcurementOffer(TimestampMixin, db.Model):
    """A supplier response with an optional later LLM assessment."""

    __tablename__ = "procurement_offers"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('received','reviewing','shortlisted','rejected','accepted')",
            name="status_allowed",
        ),
        db.UniqueConstraint(
            "recipient_id",
            name="uq_procurement_offers_recipient",
        ),
        db.Index(
            "ix_procurement_offers_inquiry_status",
            "inquiry_id",
            "status",
        ),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(40), nullable=False, unique=True, index=True)
    inquiry_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("procurement_inquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    recipient_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("procurement_recipients.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = db.Column(db.String(24), nullable=False, default="received")
    total_amount = db.Column(db.Numeric(18, 4), nullable=True)
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    delivery_days = db.Column(db.Integer, nullable=True)
    valid_until = db.Column(db.Date, nullable=True)
    message = db.Column(db.Text, nullable=True)
    line_items = db.Column(db.JSON, nullable=False, default=list)
    attachment_manifest = db.Column(db.JSON, nullable=False, default=list)
    llm_assessment = db.Column(db.JSON, nullable=True)
    received_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    revision = db.Column(db.Integer, nullable=False, default=1)

    inquiry = db.relationship("ProcurementInquiry", foreign_keys=[inquiry_id])
    recipient = db.relationship("ProcurementRecipient", back_populates="offer")


__all__ = [
    "INQUIRY_STATUSES",
    "OFFER_STATUSES",
    "RECIPIENT_STATUSES",
    "ProcurementInquiry",
    "ProcurementInquiryItem",
    "ProcurementOffer",
    "ProcurementRecipient",
]
