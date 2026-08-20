"""Gunicorn entry point for ``vectoplan-energie``."""

from app import create_app


app = create_app()
application = app


__all__ = ["app", "application"]
