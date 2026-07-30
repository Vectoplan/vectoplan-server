"""Central configuration for ``vectoplan-lv``."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SERVICE_ROOT = Path(__file__).resolve().parent
TRUE_VALUES = {"1", "true", "yes", "on", "enabled"}


def _env_text(name: str, default: str) -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in TRUE_VALUES


def _env_int(name: str, default: int, minimum: int = 0) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def _database_url() -> str:
    value = _env_text(
        "VECTOPLAN_LV_DATABASE_URL",
        "postgresql+psycopg://vectoplan:password@vectoplan-lv-db:5432/vectoplan_lv",
    )
    # SQLAlchemy no longer accepts the legacy Heroku-style scheme.
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value.removeprefix("postgres://")
    return value


class BaseConfig:
    SERVICE_NAME = "vectoplan-lv"
    SERVICE_DISPLAY_NAME = "VECTOPLAN Leistungsverzeichnis"
    SERVICE_VERSION = _env_text("VECTOPLAN_LV_VERSION", "0.1.0")
    VECTOPLAN_EXTENSION_NAMESPACE = "vectoplan_lv"

    ENV = _env_text("VECTOPLAN_LV_ENV", "development").lower()
    DEBUG = False
    TESTING = False
    HOST = _env_text("VECTOPLAN_LV_HOST", "0.0.0.0")
    PORT = _env_int("VECTOPLAN_LV_PORT", 5000, minimum=1)
    LOG_LEVEL = _env_text("VECTOPLAN_LV_LOG_LEVEL", "INFO")

    SECRET_KEY = _env_text("VECTOPLAN_LV_SECRET_KEY", "development-only-change-me")
    PUBLIC_URL = _env_text("VECTOPLAN_LV_PUBLIC_URL", "http://localhost:5105").rstrip("/")
    INTERNAL_URL = _env_text(
        "VECTOPLAN_LV_INTERNAL_URL", "http://vectoplan-lv:5000"
    ).rstrip("/")
    PORTAL_PUBLIC_URL = _env_text(
        "VECTOPLAN_APP_PUBLIC_URL", "http://localhost:5103"
    ).rstrip("/")

    FRAME_ANCESTORS = _env_text(
        "VECTOPLAN_LV_FRAME_ANCESTORS",
        (
            f"{PORTAL_PUBLIC_URL} http://127.0.0.1:5103 "
            "http://localhost:5200 http://127.0.0.1:5200"
        ),
    )

    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    STORAGE_PROVIDER = _env_text("VECTOPLAN_LV_STORAGE_PROVIDER", "local").lower()
    STORAGE_ROOT = Path(
        _env_text("VECTOPLAN_LV_STORAGE_ROOT", str(SERVICE_ROOT / "var" / "storage"))
    )
    MAX_UPLOAD_MB = _env_int("VECTOPLAN_LV_MAX_UPLOAD_MB", 100, minimum=1)
    MAX_GAEB_EMBEDDED_ATTACHMENT_MB = _env_int(
        "VECTOPLAN_LV_MAX_GAEB_EMBEDDED_ATTACHMENT_MB", 50, minimum=1
    )
    MAX_CONTENT_LENGTH = MAX_UPLOAD_MB * 1024 * 1024
    GAEB_DEFAULT_VERSION = _env_text("VECTOPLAN_LV_GAEB_DEFAULT_VERSION", "3.3")

    LIBRARY_ENABLED = _env_bool("VECTOPLAN_LV_LIBRARY_ENABLED", False)
    DOCUMENT_ANALYSIS_ENABLED = _env_bool(
        "VECTOPLAN_LV_DOCUMENT_ANALYSIS_ENABLED", False
    )
    NEXTCLOUD_ENABLED = _env_bool("VECTOPLAN_LV_NEXTCLOUD_ENABLED", False)

    STARTUP_CHECKS_ENABLED = _env_bool(
        "VECTOPLAN_LV_STARTUP_CHECKS_ENABLED", True
    )
    STARTUP_STRICT = _env_bool("VECTOPLAN_LV_STARTUP_STRICT", False)
    READINESS_CHECK_DATABASE = _env_bool(
        "VECTOPLAN_LV_READINESS_CHECK_DATABASE", True
    )
    READINESS_CHECK_STORAGE = _env_bool(
        "VECTOPLAN_LV_READINESS_CHECK_STORAGE", True
    )

    @classmethod
    def validate(cls) -> list[str]:
        issues: list[str] = []
        if not cls.SQLALCHEMY_DATABASE_URI:
            issues.append("VECTOPLAN_LV_DATABASE_URL is empty")
        if cls.STORAGE_PROVIDER not in {"local", "null"}:
            issues.append(
                "VECTOPLAN_LV_STORAGE_PROVIDER must currently be 'local' or 'null'"
            )
        if urlparse(cls.PUBLIC_URL).hostname in {"vectoplan-lv", "vectoplan-lv-db"}:
            issues.append("PUBLIC_URL must not expose a Docker-internal hostname")
        if cls.NEXTCLOUD_ENABLED:
            issues.append("Nextcloud is only a placeholder and cannot be enabled yet")
        return issues


class DevelopmentConfig(BaseConfig):
    DEBUG = _env_bool("VECTOPLAN_LV_DEBUG", True)


class TestingConfig(BaseConfig):
    ENV = "testing"
    TESTING = True
    DEBUG = False
    SECRET_KEY = "testing"
    SQLALCHEMY_DATABASE_URI = "sqlite+pysqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS: dict[str, Any] = {}
    STORAGE_PROVIDER = "null"
    READINESS_CHECK_STORAGE = False
    STARTUP_STRICT = True


class ProductionConfig(BaseConfig):
    ENV = "production"
    DEBUG = False
    STARTUP_STRICT = True

    @classmethod
    def validate(cls) -> list[str]:
        issues = super().validate()
        if not cls.SQLALCHEMY_DATABASE_URI.startswith("postgresql"):
            issues.append("Production requires PostgreSQL")
        if cls.SECRET_KEY == "development-only-change-me":
            issues.append("VECTOPLAN_LV_SECRET_KEY must be changed in production")
        return issues


CONFIGS = {
    "base": BaseConfig,
    "default": DevelopmentConfig,
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config_class(config_object: type | str | None = None) -> type:
    if isinstance(config_object, type):
        return config_object

    name = (
        config_object
        or os.getenv("VECTOPLAN_LV_CONFIG")
        or os.getenv("VECTOPLAN_LV_ENV")
        or "development"
    )
    return CONFIGS.get(str(name).strip().lower(), DevelopmentConfig)


Config = DevelopmentConfig


__all__ = [
    "BaseConfig",
    "Config",
    "DevelopmentConfig",
    "ProductionConfig",
    "TestingConfig",
    "get_config_class",
]
