"""Editable hierarchy and position rows within a mutable LV version."""

from __future__ import annotations

from decimal import Decimal

from extensions import db
from models.base import PRIMARY_KEY_TYPE, SoftDeleteMixin, TimestampMixin


LV_ITEM_TYPES = {"position", "text", "title", "section"}


class LvItem(TimestampMixin, SoftDeleteMixin, db.Model):
    __tablename__ = "lv_items"
    __table_args__ = (
        db.UniqueConstraint(
            "lv_version_id",
            "ordinal_number",
            name="uq_lv_items_version_ordinal",
        ),
        db.CheckConstraint(
            "item_type IN ('position','text','title','section')",
            name="item_type_allowed",
        ),
        db.Index("ix_lv_items_version_sort", "lv_version_id", "sort_order"),
        db.Index("ix_lv_items_parent_sort", "parent_item_id", "sort_order"),
    )

    id = db.Column(PRIMARY_KEY_TYPE, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(40), nullable=False, unique=True, index=True)
    lv_version_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey("lv_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_item_id = db.Column(
        PRIMARY_KEY_TYPE,
        db.ForeignKey(
            "lv_items.id",
            name="fk_lv_items_parent_item_id_lv_items",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    sort_order = db.Column(db.Integer, nullable=False, default=10)
    ordinal_number = db.Column(db.String(64), nullable=True)
    item_type = db.Column(db.String(16), nullable=False, default="position")
    short_text = db.Column(db.String(500), nullable=True)
    long_text = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Numeric(18, 3), nullable=True)
    unit = db.Column(db.String(32), nullable=True)
    unit_price = db.Column(db.Numeric(18, 4), nullable=True)
    calculation_rows = db.Column(db.JSON, nullable=False, default=list)
    calculation_total = db.Column(db.Numeric(18, 3), nullable=True)
    calculation_note = db.Column(db.Text, nullable=True)
    calculation_attachment_manifest = db.Column(
        db.JSON,
        nullable=False,
        default=list,
    )
    revision = db.Column(db.Integer, nullable=False, default=1)

    version = db.relationship("LvVersion", foreign_keys=[lv_version_id])
    parent = db.relationship(
        "LvItem",
        remote_side=[id],
        foreign_keys=[parent_item_id],
        back_populates="children",
    )
    children = db.relationship(
        "LvItem",
        foreign_keys=[parent_item_id],
        back_populates="parent",
        lazy="selectin",
    )
    billing_entries = db.relationship(
        "BillingEntry",
        back_populates="item",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def total_price(self) -> Decimal | None:
        if self.quantity is None or self.unit_price is None:
            return None
        return Decimal(self.quantity) * Decimal(self.unit_price)

    def __repr__(self) -> str:
        return (
            f"<LvItem {self.public_id} type={self.item_type} "
            f"oz={self.ordinal_number!r}>"
        )


__all__ = ["LV_ITEM_TYPES", "LvItem"]
