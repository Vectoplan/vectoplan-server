"""Central configuration for ``vectoplan-energie``."""

from __future__ import annotations

import os
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parent
TRUE_VALUES = {"1", "true", "yes", "on", "enabled", "ja"}


def _env_text(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


class BaseConfig:
    SERVICE_NAME = "vectoplan-energie"
    SERVICE_DISPLAY_NAME = "VECTOPLAN Energie"
    SERVICE_VERSION = _env_text("VECTOPLAN_ENERGIE_VERSION", "0.2.0")
    PROJECT_CONTRACT_VERSION = "energy-project/0.2"
    CALCULATION_CONTRACT_VERSION = "energy-calculation-request/0.2"
    CHANGE_SET_CONTRACT_VERSION = "energy-change-set/0.1"

    HOST = _env_text("VECTOPLAN_ENERGIE_HOST", "0.0.0.0")
    PORT = _env_int("VECTOPLAN_ENERGIE_PORT", 5000)
    ROUTE_PREFIX = _env_text("VECTOPLAN_ENERGIE_ROUTE_PREFIX", "/api/v1/energie")
    LOG_LEVEL = _env_text("VECTOPLAN_ENERGIE_LOG_LEVEL", "INFO")
    FRAME_ANCESTORS = _env_text("VECTOPLAN_ENERGIE_FRAME_ANCESTORS", "'self'")
    FRAME_SOURCES = _env_text(
        "VECTOPLAN_ENERGIE_FRAME_SOURCES",
        "'self' http://localhost:5100 http://127.0.0.1:5100 "
        "http://localhost:5104 http://127.0.0.1:5104",
    )
    CONNECT_SOURCES = _env_text(
        "VECTOPLAN_ENERGIE_CONNECT_SOURCES",
        "'self' http://localhost:5100 http://127.0.0.1:5100 "
        "http://localhost:5104 http://127.0.0.1:5104",
    )

    MOCK_MODE = _env_bool("VECTOPLAN_ENERGIE_MOCK_MODE", True)
    STRICT_STARTUP = _env_bool("VECTOPLAN_ENERGIE_STRICT_STARTUP", False)

    # Adapter targets only. No client is constructed and no request is made in
    # the standalone preparation stage.
    INTEGRATIONS_ENABLED = _env_bool("VECTOPLAN_ENERGIE_INTEGRATIONS_ENABLED", False)
    CORE_INTERNAL_URL = _env_text("VECTOPLAN_ENERGIE_CORE_INTERNAL_URL")
    CAD_INTERNAL_URL = _env_text("VECTOPLAN_ENERGIE_CAD_INTERNAL_URL")
    EDITOR_INTERNAL_URL = _env_text("VECTOPLAN_ENERGIE_EDITOR_INTERNAL_URL")
    LIBRARY_INTERNAL_URL = _env_text("VECTOPLAN_ENERGIE_LIBRARY_INTERNAL_URL")
    EDITOR_PUBLIC_URL = _env_text("VECTOPLAN_EDITOR_PUBLIC_URL", "http://127.0.0.1:5100")
    EDITOR_ENERGY_ROUTE = _env_text(
        "VECTOPLAN_ENERGIE_EDITOR_ROUTE",
        "/editor/test-generator",
    )
    CAD_PUBLIC_URL = _env_text("VECTOPLAN_CAD_PUBLIC_URL", "http://127.0.0.1:5104")
    CAD_ENERGY_ROUTE = _env_text("VECTOPLAN_ENERGIE_CAD_ROUTE", "/cad")

    SAMPLE_PROJECT_PATH = SERVICE_ROOT / "static" / "energie" / "examples" / "sample_project.json"
    MODULE_CATALOG_PATH = SERVICE_ROOT / "src" / "catalog" / "modules.json"
    CONTRACT_ROOT = SERVICE_ROOT / "src" / "contracts"
    DATASET_ROOT = SERVICE_ROOT / "static" / "energie" / "datasets"
    RULE_PROFILE_ROOT = SERVICE_ROOT / "src" / "standards"

    JSON_SORT_KEYS = False
    DEBUG = False
    TESTING = False


class DevelopmentConfig(BaseConfig):
    DEBUG = _env_bool("VECTOPLAN_ENERGIE_DEBUG", True)


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    STRICT_STARTUP = True
    INTEGRATIONS_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    MOCK_MODE = _env_bool("VECTOPLAN_ENERGIE_MOCK_MODE", False)
    STRICT_STARTUP = _env_bool("VECTOPLAN_ENERGIE_STRICT_STARTUP", True)


CONFIGS = {
    "base": BaseConfig,
    "default": DevelopmentConfig,
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def resolve_config(name: str | None = None) -> type:
    selected = (
        name
        or os.getenv("VECTOPLAN_ENERGIE_CONFIG")
        or os.getenv("VECTOPLAN_ENERGIE_ENV")
        or "development"
    )
    return CONFIGS.get(str(selected).strip().lower(), DevelopmentConfig)


__all__ = [
    "BaseConfig",
    "DevelopmentConfig",
    "ProductionConfig",
    "TestingConfig",
    "resolve_config",
]
