"""add editable LV items and billing entries

Revision ID: c8e4a62f15d1
Revises: b7d1f42c8a63
Create Date: 2026-07-29 15:20:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c8e4a62f15d1"
down_revision: Union[str, None] = "b7d1f42c8a63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lv_items",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("lv_version_id", sa.BigInteger(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("ordinal_number", sa.String(length=64), nullable=True),
        sa.Column("item_type", sa.String(length=16), nullable=False),
        sa.Column("short_text", sa.String(length=500), nullable=True),
        sa.Column("long_text", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=18, scale=3), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "item_type IN ('position','text')",
            name=op.f("ck_lv_items_item_type_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["lv_version_id"],
            ["lv_versions.id"],
            name=op.f("fk_lv_items_lv_version_id_lv_versions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lv_items")),
        sa.UniqueConstraint(
            "lv_version_id",
            "ordinal_number",
            name="uq_lv_items_version_ordinal",
        ),
        sa.UniqueConstraint("public_id", name=op.f("uq_lv_items_public_id")),
    )
    op.create_index(
        op.f("ix_lv_items_public_id"),
        "lv_items",
        ["public_id"],
        unique=False,
    )
    op.create_index(
        "ix_lv_items_version_sort",
        "lv_items",
        ["lv_version_id", "sort_order"],
        unique=False,
    )

    op.create_table(
        "billing_entries",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("project_public_id", sa.String(length=128), nullable=False),
        sa.Column("lv_document_id", sa.BigInteger(), nullable=False),
        sa.Column("lv_version_id", sa.BigInteger(), nullable=False),
        sa.Column("lv_item_id", sa.BigInteger(), nullable=False),
        sa.Column("invoice_number", sa.String(length=80), nullable=False),
        sa.Column(
            "billed_quantity",
            sa.Numeric(precision=18, scale=3),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("attachment_manifest", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["lv_document_id"],
            ["lv_documents.id"],
            name=op.f("fk_billing_entries_lv_document_id_lv_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lv_item_id"],
            ["lv_items.id"],
            name=op.f("fk_billing_entries_lv_item_id_lv_items"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lv_version_id"],
            ["lv_versions.id"],
            name=op.f("fk_billing_entries_lv_version_id_lv_versions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_entries")),
        sa.UniqueConstraint(
            "lv_item_id",
            "invoice_number",
            name="uq_billing_entries_item_invoice",
        ),
        sa.UniqueConstraint(
            "public_id",
            name=op.f("uq_billing_entries_public_id"),
        ),
    )
    op.create_index(
        "ix_billing_entries_document_invoice",
        "billing_entries",
        ["lv_document_id", "invoice_number"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_entries_project_public_id"),
        "billing_entries",
        ["project_public_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_billing_entries_public_id"),
        "billing_entries",
        ["public_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_billing_entries_public_id"),
        table_name="billing_entries",
    )
    op.drop_index(
        op.f("ix_billing_entries_project_public_id"),
        table_name="billing_entries",
    )
    op.drop_index(
        "ix_billing_entries_document_invoice",
        table_name="billing_entries",
    )
    op.drop_table("billing_entries")
    op.drop_index("ix_lv_items_version_sort", table_name="lv_items")
    op.drop_index(op.f("ix_lv_items_public_id"), table_name="lv_items")
    op.drop_table("lv_items")
