export type RealtimeConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "destroyed";

export type RealtimeMovementMode = "grounded" | "airborne" | "flying";

export interface RealtimeVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RealtimeHeldItem {
  readonly id: string;
  readonly label: string;
  readonly kind: "block" | "vplib" | "library-item" | "asset";
  readonly color: string;
  readonly modelUrl: string | null;
  readonly textureUrl: string | null;
  readonly textureKey: string | null;
  readonly roughness: number;
  readonly metalness: number;
}

export interface RealtimePresenceState {
  readonly sessionId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly avatarColor: string;
  readonly sequence: number;
  readonly clientTimeMs: number;
  readonly position: RealtimeVector3;
  readonly velocity: RealtimeVector3;
  readonly yaw: number;
  readonly pitch: number;
  readonly movementMode: RealtimeMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly heldItem: RealtimeHeldItem | null;
}

export interface RealtimeMember {
  readonly sessionId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly avatarColor: string;
  readonly projectId: string;
  readonly worldId: string;
  readonly connectedAtMs: number;
  readonly state?: RealtimePresenceState | null;
}

export interface RealtimeWorldInvalidation {
  readonly sessionId: string;
  readonly userId: string;
  readonly commandType: string;
  readonly eventIds: readonly string[];
  readonly changedChunks: readonly string[];
  readonly dirtyChunks: readonly string[];
  readonly chunkVersions: Readonly<Record<string, string>>;
}

export type EditorRealtimeEvent =
  | { readonly type: "status"; readonly status: RealtimeConnectionStatus }
  | {
      readonly type: "session.welcome";
      readonly session: RealtimeMember;
      readonly members: readonly RealtimeMember[];
    }
  | { readonly type: "member.joined"; readonly member: RealtimeMember }
  | { readonly type: "member.left"; readonly sessionId: string; readonly userId: string }
  | { readonly type: "presence.state"; readonly state: RealtimePresenceState }
  | { readonly type: "world.invalidate"; readonly invalidation: RealtimeWorldInvalidation }
  | { readonly type: "error"; readonly code: string; readonly message: string };

export interface EditorRealtimeClientOptions {
  readonly projectId: string;
  readonly worldId: string;
  readonly userId?: string;
  readonly displayName?: string;
  readonly sessionId?: string;
  readonly socketPath?: string;
  readonly updateRateHz?: number;
}

export interface LocalPresenceSnapshot {
  readonly position: RealtimeVector3;
  readonly velocity: RealtimeVector3;
  readonly yaw: number;
  readonly pitch: number;
  readonly movementMode: RealtimeMovementMode;
  readonly grounded: boolean;
  readonly flying: boolean;
  readonly heldItem: RealtimeHeldItem | null;
}

export interface RealtimeInvalidationInput {
  readonly commandType?: string;
  readonly eventIds?: readonly string[];
  readonly changedChunks?: readonly string[];
  readonly dirtyChunks?: readonly string[];
  readonly chunkVersions?: Readonly<Record<string, string>>;
}

export interface EditorRealtimeClient {
  connect(): void;
  publishPresence(state: LocalPresenceSnapshot): void;
  publishWorldInvalidation(invalidation: RealtimeInvalidationInput): void;
  subscribe(listener: (event: EditorRealtimeEvent) => void): () => void;
  getStatus(): RealtimeConnectionStatus;
  getSessionId(): string | null;
  getMembers(): readonly RealtimeMember[];
  destroy(): void;
}

const DEFAULT_SOCKET_PATH = "/editor/realtime";
const DEFAULT_UPDATE_RATE_HZ = 12;
const HEARTBEAT_MS = 5_000;
const RECONNECT_MAX_MS = 10_000;
const LOCAL_ID_STORAGE_KEY = "vectoplan.editor.realtime.userId";

function safeText(value: unknown, fallback: string, maximum = 180): string {
  try {
    const normalized = String(value ?? "").trim();
    return (normalized || fallback).slice(0, maximum);
  } catch {
    return fallback;
  }
}

function randomId(prefix: string): string {
  try {
    return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
}

function resolveLocalIdentity(options: EditorRealtimeClientOptions): {
  userId: string;
  displayName: string;
  sessionId: string;
} {
  const query = new URLSearchParams(window.location.search);
  let storedUserId = "";

  try {
    storedUserId = window.localStorage.getItem(LOCAL_ID_STORAGE_KEY) ?? "";
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }

  const userId = safeText(
    options.userId ?? query.get("userId") ?? query.get("user_id") ?? storedUserId,
    randomId("editor_user"),
  );

  try {
    window.localStorage.setItem(LOCAL_ID_STORAGE_KEY, userId);
  } catch {
    // A stable identity is helpful but not required for the connection.
  }

  const shortId = userId.replace(/^editor_user_/, "").slice(-6).toUpperCase();
  const displayName = safeText(
    options.displayName ?? query.get("displayName") ?? query.get("name"),
    `Builder ${shortId || "LOCAL"}`,
    48,
  );

  return {
    userId,
    displayName,
    sessionId: safeText(options.sessionId, randomId("session")),
  };
}

function buildSocketUrl(
  options: EditorRealtimeClientOptions,
  identity: ReturnType<typeof resolveLocalIdentity>,
): string {
  const base = new URL(options.socketPath ?? DEFAULT_SOCKET_PATH, window.location.href);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.searchParams.set("projectId", safeText(options.projectId, "dev-project"));
  base.searchParams.set("worldId", safeText(options.worldId, "world_spawn"));
  base.searchParams.set("userId", identity.userId);
  base.searchParams.set("displayName", identity.displayName);
  base.searchParams.set("sessionId", identity.sessionId);
  return base.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function asMember(value: unknown): RealtimeMember | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const sessionId = safeText(record.sessionId, "");
  if (!sessionId) {
    return null;
  }

  return record as unknown as RealtimeMember;
}

export function createEditorRealtimeClient(
  options: EditorRealtimeClientOptions,
): EditorRealtimeClient {
  const identity = resolveLocalIdentity(options);
  const listeners = new Set<(event: EditorRealtimeEvent) => void>();
  const members = new Map<string, RealtimeMember>();
  const updateIntervalMs = 1_000 / Math.max(1, Math.min(30, options.updateRateHz ?? DEFAULT_UPDATE_RATE_HZ));

  let socket: WebSocket | null = null;
  let status: RealtimeConnectionStatus = "idle";
  let ownSessionId: string | null = null;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let reconnectAttempt = 0;
  let lastPresenceSentAt = 0;
  let sequence = 0;
  let destroyed = false;

  function emit(event: EditorRealtimeEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // An observer must not break the transport.
      }
    }
  }

  function setStatus(nextStatus: RealtimeConnectionStatus): void {
    if (status === nextStatus) {
      return;
    }
    status = nextStatus;
    emit({ type: "status", status });
  }

  function send(payload: Record<string, unknown>): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function stopTimers(): void {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function scheduleReconnect(): void {
    if (destroyed || reconnectTimer !== null) {
      return;
    }

    reconnectAttempt += 1;
    const delay = Math.min(RECONNECT_MAX_MS, 500 * 2 ** Math.min(reconnectAttempt - 1, 5));
    setStatus("reconnecting");
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function handleMessage(messageEvent: MessageEvent): void {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = asRecord(JSON.parse(String(messageEvent.data)));
    } catch {
      return;
    }
    if (!payload) {
      return;
    }

    const type = safeText(payload.type, "");
    if (type === "session.welcome") {
      const session = asMember(payload.session);
      if (!session) {
        return;
      }
      ownSessionId = session.sessionId;
      members.clear();
      const incomingMembers = Array.isArray(payload.members)
        ? payload.members.map(asMember).filter((member): member is RealtimeMember => member !== null)
        : [];
      incomingMembers.forEach((member) => members.set(member.sessionId, member));
      emit({ type, session, members: incomingMembers });
      return;
    }

    if (type === "member.joined") {
      const member = asMember(payload.member);
      if (member && member.sessionId !== ownSessionId) {
        members.set(member.sessionId, member);
        emit({ type, member });
      }
      return;
    }

    if (type === "member.left") {
      const sessionId = safeText(payload.sessionId, "");
      const userId = safeText(payload.userId, "");
      members.delete(sessionId);
      emit({ type, sessionId, userId });
      return;
    }

    if (type === "presence.state") {
      const stateRecord = asRecord(payload.state);
      if (!stateRecord) {
        return;
      }
      const state = stateRecord as unknown as RealtimePresenceState;
      if (state.sessionId === ownSessionId) {
        return;
      }
      const previous = members.get(state.sessionId);
      members.set(state.sessionId, {
        sessionId: state.sessionId,
        userId: state.userId,
        displayName: state.displayName,
        avatarColor: state.avatarColor,
        projectId: previous?.projectId ?? options.projectId,
        worldId: previous?.worldId ?? options.worldId,
        connectedAtMs: previous?.connectedAtMs ?? Date.now(),
        state,
      });
      emit({ type, state });
      return;
    }

    if (type === "world.invalidate") {
      const invalidation = asRecord(payload.invalidation);
      if (invalidation) {
        emit({ type, invalidation: invalidation as unknown as RealtimeWorldInvalidation });
      }
      return;
    }

    if (type === "error") {
      emit({
        type,
        code: safeText(payload.code, "realtime_error"),
        message: safeText(payload.message, "Realtime-Fehler"),
      });
    }
  }

  function connect(): void {
    if (destroyed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus(reconnectAttempt > 0 ? "reconnecting" : "connecting");
    const nextSocket = new WebSocket(buildSocketUrl(options, identity));
    socket = nextSocket;

    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket || destroyed) {
        nextSocket.close();
        return;
      }
      reconnectAttempt = 0;
      setStatus("connected");
      heartbeatTimer = window.setInterval(() => {
        send({ type: "ping", clientTimeMs: Date.now() });
      }, HEARTBEAT_MS);
    });
    nextSocket.addEventListener("message", handleMessage);
    nextSocket.addEventListener("close", () => {
      if (socket === nextSocket) {
        socket = null;
      }
      members.clear();
      ownSessionId = null;
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (!destroyed) {
        setStatus("disconnected");
        scheduleReconnect();
      }
    });
    nextSocket.addEventListener("error", () => {
      nextSocket.close();
    });
  }

  return {
    connect,
    publishPresence(state): void {
      const timestamp = performance.now();
      if (timestamp - lastPresenceSentAt < updateIntervalMs) {
        return;
      }
      lastPresenceSentAt = timestamp;
      sequence += 1;
      send({ type: "presence.state", sequence, clientTimeMs: Date.now(), ...state });
    },
    publishWorldInvalidation(invalidation): void {
      send({ type: "world.invalidate", ...invalidation });
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStatus: () => status,
    getSessionId: () => ownSessionId,
    getMembers: () => [...members.values()],
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      stopTimers();
      setStatus("destroyed");
      socket?.close(1000, "editor-runtime-destroyed");
      socket = null;
      members.clear();
      listeners.clear();
    },
  };
}
