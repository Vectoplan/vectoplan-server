"""Shared Flask extensions used by the LV service."""

from __future__ import annotations

from pathlib import Path

from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

db = SQLAlchemy(
    metadata=MetaData(naming_convention=NAMING_CONVENTION),
    session_options={"expire_on_commit": False},
)
migrate = Migrate(compare_type=True)


def init_extensions(app: Flask) -> None:
    db.init_app(app)

    # Importing the package registers all model metadata before Alembic starts.
    import models  # noqa: F401

    migrate.init_app(
        app,
        db,
        directory=str(Path(__file__).resolve().parent / "migrations"),
    )

    registry = app.extensions.setdefault("vectoplan_lv", {})
    registry["database"] = {"initialized": True}
    registry["migrations"] = {"initialized": True}
    registry["models"] = sorted(db.metadata.tables)


__all__ = ["db", "migrate", "init_extensions"]
