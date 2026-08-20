"""Central configuration for ``vectoplan-statik``."""

from __future__ import annotations

import os
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parent
TRUE_VALUES = {"1", "true", "yes", "on", "enabled"}


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
    SERVICE_NAME = "vectoplan-statik"
    SERVICE_DISPLAY_NAME = "VECTOPLAN Statik"
    SERVICE_VERSION = _env_text("VECTOPLAN_STATIK_VERSION", "0.2.0")
    CONTRACT_VERSION = "structural-model/0.1"
    ANALYSIS_CONTRACT_VERSION = "structural-analysis-request/0.1"
    ANALYSIS_JOB_CONTRACT_VERSION = "structural-analysis-job/0.2"
    ANALYSIS_RESULT_CONTRACT_VERSION = "structural-analysis-result/0.2"
    EXCHANGE_CONTRACT_VERSION = "vectoplan-structural-exchange/0.2"
    COMMAND_CONTRACT_VERSION = "structural-command/0.1"
    REPORT_CONTRACT_VERSION = "structural-report-request/0.1"

    HOST = _env_text("VECTOPLAN_STATIK_HOST", "0.0.0.0")
    PORT = _env_int("VECTOPLAN_STATIK_PORT", 5000)
    ROUTE_PREFIX = _env_text(
        "VECTOPLAN_STATIK_ROUTE_PREFIX", "/api/v1/statik"
    )
    LOG_LEVEL = _env_text("VECTOPLAN_STATIK_LOG_LEVEL", "INFO")
    FRAME_ANCESTORS = _env_text("VECTOPLAN_STATIK_FRAME_ANCESTORS", "'self'")

    MOCK_MODE = _env_bool("VECTOPLAN_STATIK_MOCK_MODE", True)
    STRICT_STARTUP = _env_bool("VECTOPLAN_STATIK_STRICT_STARTUP", False)

    # These values only describe future adapter targets. No client is created and
    # no network call is made while INTEGRATIONS_ENABLED remains false.
    INTEGRATIONS_ENABLED = _env_bool(
        "VECTOPLAN_STATIK_INTEGRATIONS_ENABLED", False
    )
    CORE_INTERNAL_URL = _env_text("VECTOPLAN_STATIK_CORE_INTERNAL_URL")
    CAD_INTERNAL_URL = _env_text("VECTOPLAN_STATIK_CAD_INTERNAL_URL")
    EDITOR_INTERNAL_URL = _env_text("VECTOPLAN_STATIK_EDITOR_INTERNAL_URL")
    LIBRARY_INTERNAL_URL = _env_text("VECTOPLAN_STATIK_LIBRARY_INTERNAL_URL")

    SAMPLE_MODEL_PATH = (
        SERVICE_ROOT / "static" / "statik" / "examples" / "sample_model.json"
    )
    PROFILE_CATALOG_PATH = SERVICE_ROOT / "src" / "profiles" / "catalog.json"
    CONTRACT_ROOT = SERVICE_ROOT / "src" / "contracts"

    JSON_SORT_KEYS = False
    DEBUG = False
    TESTING = False


class DevelopmentConfig(BaseConfig):
    DEBUG = _env_bool("VECTOPLAN_STATIK_DEBUG", True)


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    STRICT_STARTUP = True
    INTEGRATIONS_ENABLED = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    MOCK_MODE = _env_bool("VECTOPLAN_STATIK_MOCK_MODE", False)
    STRICT_STARTUP = _env_bool("VECTOPLAN_STATIK_STRICT_STARTUP", True)


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
        or os.getenv("VECTOPLAN_STATIK_CONFIG")
        or os.getenv("VECTOPLAN_STATIK_ENV")
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
