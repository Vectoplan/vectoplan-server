// services/vectoplan-editor/src/frontend/vite.config.ts
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type UserConfig } from "vite";

type EditorBuildMode = "development" | "production" | "test";

interface EditorViteEnv {
  readonly mode: EditorBuildMode;
  readonly rootDir: string;
  readonly serviceDir: string;
  readonly outDir: string;
  readonly cacheDir: string;
  readonly assetBase: string;
  readonly host: string;
  readonly devPort: number;
  readonly previewPort: number;
  readonly sourcemap: boolean;
  readonly minify: boolean;
  readonly backendOrigin: string;
  readonly chunkProxyBaseUrl: string;
  readonly defaultProjectId: string;
  readonly defaultWorldId: string;
  readonly localWorldFallbackEnabled: boolean;
  readonly legacyFrontendEnabled: boolean;
}

function readStringEnv(
  env: Record<string, string | undefined>,
  key: string,
  fallback: string,
): string {
  try {
    const value = env[key];

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

function readFirstStringEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = readStringEnv(env, key, "");
    if (value.length > 0) {
      return value;
    }
  }

  return fallback;
}

function readBooleanEnv(
  env: Record<string, string | undefined>,
  key: string,
  fallback: boolean,
): boolean {
  try {
    const value = env[key];

    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (["1", "true", "t", "yes", "y", "on", "enabled"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "f", "no", "n", "off", "disabled"].includes(normalized)) {
      return false;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readFirstBooleanEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[],
  fallback: boolean,
): boolean {
  for (const key of keys) {
    const raw = env[key];

    if (typeof raw !== "string" || raw.trim().length === 0) {
      continue;
    }

    return readBooleanEnv(env, key, fallback);
  }

  return fallback;
}

function readPortEnv(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  try {
    const raw = env[key];

    if (typeof raw !== "string") {
      return fallback;
    }

    const port = Number.parseInt(raw.trim(), 10);

    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return fallback;
    }

    return port;
  } catch {
    return fallback;
  }
}

function normalizeAssetBase(value: string): string {
  try {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return "/static/editor/";
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
    }

    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
  } catch {
    return "/static/editor/";
  }
}

function normalizeRouteBase(value: string, fallback: string): string {
  try {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return fallback;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/\/+$/, "");
    }

    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
  } catch {
    return fallback;
  }
}

function resolveEditorEnv(mode: string): EditorViteEnv {
  const rootDir = fileURLToPath(new URL(".", import.meta.url));
  const serviceDir = resolve(rootDir, "../..");

  const loadedEnv = loadEnv(mode, rootDir, "");
  const processEnv = process.env as Record<string, string | undefined>;

  const env: Record<string, string | undefined> = {
    ...loadedEnv,
    ...processEnv,
  };

  const normalizedMode: EditorBuildMode =
    mode === "production" || mode === "test" ? mode : "development";

  const outDir = readFirstStringEnv(
    env,
    [
      "VECTOPLAN_EDITOR_FRONTEND_OUT_DIR",
      "VECTOPLAN_EDITOR_STATIC_EDITOR_ROOT",
      "STATIC_EDITOR_DIR",
    ],
    resolve(serviceDir, "static/editor"),
  );

  const cacheDir = readFirstStringEnv(
    env,
    [
      "VECTOPLAN_EDITOR_FRONTEND_CACHE_DIR",
      "VITE_CACHE_DIR",
    ],
    resolve(serviceDir, ".cache/vite-editor"),
  );

  const assetBase = normalizeAssetBase(
    readFirstStringEnv(
      env,
      [
        "VECTOPLAN_EDITOR_FRONTEND_ASSET_BASE",
        "VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX",
        "VITE_EDITOR_ASSET_BASE",
      ],
      "/static/editor/",
    ),
  );

  const chunkProxyBaseUrl = normalizeRouteBase(
    readFirstStringEnv(
      env,
      [
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
        "VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL",
        "VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL",
        "VITE_VECTOPLAN_EDITOR_CHUNK_API_BASE_URL",
      ],
      "/editor/api/chunk",
    ),
    "/editor/api/chunk",
  );

  return {
    mode: normalizedMode,
    rootDir,
    serviceDir,
    outDir,
    cacheDir,
    assetBase,
    host: readFirstStringEnv(
      env,
      [
        "VECTOPLAN_EDITOR_FRONTEND_HOST",
        "VITE_HOST",
      ],
      "0.0.0.0",
    ),
    devPort: readPortEnv(env, "VECTOPLAN_EDITOR_FRONTEND_DEV_PORT", 5173),
    previewPort: readPortEnv(env, "VECTOPLAN_EDITOR_FRONTEND_PREVIEW_PORT", 4173),
    sourcemap: readFirstBooleanEnv(
      env,
      [
        "VECTOPLAN_EDITOR_FRONTEND_SOURCEMAP",
        "VITE_SOURCEMAP",
      ],
      false,
    ),
    minify: readFirstBooleanEnv(
      env,
      [
        "VECTOPLAN_EDITOR_FRONTEND_MINIFY",
        "VITE_MINIFY",
      ],
      normalizedMode === "production",
    ),
    backendOrigin: readFirstStringEnv(
      env,
      [
        "VECTOPLAN_EDITOR_FRONTEND_BACKEND_ORIGIN",
        "VECTOPLAN_EDITOR_DEV_BACKEND_ORIGIN",
        "VITE_BACKEND_ORIGIN",
      ],
      "http://127.0.0.1:5000",
    ),
    chunkProxyBaseUrl,
    defaultProjectId: readFirstStringEnv(
      env,
      [
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID",
        "VECTOPLAN_EDITOR_CHUNK_PROJECT_ID",
        "VITE_VECTOPLAN_EDITOR_CHUNK_PROJECT_ID",
      ],
      "dev-project",
    ),
    defaultWorldId: readFirstStringEnv(
      env,
      [
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID",
        "VECTOPLAN_EDITOR_CHUNK_WORLD_ID",
        "VITE_VECTOPLAN_EDITOR_CHUNK_WORLD_ID",
      ],
      "world_spawn",
    ),
    localWorldFallbackEnabled: readFirstBooleanEnv(
      env,
      [
        "VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED",
        "VITE_VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED",
      ],
      false,
    ),
    legacyFrontendEnabled: readFirstBooleanEnv(
      env,
      [
        "VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED",
        "VITE_VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED",
      ],
      false,
    ),
  };
}

function buildAlias(rootDir: string): UserConfig["resolve"] {
  return {
    alias: {
      "@": rootDir,
      "@api": resolve(rootDir, "api"),
      "@bootstrap": resolve(rootDir, "bootstrap"),
      "@camera": resolve(rootDir, "camera"),
      "@config": resolve(rootDir, "config"),
      "@dom": resolve(rootDir, "dom"),
      "@input": resolve(rootDir, "input"),
      "@inventory": resolve(rootDir, "inventory"),
      "@render": resolve(rootDir, "render"),
      "@runtime": resolve(rootDir, "runtime"),
      "@scene": resolve(rootDir, "scene"),
      "@runtime-scene": resolve(rootDir, "runtime/scene"),
      "@state": resolve(rootDir, "state"),
      "@targeting": resolve(rootDir, "targeting"),
      "@ui": resolve(rootDir, "ui"),
      "@utils": resolve(rootDir, "utils"),
      "@world": resolve(rootDir, "runtime/world"),
    },
  };
}

function buildDefineValues(env: EditorViteEnv): UserConfig["define"] {
  return {
    __VECTOPLAN_EDITOR_BUILD_MODE__: JSON.stringify(env.mode),
    __VECTOPLAN_EDITOR_BUILD_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0"),
    __VECTOPLAN_EDITOR_CHUNK_PROXY_BASE_URL__: JSON.stringify(env.chunkProxyBaseUrl),
    __VECTOPLAN_EDITOR_CHUNK_API_BASE_URL__: JSON.stringify(env.chunkProxyBaseUrl),
    __VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID__: JSON.stringify(env.defaultProjectId),
    __VECTOPLAN_EDITOR_DEFAULT_WORLD_ID__: JSON.stringify(env.defaultWorldId),
    __VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED__: JSON.stringify(env.localWorldFallbackEnabled),
    __VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED__: JSON.stringify(env.legacyFrontendEnabled),
  };
}

function buildManualChunks(id: string): string | undefined {
  const normalized = id.replaceAll("\\", "/");

  if (!normalized.includes("/node_modules/")) {
    return undefined;
  }

  if (normalized.includes("/node_modules/three/")) {
    return "three";
  }

  return "vendor";
}

export default defineConfig(({ mode }) => {
  const editorEnv = resolveEditorEnv(mode);

  return {
    root: editorEnv.rootDir,
    base: editorEnv.assetBase,
    publicDir: "public",
    cacheDir: editorEnv.cacheDir,
    envDir: editorEnv.rootDir,
    envPrefix: ["VITE_"],

    resolve: buildAlias(editorEnv.rootDir),
    define: buildDefineValues(editorEnv),

    server: {
      host: editorEnv.host,
      port: editorEnv.devPort,
      strictPort: false,
      open: false,
      cors: false,
      fs: {
        strict: true,
        allow: [
          editorEnv.rootDir,
          editorEnv.serviceDir,
        ],
      },
      proxy: {
        "/editor/api": {
          target: editorEnv.backendOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/editor/realtime": {
          target: editorEnv.backendOrigin,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },

    preview: {
      host: editorEnv.host,
      port: editorEnv.previewPort,
      strictPort: false,
      open: false,
    },

    build: {
      outDir: editorEnv.outDir,
      emptyOutDir: true,
      assetsDir: "assets",
      target: "es2022",
      sourcemap: editorEnv.sourcemap,
      minify: editorEnv.minify ? "esbuild" : false,
      manifest: "manifest.json",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        input: resolve(editorEnv.rootDir, "main.ts"),
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          manualChunks: buildManualChunks,
        },
      },
    },

    optimizeDeps: {
      entries: [
        resolve(editorEnv.rootDir, "main.ts"),
      ],
    },

    esbuild: {
      target: "es2022",
      legalComments: "none",
    },

    logLevel: "info",
    clearScreen: false,
  };
});