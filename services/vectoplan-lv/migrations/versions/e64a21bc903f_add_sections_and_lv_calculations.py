"""add section hierarchy and LV calculation metadata

Revision ID: e64a21bc903f
Revises: d2f7c80b49a4
Create Date: 2026-07-29 18:20:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e64a21bc903f"
down_revision: Union[str, None] = "d2f7c80b49a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("lv_items") as batch_op:
        batch_op.drop_constraint("item_type_allowed", type_="check")
        batch_op.create_check_constraint(
            "item_type_allowed",
            "item_type IN ('position','text','title','section')",
        )
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
        batch_op.add_column(
            sa.Column("calculation_note", sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "calculation_attachment_manifest",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("lv_items") as batch_op:
        batch_op.drop_column("calculation_attachment_manifest")
        batch_op.drop_column("calculation_note")
        batch_op.drop_column("calculation_total")
        batch_op.drop_column("calculation_rows")
        batch_op.drop_constraint("item_type_allowed", type_="check")
        batch_op.create_check_constraint(
            "item_type_allowed",
            "item_type IN ('position','text','title')",
        )
