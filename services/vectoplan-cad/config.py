from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def _bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


class BaseConfig:
    SERVICE_NAME = "vectoplan-cad"
    SERVICE_VERSION = "0.4.0"
    CONTRACT_VERSION = "cad-projection/0.1"

    HOST = os.getenv("VECTOPLAN_CAD_HOST", "0.0.0.0")
    PORT = _int("VECTOPLAN_CAD_PORT", 5000)
    ROUTE_PREFIX = os.getenv("VECTOPLAN_CAD_ROUTE_PREFIX", "/api/v1/cad")
    MOCK_MODE = _bool("VECTOPLAN_CAD_MOCK_MODE", True)
    STRICT_STARTUP = _bool("VECTOPLAN_CAD_STRICT_STARTUP", False)

    CORE_INTERNAL_URL = os.getenv("VECTOPLAN_CAD_CORE_INTERNAL_URL", "")
    CORE_PUBLIC_URL = os.getenv("VECTOPLAN_CAD_CORE_PUBLIC_URL", "")
    CORE_SERVICE_API_KEY = os.getenv("VECTOPLAN_CAD_CORE_SERVICE_API_KEY", "")
    CORE_TIMEOUT_SECONDS = _int("VECTOPLAN_CAD_CORE_TIMEOUT_SECONDS", 45)

    LIBRARY_INTERNAL_URL = os.getenv("VECTOPLAN_CAD_LIBRARY_INTERNAL_URL", "")
    LIBRARY_PUBLIC_URL = os.getenv("VECTOPLAN_CAD_LIBRARY_PUBLIC_URL", "")
    LIBRARY_INVENTORY_PATH = os.getenv(
        "VECTOPLAN_CAD_LIBRARY_INVENTORY_PATH",
        "/api/v1/vplib/creative-library/inventory",
    )
    LIBRARY_SERVICE_API_KEY = os.getenv("VECTOPLAN_CAD_LIBRARY_SERVICE_API_KEY", "")
    LIBRARY_TIMEOUT_SECONDS = _int("VECTOPLAN_CAD_LIBRARY_TIMEOUT_SECONDS", 15)

    TEST_INPUT_PATH = ROOT / "static" / "cad" / "examples" / "test_input.json"
    PLAN_PROFILE_PATH = ROOT / "src" / "profiles" / "catalog.json"
    PLAN_RULES_PATH = ROOT / "src" / "plans" / "catalog.json"
    CONTRACT_SCHEMA_PATH = ROOT / "src" / "contracts" / "cad_projection_input.schema.json"
    COMMAND_SCHEMA_PATH = ROOT / "src" / "contracts" / "cad_command.schema.json"
    EXPORT_SCHEMA_PATH = ROOT / "src" / "contracts" / "export_request.schema.json"
    LIBRARY_FALLBACK_CATALOG_PATH = ROOT / "src" / "library" / "fallback_catalog.json"

    JSON_SORT_KEYS = False
    LOG_LEVEL = os.getenv("VECTOPLAN_CAD_LOG_LEVEL", "INFO")
    DEBUG = False
    TESTING = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False


class ProductionConfig(BaseConfig):
    MOCK_MODE = _bool("VECTOPLAN_CAD_MOCK_MODE", False)
    STRICT_STARTUP = _bool("VECTOPLAN_CAD_STRICT_STARTUP", True)


CONFIGS = {
    "default": BaseConfig,
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def resolve_config(name: str | None):
    selected = (name or os.getenv("VECTOPLAN_CAD_CONFIG") or "default").strip().lower()
    return CONFIGS.get(selected, BaseConfig)
