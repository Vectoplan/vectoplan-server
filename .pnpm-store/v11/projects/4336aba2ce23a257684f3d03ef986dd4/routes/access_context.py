"""Verified App -> Editor project access context.

Security-relevant query parameters are accepted only when they match a
short-lived HMAC ticket minted by vectoplan-app.  The ticket is exchanged for
an HttpOnly cookie so WebSocket and proxy requests share the same immutable
project/identity boundary.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.parse import urlencode

from flask import Response, current_app, g, jsonify, make_response, redirect, request


TICKET_QUERY_PARAM = "vp_access_ticket"
TICKET_COOKIE_NAME = "vp_editor_access"
TICKET_ISSUER = "vectoplan-app"
TICKET_AUDIENCE = "vectoplan-editor"
TICKET_VERSION = 1
MAX_CLOCK_SKEW_SECONDS = 30
MAX_TICKET_BYTES = 16 * 1024


class EditorAccessError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 403):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class EditorAccessContext:
    app_project_id: str
    chunk_project_id: str
    world_id: str
    universe_id: str
    auth_user_id: str
    auth_username: str
    role: str
    public: bool
    demo: bool
    read_only: bool
    can_view: bool
    can_edit: bool
    can_manage: bool
    can_command: bool
    can_materialize: bool
    ticket_id: str
    expires_at: int

    @classmethod
    def from_claims(cls, claims: Mapping[str, Any]) -> "EditorAccessContext":
        def text(name: str, maximum: int = 240) -> str:
            return str(claims.get(name) or "").strip()[:maximum]

        def flag(name: str) -> bool:
            return claims.get(name) is True

        context = cls(
            app_project_id=text("app_project_id"),
            chunk_project_id=text("chunk_project_id"),
            world_id=text("world_id"),
            universe_id=text("universe_id"),
            auth_user_id=text("auth_user_id", 180),
            auth_username=text("auth_username", 80),
            role=text("role", 40).lower(),
            public=flag("public"),
            demo=flag("demo"),
            read_only=flag("read_only"),
            can_view=flag("can_view"),
            can_edit=flag("can_edit"),
            can_manage=flag("can_manage"),
            can_command=flag("can_command"),
            can_materialize=flag("can_materialize"),
            ticket_id=text("jti", 180),
            expires_at=int(claims.get("exp") or 0),
        )
        if not context.app_project_id or not context.chunk_project_id or not context.world_id:
            raise EditorAccessError(
                "project_context_incomplete",
                "The signed project context is incomplete.",
            )
        if not context.can_view:
            raise EditorAccessError(
                "project_view_denied",
                "The signed project context does not allow viewing this project.",
            )
        if context.public and (not context.read_only or context.can_edit or context.can_command):
            raise EditorAccessError(
                "public_context_not_read_only",
                "Public project access must be read-only.",
            )
        if context.role == "viewer" and (not context.read_only or context.can_edit or context.can_command):
            raise EditorAccessError(
                "viewer_context_not_read_only",
                "Viewer project access must be read-only.",
            )
        if not context.public and not context.demo and not context.auth_user_id:
            raise EditorAccessError(
                "canonical_auth_user_id_required",
                "Authenticated project access requires a canonical auth user id.",
            )
        return context


def _config_value(name: str, default: Any = None) -> Any:
    try:
        value = current_app.config.get(name)
        if value not in {None, ""}:
            return value
    except Exception:
        pass
    return os.getenv(name, default)


def _config_bool(name: str, default: bool) -> bool:
    value = _config_value(name, default)
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on", "enabled"}


def _secret() -> bytes:
    value = _config_value("VECTOPLAN_EDITOR_ACCESS_TICKET_SECRET", "")
    if not value:
        value = _config_value("SECRET_KEY", "")
    encoded = str(value or "").encode("utf-8")
    if len(encoded) < 32:
        raise EditorAccessError(
            "access_ticket_not_configured",
            "Editor project access ticket verification is not configured.",
            503,
        )
    return encoded


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")



def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def verify_access_ticket(token: Any, *, now: int | None = None) -> EditorAccessContext:
    raw = str(token or "").strip()
    if not raw or len(raw.encode("utf-8")) > MAX_TICKET_BYTES:
        raise EditorAccessError("access_ticket_missing", "A project access ticket is required.", 401)
    try:
        encoded_payload, encoded_signature = raw.split(".", 1)
        expected = hmac.new(
            _secret(),
            encoded_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        supplied = _b64decode(encoded_signature)
        if not hmac.compare_digest(expected, supplied):
            raise EditorAccessError("access_ticket_invalid", "The project access ticket is invalid.")
        claims = json.loads(_b64decode(encoded_payload).decode("utf-8"))
    except EditorAccessError:
        raise
    except Exception as exc:
        raise EditorAccessError(
            "access_ticket_invalid",
            "The project access ticket is malformed.",
        ) from exc

    if not isinstance(claims, Mapping):
        raise EditorAccessError("access_ticket_invalid", "The project access ticket payload is invalid.")

    current_time = int(time.time() if now is None else now)
    try:
        issued_at = int(claims.get("iat") or 0)
        expires_at = int(claims.get("exp") or 0)
    except Exception as exc:
        raise EditorAccessError("access_ticket_invalid", "The project access ticket timestamps are invalid.") from exc

    if claims.get("v") != TICKET_VERSION:
        raise EditorAccessError("access_ticket_version_invalid", "Unsupported project access ticket version.")
    if claims.get("iss") != TICKET_ISSUER or claims.get("aud") != TICKET_AUDIENCE:
        raise EditorAccessError("access_ticket_scope_invalid", "The project access ticket has the wrong scope.")
    if issued_at > current_time + MAX_CLOCK_SKEW_SECONDS:
        raise EditorAccessError("access_ticket_not_yet_valid", "The project access ticket is not yet valid.")
    if expires_at <= current_time - MAX_CLOCK_SKEW_SECONDS:
        raise EditorAccessError("access_ticket_expired", "The project access ticket has expired.", 401)

    return EditorAccessContext.from_claims(claims)


def _ticket_cookie_name(chunk_project_id: str) -> str:
    project_id = str(chunk_project_id or "").strip()
    if not project_id:
        return TICKET_COOKIE_NAME
    digest = hashlib.sha256(project_id.encode("utf-8")).hexdigest()[:20]
    return f"{TICKET_COOKIE_NAME}_{digest}"


def get_request_access_context(
    *,
    required: bool = True,
    project_id_hint: str | None = None,
) -> EditorAccessContext | None:
    cached = getattr(g, "vectoplan_editor_access_context", None)
    if isinstance(cached, EditorAccessContext):
        return cached

    requested_project_id = (
        project_id_hint
        or (request.view_args or {}).get("project_id")
        or request.args.get("chunk_project_id")
        or request.args.get("chunkProjectId")
        or request.args.get("project_id")
        or request.args.get("projectId")
        or ""
    )
    token = request.args.get(TICKET_QUERY_PARAM) or request.cookies.get(
        _ticket_cookie_name(str(requested_project_id))
    )
    if not token:
        if required:
            raise EditorAccessError("access_ticket_missing", "A project access ticket is required.", 401)
        return None
    context = verify_access_ticket(token)
    g.vectoplan_editor_access_context = context
    return context


def _matching_query_value(context: EditorAccessContext, names: tuple[str, ...], expected: str) -> None:
    for name in names:
        value = request.args.get(name)
        if value not in {None, ""} and not hmac.compare_digest(str(value), expected):
            raise EditorAccessError(
                "project_context_mismatch",
                f"Query parameter {name!r} does not match the signed project context.",
            )


def assert_request_matches_context(context: EditorAccessContext) -> None:
    _matching_query_value(
        context,
        ("app_project_public_id", "appProjectPublicId", "app_project_id", "appProjectId", "project_public_id", "projectPublicId"),
        context.app_project_id,
    )
    _matching_query_value(
        context,
        ("chunk_project_id", "chunkProjectId", "project_id", "projectId"),
        context.chunk_project_id,
    )
    _matching_query_value(
        context,
        ("chunk_world_id", "chunkWorldId", "world_id", "worldId"),
        context.world_id,
    )



def _mint_session_ticket(context: EditorAccessContext) -> tuple[str, int]:
    now = int(time.time())
    try:
        configured_ttl = int(
            _config_value("VECTOPLAN_EDITOR_ACCESS_SESSION_TTL_SECONDS", 28_800)
        )
    except Exception:
        configured_ttl = 28_800
    ttl = max(300, min(configured_ttl, 43_200))
    payload = {
        "v": TICKET_VERSION,
        "iss": TICKET_ISSUER,
        "aud": TICKET_AUDIENCE,
        "iat": now,
        "exp": now + ttl,
        "jti": secrets.token_urlsafe(18),
        "kind": "editor_session",
        "workspace": "editor3d",
        "app_project_id": context.app_project_id,
        "chunk_project_id": context.chunk_project_id,
        "world_id": context.world_id,
        "universe_id": context.universe_id,
        "auth_user_id": context.auth_user_id,
        "auth_username": context.auth_username,
        "role": context.role,
        "public": context.public,
        "demo": context.demo,
        "read_only": context.read_only,
        "can_view": context.can_view,
        "can_edit": context.can_edit,
        "can_manage": context.can_manage,
        "can_command": context.can_command,
        "can_materialize": context.can_materialize,
    }
    encoded = _b64encode(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    signature = _b64encode(hmac.new(_secret(), encoded.encode("ascii"), hashlib.sha256).digest())
    return f"{encoded}.{signature}", ttl


def consume_access_ticket_redirect() -> Response | None:
    token = request.args.get(TICKET_QUERY_PARAM)
    if not token:
        return None
    context = verify_access_ticket(token)
    assert_request_matches_context(context)

    clean_items = [
        (key, value)
        for key, values in request.args.lists()
        if key != TICKET_QUERY_PARAM
        for value in values
    ]
    location = request.path
    if clean_items:
        location = f"{location}?{urlencode(clean_items, doseq=True)}"
    response = redirect(location, code=303)
    session_token, max_age = _mint_session_ticket(context)
    response.set_cookie(
        _ticket_cookie_name(context.chunk_project_id),
        session_token,
        max_age=max_age,
        httponly=True,
        secure=_config_bool("VECTOPLAN_EDITOR_ACCESS_COOKIE_SECURE", False),
        samesite="Lax",
        path="/editor",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def require_project_access(
    *,
    project_id: str | None = None,
    world_id: str | None = None,
    capability: str = "view",
) -> EditorAccessContext:
    context = get_request_access_context(required=True, project_id_hint=project_id)
    assert context is not None
    if project_id and not hmac.compare_digest(str(project_id), context.chunk_project_id):
        raise EditorAccessError("project_context_mismatch", "The requested Chunk project is not authorized.")
    if world_id and not hmac.compare_digest(str(world_id), context.world_id):
        raise EditorAccessError("world_context_mismatch", "The requested Chunk world is not authorized.")

    allowed = {
        "view": context.can_view,
        "edit": context.can_edit and not context.read_only,
        "manage": context.can_manage and not context.read_only,
        "command": context.can_command and not context.read_only,
        "materialize": context.can_materialize and not context.read_only,
    }.get(capability, False)
    if not allowed:
        raise EditorAccessError(
            "project_capability_denied",
            f"The signed project context does not allow capability {capability!r}.",
        )
    return context


def access_error_response(error: EditorAccessError) -> Response:
    response = make_response(
        jsonify(
            {
                "ok": False,
                "error": {
                    "code": error.code,
                    "message": str(error),
                },
            }
        ),
        error.status_code,
    )
    response.headers["Cache-Control"] = "no-store"
    return response


def trusted_chunk_headers() -> dict[str, str]:
    context = get_request_access_context(required=True)
    assert context is not None
    headers = {
        "X-Vectoplan-App-Project-Id": context.app_project_id,
        "X-Vectoplan-Chunk-Project-Id": context.chunk_project_id,
        "X-Vectoplan-World-Id": context.world_id,
        "X-Vectoplan-Project-Role": context.role,
        "X-Vectoplan-Can-Materialize": "1" if context.can_materialize else "0",
        "X-Vectoplan-Public-Access": "1" if context.public else "0",
        "X-Vectoplan-Public-Read-Only-Verified": "1" if context.public else "0",
    }
    if context.auth_user_id:
        headers["X-Vectoplan-Auth-User-Id"] = context.auth_user_id
    return headers


__all__ = [
    "EditorAccessContext",
    "EditorAccessError",
    "access_error_response",
    "assert_request_matches_context",
    "consume_access_ticket_redirect",
    "get_request_access_context",
    "require_project_access",
    "trusted_chunk_headers",
    "verify_access_ticket",
]
