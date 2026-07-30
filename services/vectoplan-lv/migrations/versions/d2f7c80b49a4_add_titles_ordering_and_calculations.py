"""add title hierarchy, persistent ordering and calculation rows

Revision ID: d2f7c80b49a4
Revises: c8e4a62f15d1
Create Date: 2026-07-29 16:40:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d2f7c80b49a4"
down_revision: Union[str, None] = "c8e4a62f15d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("lv_items") as batch_op:
        batch_op.add_column(
            sa.Column("parent_item_id", sa.BigInteger(), nullable=True)
        )
        batch_op.drop_constraint(
            "item_type_allowed",
            type_="check",
        )
        batch_op.create_check_constraint(
            "item_type_allowed",
            "item_type IN ('position','text','title')",
        )
        batch_op.create_foreign_key(
            "fk_lv_items_parent_item_id_lv_items",
            "lv_items",
            ["parent_item_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_lv_items_parent_sort",
            ["parent_item_id", "sort_order"],
            unique=False,
        )

    with op.batch_alter_table("billing_entries") as batch_op:
        batch_op.add_column(
            sa.Column(
                "calculation_rows",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "calculation_total",
                sa.Numeric(precision=18, scale=3),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("billing_entries") as batch_op:
        batch_op.drop_column("calculation_total")
        batch_op.drop_column("calculation_rows")

    with op.batch_alter_table("lv_items") as batch_op:
        batch_op.drop_index("ix_lv_items_parent_sort")
        batch_op.drop_constraint(
            "fk_lv_items_parent_item_id_lv_items",
            type_="foreignkey",
        )
        batch_op.drop_constraint(
            "item_type_allowed",
            type_="check",
        )
        batch_op.create_check_constraint(
            "item_type_allowed",
            "item_type IN ('position','text')",
        )
        batch_op.drop_column("parent_item_id")
