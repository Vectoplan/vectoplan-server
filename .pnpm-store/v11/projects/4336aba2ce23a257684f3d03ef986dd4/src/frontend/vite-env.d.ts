// services/vectoplan-editor/src/frontend/vite-env.d.ts
/// <reference types="vite/client" />

import type {
  EditorBootstrap,
  EditorChunkServiceConfig,
  EditorChunkServiceRouteHints,
} from "./bootstrap/bootstrap_models";
import type { VectoplanEditorRuntimeHandle } from "./main";

declare const __VECTOPLAN_EDITOR_BUILD_MODE__: string;
declare const __VECTOPLAN_EDITOR_BUILD_VERSION__: string;
declare const __VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__: string;
declare const __VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__: string;
declare const __VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__: string;
declare const __VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__: boolean;

interface ImportMetaEnv {
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;

  readonly VECTOPLAN_EDITOR_FRONTEND_OUT_DIR?: string;
  readonly VECTOPLAN_EDITOR_FRONTEND_CACHE_DIR?: string;
  readonly VECTOPLAN_EDITOR_FRONTEND_ASSET_BASE?: string;
  readonly VECTOPLAN_EDITOR_FRONTEND_HOST?: string;
  readonly VECTOPLAN_EDITOR_FRONTEND_DEV_PORT?: string;
  readonly VECTOPLAN_EDITOR_FRONTEND_PREVIEW_PORT?: string;
  readonly VECTOPLAN_EDITOR_FRONTEND_SOURCEMAP?: string;

  readonly VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL?: string;
  readonly VECTOPLAN_EDITOR_CHUNK_PROJECT_ID?: string;
  readonly VECTOPLAN_EDITOR_CHUNK_WORLD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __VECTOPLAN_EDITOR_HTML_READY__?: boolean;

    __VECTOPLAN_EDITOR_BOOTSTRAP__?: unknown | Partial<EditorBootstrap>;
    __VECTOPLAN_EDITOR_BOOT_COUNT__?: number;
    __VECTOPLAN_EDITOR_LAST_BOOT_ID__?: string;
    __VECTOPLAN_EDITOR_LAST_BOOT_ERROR__?: unknown;
    __VECTOPLAN_EDITOR_READY__?: boolean;

    __VECTOPLAN_EDITOR_RUNTIME__?: VectoplanEditorRuntimeHandle;
    __VECTOPLAN_RUNTIME__?: VectoplanEditorRuntimeHandle;
    vectoplanEditorRuntime?: VectoplanEditorRuntimeHandle;
    editorRuntime?: VectoplanEditorRuntimeHandle;

    __VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__?: string;
    __VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL__?: string;
    __VECTOPLAN_EDITOR_CHUNK_PROJECT_ID__?: string;
    __VECTOPLAN_EDITOR_CHUNK_WORLD_ID__?: string;
    __VECTOPLAN_EDITOR_CHUNK_ROUTE_HINTS__?: Partial<EditorChunkServiceRouteHints> | string;
    __VECTOPLAN_EDITOR_CHUNK_SERVICE_CONFIG__?: Partial<EditorChunkServiceConfig> | string;
  }

  interface HTMLElementTagNameMap {
    "vectoplan-editor-root": HTMLElement;
  }

  interface WindowEventMap {
    "vectoplan-editor:ready": CustomEvent<{
      readonly service: "vectoplan-editor";
      readonly frontendRoot: "services/vectoplan-editor/src/frontend";
      readonly timestamp: string;
      readonly bootId: string;
      readonly bootAttemptCount: number;
      readonly projectId: string;
      readonly worldId: string;
      readonly apiBaseUrl: string;
    }>;

    "vectoplan-editor:failed": CustomEvent<{
      readonly service: "vectoplan-editor";
      readonly frontendRoot: "services/vectoplan-editor/src/frontend";
      readonly timestamp: string;
      readonly bootId: string;
      readonly bootAttemptCount: number;
      readonly trigger: string;
      readonly error: unknown;
    }>;

    "vectoplan-editor:destroyed": CustomEvent<{
      readonly service: "vectoplan-editor";
      readonly frontendRoot: "services/vectoplan-editor/src/frontend";
      readonly timestamp: string;
      readonly bootId: string;
      readonly reason: string | null;
      readonly source: string | null;
    }>;
  }
}

declare module "*.css" {
  const css: string;
  export default css;
}

declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.glb" {
  const src: string;
  export default src;
}

declare module "*.gltf" {
  const src: string;
  export default src;
}

export {};