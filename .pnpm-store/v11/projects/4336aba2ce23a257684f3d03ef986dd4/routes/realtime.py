# services/vectoplan-editor/routes/realtime.py
from __future__ import annotations

import hashlib
import json
import math
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Final, Mapping

from flask import Blueprint, Flask, Response, jsonify, request


REALTIME_ROUTE_MODULE_VERSION: Final[str] = "0.1.0"
REALTIME_SOCKET_PATH: Final[str] = "/editor/realtime"
REALTIME_STATUS_PATH: Final[str] = "/editor/api/realtime/_status"
MAX_MESSAGE_BYTES: Final[int] = 32 * 1024
MAX_REMOTE_PLAYERS_PER_ROOM: Final[int] = 64
MAX_DISPLAY_NAME_LENGTH: Final[int] = 48
MAX_ID_LENGTH: Final[int] = 180
MAX_POSITION_ABS: Final[float] = 10_000_000.0
MAX_VELOCITY_ABS: Final[float] = 10_000.0

_SAFE_ID_RE: Final[re.Pattern[str]] = re.compile(r"[^A-Za-z0-9_.:-]+")

realtime_bp = Blueprint("editor_realtime", __name__, url_prefix="/editor/api/realtime")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _safe_text(value: Any, fallback: str, *, maximum: int) -> str:
    try:
        text = str(value).strip()
    except Exception:
        text = ""

    if not text:
        text = fallback

    return text[:maximum]


def _safe_id(value: Any, fallback: str) -> str:
    normalized = _SAFE_ID_RE.sub("_", _safe_text(value, fallback, maximum=MAX_ID_LENGTH))
    normalized = normalized.strip("._:-")
    return normalized[:MAX_ID_LENGTH] or fallback


def _safe_number(value: Any, fallback: float, *, limit: float) -> float:
    try:
        result = float(value)
    except Exception:
        return fallback

    if not math.isfinite(result):
        return fallback

    return max(-limit, min(limit, result))


def _safe_vector(value: Any, *, limit: float) -> dict[str, float]:
    source = value if isinstance(value, Mapping) else {}
    return {
        "x": _safe_number(source.get("x"), 0.0, limit=limit),
        "y": _safe_number(source.get("y"), 0.0, limit=limit),
        "z": _safe_number(source.get("z"), 0.0, limit=limit),
    }


def _safe_held_item(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, Mapping):
        return None

    kind = _safe_text(value.get("kind"), "block", maximum=32)
    if kind not in {"block", "vplib", "library-item", "asset"}:
        kind = "block"

    model_url = _safe_text(value.get("modelUrl"), "", maximum=1024)
    if model_url and not model_url.startswith(("/", "http://", "https://")):
        model_url = ""

    return {
        "id": _safe_id(value.get("id"), "held-item"),
        "label": _safe_text(value.get("label"), "Objekt", maximum=96),
        "kind": kind,
        "color": _safe_text(value.get("color"), "#68a38a", maximum=64),
        "modelUrl": model_url or None,
    }


def _safe_string_list(value: Any, *, maximum: int = 256) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []

    result: list[str] = []
    seen: set[str] = set()
    for item in value[:maximum]:
        normalized = _safe_id(item, "")
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def _avatar_color(user_id: str) -> str:
    digest = hashlib.sha256(user_id.encode("utf-8", errors="ignore")).hexdigest()
    hue = int(digest[:6], 16) % 360
    saturation = 58 + (int(digest[6:8], 16) % 18)
    lightness = 50 + (int(digest[8:10], 16) % 12)
    return f"hsl({hue}, {saturation}%, {lightness}%)"


def _json_message(message_type: str, **payload: Any) -> str:
    return json.dumps(
        {
            "type": message_type,
            "serverTimeMs": _now_ms(),
            **payload,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


@dataclass(slots=True)
class RealtimePeer:
    session_id: str
    room_id: str
    project_id: str
    world_id: str
    user_id: str
    display_name: str
    avatar_color: str
    can_command: bool
    socket: Any = field(repr=False)
    connected_at_ms: int = field(default_factory=_now_ms)
    last_seen_at_ms: int = field(default_factory=_now_ms)
    last_sequence: int = -1
    last_state: dict[str, Any] | None = None
    send_lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def send(self, message: str) -> None:
        with self.send_lock:
            self.socket.send(message)

    def public_member(self) -> dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "userId": self.user_id,
            "displayName": self.display_name,
            "avatarColor": self.avatar_color,
            "projectId": self.project_id,
            "worldId": self.world_id,
            "connectedAtMs": self.connected_at_ms,
            "state": self.last_state,
        }


class RealtimeHub:
    """Process-local room hub for ephemeral presence and invalidation hints."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._rooms: dict[str, dict[str, RealtimePeer]] = {}

    def join(self, peer: RealtimePeer) -> tuple[list[dict[str, Any]], bool]:
        with self._lock:
            room = self._rooms.setdefault(peer.room_id, {})
            if peer.session_id not in room and len(room) >= MAX_REMOTE_PLAYERS_PER_ROOM:
                return [], False

            existing = [
                item.public_member()
                for session_id, item in room.items()
                if session_id != peer.session_id
            ]
            room[peer.session_id] = peer
            return existing, True

    def leave(self, peer: RealtimePeer) -> None:
        with self._lock:
            room = self._rooms.get(peer.room_id)
            if room is None:
                return

            if room.get(peer.session_id) is peer:
                room.pop(peer.session_id, None)
            if not room:
                self._rooms.pop(peer.room_id, None)

    def peers(self, room_id: str, *, exclude_session_id: str | None = None) -> list[RealtimePeer]:
        with self._lock:
            room = self._rooms.get(room_id, {})
            return [
                peer
                for session_id, peer in room.items()
                if session_id != exclude_session_id
            ]

    def broadcast(
        self,
        room_id: str,
        message: str,
        *,
        exclude_session_id: str | None = None,
    ) -> None:
        failed: list[RealtimePeer] = []
        for peer in self.peers(room_id, exclude_session_id=exclude_session_id):
            try:
                peer.send(message)
            except Exception:
                failed.append(peer)

        for peer in failed:
            self.leave(peer)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            rooms = {
                room_id: {
                    "connectionCount": len(peers),
                    "projectId": next(iter(peers.values())).project_id if peers else None,
                    "worldId": next(iter(peers.values())).world_id if peers else None,
                }
                for room_id, peers in self._rooms.items()
            }
            return {
                "roomCount": len(rooms),
                "connectionCount": sum(item["connectionCount"] for item in rooms.values()),
                "rooms": rooms,
            }


_HUB = RealtimeHub()


def _peer_from_request(socket: Any) -> RealtimePeer:
    from routes.access_context import require_project_access

    requested_project_id = request.args.get("projectId") or request.args.get("project_id")
    requested_world_id = request.args.get("worldId") or request.args.get("world_id")
    access = require_project_access(
        project_id=str(requested_project_id or "") or None,
        world_id=str(requested_world_id or "") or None,
        capability="view",
    )
    project_id = access.chunk_project_id
    world_id = access.world_id
    generated_suffix = uuid.uuid4().hex[:8]

    if access.public or access.demo or not access.auth_user_id:
        guest_digest = hashlib.sha256(access.ticket_id.encode("utf-8")).hexdigest()[:20]
        user_id = f"guest_{guest_digest}"
        display_name = "Gast"
    else:
        user_id = _safe_id(access.auth_user_id, f"editor_user_{generated_suffix}")
        display_name = _safe_text(access.auth_username, "Gast", maximum=48)

    session_id = _safe_id(
        f"session_{user_id}_{uuid.uuid4().hex[:12]}",
        f"session_{uuid.uuid4().hex[:20]}",
    )

    return RealtimePeer(
        session_id=session_id,
        room_id=f"{project_id}:{world_id}",
        project_id=project_id,
        world_id=world_id,
        user_id=user_id,
        display_name=display_name,
        avatar_color=_avatar_color(user_id),
        can_command=bool(access.can_command and not access.read_only),
        socket=socket,
    )


def _parse_message(raw: Any) -> dict[str, Any] | None:
    if isinstance(raw, bytes):
        if len(raw) > MAX_MESSAGE_BYTES:
            return None
        try:
            raw = raw.decode("utf-8")
        except Exception:
            return None

    if not isinstance(raw, str) or len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
        return None

    try:
        parsed = json.loads(raw)
    except Exception:
        return None

    return dict(parsed) if isinstance(parsed, Mapping) else None


def _presence_payload(peer: RealtimePeer, message: Mapping[str, Any]) -> dict[str, Any] | None:
    try:
        sequence = int(message.get("sequence", -1))
    except Exception:
        sequence = -1

    if sequence <= peer.last_sequence:
        return None

    peer.last_sequence = sequence
    peer.last_seen_at_ms = _now_ms()

    movement_mode = _safe_text(message.get("movementMode"), "airborne", maximum=16)
    if movement_mode not in {"grounded", "airborne", "flying"}:
        movement_mode = "airborne"

    payload = {
        "sessionId": peer.session_id,
        "userId": peer.user_id,
        "displayName": peer.display_name,
        "avatarColor": peer.avatar_color,
        "sequence": sequence,
        "clientTimeMs": int(
            _safe_number(message.get("clientTimeMs"), _now_ms(), limit=9_000_000_000_000)
        ),
        "position": _safe_vector(message.get("position"), limit=MAX_POSITION_ABS),
        "velocity": _safe_vector(message.get("velocity"), limit=MAX_VELOCITY_ABS),
        "yaw": _safe_number(message.get("yaw"), 0.0, limit=math.pi * 8),
        "pitch": _safe_number(message.get("pitch"), 0.0, limit=math.pi),
        "movementMode": movement_mode,
        "grounded": bool(message.get("grounded", movement_mode == "grounded")),
        "flying": bool(message.get("flying", movement_mode == "flying")),
        "heldItem": _safe_held_item(message.get("heldItem")),
    }
    peer.last_state = payload
    return payload


def _world_invalidation_payload(peer: RealtimePeer, message: Mapping[str, Any]) -> dict[str, Any]:
    raw_versions = message.get("chunkVersions")
    chunk_versions = {
        _safe_id(key, ""): _safe_text(value, "", maximum=128)
        for key, value in raw_versions.items()
        if _safe_id(key, "") and _safe_text(value, "", maximum=128)
    } if isinstance(raw_versions, Mapping) else {}

    return {
        "sessionId": peer.session_id,
        "userId": peer.user_id,
        "commandType": _safe_text(message.get("commandType"), "unknown", maximum=64),
        "eventIds": _safe_string_list(message.get("eventIds")),
        "changedChunks": _safe_string_list(message.get("changedChunks")),
        "dirtyChunks": _safe_string_list(message.get("dirtyChunks")),
        "chunkVersions": chunk_versions,
    }


def _handle_socket(socket: Any) -> None:
    from routes.access_context import EditorAccessError

    try:
        peer = _peer_from_request(socket)
    except EditorAccessError as exc:
        socket.send(
            _json_message(
                "error",
                code=exc.code,
                message=str(exc),
            )
        )
        return
    existing_members, accepted = _HUB.join(peer)

    if not accepted:
        peer.send(
            _json_message(
                "error",
                code="room_full",
                message="Der Realtime-Raum hat seine maximale Teilnehmerzahl erreicht.",
            )
        )
        return

    peer.send(
        _json_message(
            "session.welcome",
            session=peer.public_member(),
            roomId=peer.room_id,
            members=existing_members,
            transport="websocket",
            updateRateHz=12,
            interpolationMs=120,
        )
    )
    _HUB.broadcast(
        peer.room_id,
        _json_message("member.joined", member=peer.public_member()),
        exclude_session_id=peer.session_id,
    )

    try:
        while True:
            raw = socket.receive()
            if raw is None:
                break

            message = _parse_message(raw)
            if message is None:
                peer.send(
                    _json_message(
                        "error",
                        code="invalid_message",
                        message="Realtime-Nachricht ist kein gültiges JSON-Objekt.",
                    )
                )
                continue

            message_type = _safe_text(message.get("type"), "", maximum=64)
            if message_type == "ping":
                peer.last_seen_at_ms = _now_ms()
                peer.send(_json_message("pong", clientTimeMs=message.get("clientTimeMs")))
                continue

            if message_type == "presence.state":
                payload = _presence_payload(peer, message)
                if payload is not None:
                    _HUB.broadcast(
                        peer.room_id,
                        _json_message("presence.state", state=payload),
                        exclude_session_id=peer.session_id,
                    )
                continue

            if message_type == "world.invalidate":
                if not peer.can_command:
                    peer.send(
                        _json_message(
                            "error",
                            code="project_capability_denied",
                            message="Dieser Projektzugriff erlaubt keine Aenderungen.",
                        )
                    )
                    continue

                _HUB.broadcast(
                    peer.room_id,
                    _json_message(
                        "world.invalidate",
                        invalidation=_world_invalidation_payload(peer, message),
                    ),
                    exclude_session_id=peer.session_id,
                )
                continue

            peer.send(
                _json_message(
                    "error",
                    code="unsupported_message_type",
                    message=f"Realtime-Nachrichtentyp wird nicht unterstützt: {message_type or 'leer'}",
                )
            )
    finally:
        _HUB.leave(peer)
        _HUB.broadcast(
            peer.room_id,
            _json_message(
                "member.left",
                sessionId=peer.session_id,
                userId=peer.user_id,
            ),
            exclude_session_id=peer.session_id,
        )


def init_realtime_socket(app: Flask) -> None:
    namespace = app.extensions.setdefault("vectoplan_editor", {})
    if namespace.get("realtime_socket_initialized"):
        return

    try:
        from flask_sock import Sock
    except Exception as exc:
        raise RuntimeError(
            "Realtime benötigt flask-sock. Installiere die Abhängigkeiten aus requirements.txt."
        ) from exc

    app.config.setdefault(
        "SOCK_SERVER_OPTIONS",
        {
            "ping_interval": 25,
            "max_message_size": MAX_MESSAGE_BYTES,
        },
    )
    sock = Sock(app)
    sock.route(REALTIME_SOCKET_PATH)(_handle_socket)
    namespace["realtime_sock"] = sock
    namespace["realtime_socket_initialized"] = True
    namespace["realtime_socket_path"] = REALTIME_SOCKET_PATH
    namespace["realtime_backend"] = "process-memory"
    namespace["realtime_multi_process_safe"] = False


@realtime_bp.get("/_status")
def realtime_status() -> Response:
    snapshot = _HUB.snapshot()
    snapshot.pop("rooms", None)
    return jsonify(
        {
            "ok": True,
            "service": "vectoplan-editor",
            "moduleVersion": REALTIME_ROUTE_MODULE_VERSION,
            "socketPath": REALTIME_SOCKET_PATH,
            "backend": "process-memory",
            "multiProcessSafe": False,
            "maxRemotePlayersPerRoom": MAX_REMOTE_PLAYERS_PER_ROOM,
            **snapshot,
        }
    )


__all__ = [
    "REALTIME_SOCKET_PATH",
    "REALTIME_STATUS_PATH",
    "init_realtime_socket",
    "realtime_bp",
]
