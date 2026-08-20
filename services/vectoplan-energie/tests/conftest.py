from __future__ import annotations

import sys
from pathlib import Path

import pytest


SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app import create_app  # noqa: E402


@pytest.fixture()
def app():
    return create_app("testing")


@pytest.fixture()
def client(app):
    return app.test_client()
