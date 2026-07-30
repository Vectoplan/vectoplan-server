"""add current-version foreign-key constraints

Revision ID: b7d1f42c8a63
Revises: 9ab0a2dea4dd
Create Date: 2026-07-29 13:08:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b7d1f42c8a63"
down_revision: Union[str, None] = "9ab0a2dea4dd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite has to render use_alter constraints inline because it cannot add
    # foreign keys later. PostgreSQL omits them from the first CREATE TABLE and
    # receives them here after both aggregate tables exist.
    if op.get_bind().dialect.name == "sqlite":
        return

    op.create_foreign_key(
        "fk_lv_documents_current_draft_version_id_lv_versions",
        "lv_documents",
        "lv_versions",
        ["current_draft_version_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_lv_documents_current_contract_version_id_lv_versions",
        "lv_documents",
        "lv_versions",
        ["current_contract_version_id"],
        ["id"],
    )


def downgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        return

    op.drop_constraint(
        "fk_lv_documents_current_contract_version_id_lv_versions",
        "lv_documents",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_lv_documents_current_draft_version_id_lv_versions",
        "lv_documents",
        type_="foreignkey",
    )
