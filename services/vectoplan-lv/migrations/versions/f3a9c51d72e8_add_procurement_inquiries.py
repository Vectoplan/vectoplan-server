"""add procurement inquiries, recipients and offers

Revision ID: f3a9c51d72e8
Revises: e64a21bc903f
Create Date: 2026-07-30 14:30:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f3a9c51d72e8"
down_revision: Union[str, None] = "e64a21bc903f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "procurement_inquiries",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("project_public_id", sa.String(length=128), nullable=False),
        sa.Column("lv_document_id", sa.BigInteger(), nullable=False),
        sa.Column("lv_version_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=250), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=True),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft','queued','sent','offers_received','completed','cancelled')",
            name=op.f("ck_procurement_inquiries_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["lv_document_id"],
            ["lv_documents.id"],
            name=op.f(
                "fk_procurement_inquiries_lv_document_id_lv_documents"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lv_version_id"],
            ["lv_versions.id"],
            name=op.f("fk_procurement_inquiries_lv_version_id_lv_versions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_procurement_inquiries"),
        ),
        sa.UniqueConstraint(
            "public_id",
            name=op.f("uq_procurement_inquiries_public_id"),
        ),
    )
    op.create_index(
        op.f("ix_procurement_inquiries_public_id"),
        "procurement_inquiries",
        ["public_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_procurement_inquiries_project_public_id"),
        "procurement_inquiries",
        ["project_public_id"],
        unique=False,
    )
    op.create_index(
        "ix_procurement_inquiries_document_status",
        "procurement_inquiries",
        ["lv_document_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_procurement_inquiries_project_created",
        "procurement_inquiries",
        ["project_public_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "procurement_inquiry_items",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("inquiry_id", sa.BigInteger(), nullable=False),
        sa.Column("lv_item_id", sa.BigInteger(), nullable=False),
        sa.Column("item_public_id_snapshot", sa.String(length=40), nullable=False),
        sa.Column("ordinal_number", sa.String(length=64), nullable=True),
        sa.Column("short_text", sa.String(length=500), nullable=True),
        sa.Column("long_text", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=18, scale=3), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["inquiry_id"],
            ["procurement_inquiries.id"],
            name=op.f(
                "fk_procurement_inquiry_items_inquiry_id_procurement_inquiries"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lv_item_id"],
            ["lv_items.id"],
            name=op.f(
                "fk_procurement_inquiry_items_lv_item_id_lv_items"
            ),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_procurement_inquiry_items"),
        ),
        sa.UniqueConstraint(
            "inquiry_id",
            "lv_item_id",
            name="uq_procurement_inquiry_items_inquiry_item",
        ),
    )

    op.create_table(
        "procurement_recipients",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("inquiry_id", sa.BigInteger(), nullable=False),
        sa.Column("external_company_id", sa.String(length=128), nullable=True),
        sa.Column("company_name", sa.String(length=250), nullable=False),
        sa.Column("contact_name", sa.String(length=250), nullable=True),
        sa.Column("contact_email", sa.String(length=320), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("distance_km", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column(
            "matched_services",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "match_reasons",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("queued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued','sent','responded','declined','failed')",
            name=op.f("ck_procurement_recipients_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["inquiry_id"],
            ["procurement_inquiries.id"],
            name=op.f(
                "fk_procurement_recipients_inquiry_id_procurement_inquiries"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_procurement_recipients"),
        ),
        sa.UniqueConstraint(
            "inquiry_id",
            "contact_email",
            name="uq_procurement_recipients_inquiry_email",
        ),
        sa.UniqueConstraint(
            "public_id",
            name=op.f("uq_procurement_recipients_public_id"),
        ),
    )
    op.create_index(
        op.f("ix_procurement_recipients_public_id"),
        "procurement_recipients",
        ["public_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_procurement_recipients_external_company_id"),
        "procurement_recipients",
        ["external_company_id"],
        unique=False,
    )
    op.create_index(
        "ix_procurement_recipients_inquiry_status",
        "procurement_recipients",
        ["inquiry_id", "status"],
        unique=False,
    )

    op.create_table(
        "procurement_offers",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.String(length=40), nullable=False),
        sa.Column("inquiry_id", sa.BigInteger(), nullable=False),
        sa.Column("recipient_id", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column(
            "total_amount",
            sa.Numeric(precision=18, scale=4),
            nullable=True,
        ),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("delivery_days", sa.Integer(), nullable=True),
        sa.Column("valid_until", sa.Date(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "line_items",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "attachment_manifest",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("llm_assessment", sa.JSON(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('received','reviewing','shortlisted','rejected','accepted')",
            name=op.f("ck_procurement_offers_status_allowed"),
        ),
        sa.ForeignKeyConstraint(
            ["inquiry_id"],
            ["procurement_inquiries.id"],
            name=op.f(
                "fk_procurement_offers_inquiry_id_procurement_inquiries"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"],
            ["procurement_recipients.id"],
            name=op.f(
                "fk_procurement_offers_recipient_id_procurement_recipients"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_procurement_offers"),
        ),
        sa.UniqueConstraint(
            "public_id",
            name=op.f("uq_procurement_offers_public_id"),
        ),
        sa.UniqueConstraint(
            "recipient_id",
            name="uq_procurement_offers_recipient",
        ),
    )
    op.create_index(
        op.f("ix_procurement_offers_public_id"),
        "procurement_offers",
        ["public_id"],
        unique=True,
    )
    op.create_index(
        "ix_procurement_offers_inquiry_status",
        "procurement_offers",
        ["inquiry_id", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_procurement_offers_inquiry_status",
        table_name="procurement_offers",
    )
    op.drop_index(
        op.f("ix_procurement_offers_public_id"),
        table_name="procurement_offers",
    )
    op.drop_table("procurement_offers")

    op.drop_index(
        "ix_procurement_recipients_inquiry_status",
        table_name="procurement_recipients",
    )
    op.drop_index(
        op.f("ix_procurement_recipients_external_company_id"),
        table_name="procurement_recipients",
    )
    op.drop_index(
        op.f("ix_procurement_recipients_public_id"),
        table_name="procurement_recipients",
    )
    op.drop_table("procurement_recipients")

    op.drop_table("procurement_inquiry_items")

    op.drop_index(
        "ix_procurement_inquiries_project_created",
        table_name="procurement_inquiries",
    )
    op.drop_index(
        "ix_procurement_inquiries_document_status",
        table_name="procurement_inquiries",
    )
    op.drop_index(
        op.f("ix_procurement_inquiries_project_public_id"),
        table_name="procurement_inquiries",
    )
    op.drop_index(
        op.f("ix_procurement_inquiries_public_id"),
        table_name="procurement_inquiries",
    )
    op.drop_table("procurement_inquiries")
