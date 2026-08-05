// services/vectoplan-editor/vite.config.ts
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv, type UserConfig } from "vite";


/* -----------------------------------------------------------------------------
 * VECTOPLAN Editor - Vite Build-Konfiguration
 * -----------------------------------------------------------------------------
 * Ziele dieser Datei:
 * - `frontend/src/` als neue Source-of-Truth für die Browser-Runtime etablieren
 * - Build-Ausgabe stabil nach `static/editor/` schreiben
 * - `static/editor/js/main.js` als konsistenten Einstiegspunkt erzeugen
 * - relative Asset-Pfade robust halten, damit Flask die Dateien zuverlässig
 *   unter `/static/editor/...` ausliefern kann
 * - Docker- und Lokalbetrieb gleichermaßen unterstützen
 *
 * Wichtige Architekturentscheidung:
 * - `frontend/src/main.ts` ist der Quell-Einstiegspunkt
 * - `static/editor/js/main.js` ist das ausgelieferte Build-Artefakt
 *
 * Robustheitsprinzipien:
 * - defensive Pfadauflösung
 * - defensive Environment-Auswertung
 * - klare Fehlertexte bei fehlenden Einstiegspunkten
 * - stabile Output-Namenskonventionen
 * - `emptyOutDir: false`, damit handgepflegte Dateien wie
 *   `static/editor/css/editor.css` nicht gelöscht werden
 * -------------------------------------------------------------------------- */


/* -----------------------------------------------------------------------------
 * Pfad-Helfer
 * -------------------------------------------------------------------------- */

function resolveServiceRoot(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    try {
      return process.cwd();
    } catch {
      return ".";
    }
  }
}

function safeResolvePath(...segments: string[]): string {
  try {
    return path.resolve(...segments);
  } catch {
    return segments[segments.length - 1] || ".";
  }
}

function safeExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function ensureRequiredPathExists(filePath: string, label: string): void {
  if (!safeExists(filePath)) {
    throw new Error(
      `[vectoplan-editor:vite] Erforderlicher Pfad fehlt: ${label} (${filePath})`,
    );
  }
}


/* -----------------------------------------------------------------------------
 * Environment-Helfer
 * -------------------------------------------------------------------------- */

function readStringEnv(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function readBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "t", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "f", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readIntEnv(
  value: string | undefined,
  fallback: number,
  minimum?: number,
  maximum?: number,
): number {
  let result = fallback;

  if (typeof value === "string") {
    const normalized = value.trim();

    if (normalized) {
      const parsed = Number.parseInt(normalized, 10);
      if (Number.isFinite(parsed)) {
        result = parsed;
      }
    }
  }

  if (typeof minimum === "number") {
    result = Math.max(minimum, result);
  }

  if (typeof maximum === "number") {
    result = Math.min(maximum, result);
  }

  return result;
}

function resolveMinifySetting(
  value: string | undefined,
  fallback: "esbuild" | false,
): "esbuild" | "terser" | false {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["0", "false", "off", "none", "no"].includes(normalized)) {
    return false;
  }

  if (normalized === "terser") {
    return "terser";
  }

  if (normalized === "esbuild" || normalized === "true" || normalized === "on") {
    return "esbuild";
  }

  return fallback;
}


/* -----------------------------------------------------------------------------
 * Statische Projektpfade
 * -------------------------------------------------------------------------- */

const SERVICE_ROOT = resolveServiceRoot();

const FRONTEND_SRC_ROOT = safeResolvePath(SERVICE_ROOT, "frontend", "src");
const FRONTEND_ENTRY = safeResolvePath(FRONTEND_SRC_ROOT, "main.ts");

const STATIC_ROOT = safeResolvePath(SERVICE_ROOT, "static");
const STATIC_EDITOR_ROOT = safeResolvePath(STATIC_ROOT, "editor");

const VITE_CACHE_DIR = safeResolvePath(
  SERVICE_ROOT,
  "node_modules",
  ".vite",
  "vectoplan-editor",
);


/* -----------------------------------------------------------------------------
 * Asset-Namenslogik
 * -------------------------------------------------------------------------- */

function resolveAssetOutputPath(assetName: string | undefined): string {
  const normalizedName = typeof assetName === "string" ? assetName : "";
  const extension = path.extname(normalizedName).toLowerCase();

  if (extension === ".css") {
    return "css/[name]-[hash][extname]";
  }

  if (
    [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".avif",
      ".bmp",
      ".ico",
    ].includes(extension)
  ) {
    return "assets/images/[name]-[hash][extname]";
  }

  if (
    [
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
    ].includes(extension)
  ) {
    return "assets/fonts/[name]-[hash][extname]";
  }

  if (
    [
      ".glb",
      ".gltf",
      ".bin",
      ".obj",
    ].includes(extension)
  ) {
    return "assets/geometry/[name]-[hash][extname]";
  }

  return "assets/[name]-[hash][extname]";
}


/* -----------------------------------------------------------------------------
 * Konfiguration
 * -------------------------------------------------------------------------- */

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, SERVICE_ROOT, "");

  ensureRequiredPathExists(FRONTEND_SRC_ROOT, "Frontend-Quellverzeichnis");
  ensureRequiredPathExists(FRONTEND_ENTRY, "Frontend-Einstiegspunkt");

  const buildTarget = readStringEnv(env.VITE_EDITOR_BUILD_TARGET, "es2022");
  const sourceMapEnabled = readBoolEnv(
    env.VITE_EDITOR_SOURCEMAP,
    mode !== "production",
  );
  const minify = resolveMinifySetting(
    env.VITE_EDITOR_MINIFY,
    mode === "production" ? "esbuild" : false,
  );
  const emptyOutDir = readBoolEnv(
    env.VITE_EDITOR_EMPTY_OUT_DIR,
    false,
  );

  const devPort = readIntEnv(
    env.VITE_EDITOR_DEV_PORT,
    5173,
    1,
    65535,
  );

  const previewPort = readIntEnv(
    env.VITE_EDITOR_PREVIEW_PORT,
    4173,
    1,
    65535,
  );

  const base = readStringEnv(env.VITE_EDITOR_BASE, "./");
  const logLevel = readStringEnv(env.VITE_EDITOR_LOG_LEVEL, "info") as
    | "info"
    | "warn"
    | "error"
    | "silent";

  const config: UserConfig = {
    root: SERVICE_ROOT,
    envDir: SERVICE_ROOT,
    cacheDir: VITE_CACHE_DIR,

    /**
     * Kein klassisches HTML-App-Projekt.
     * Flask liefert das HTML, Vite baut nur die Browser-Runtime.
     */
    appType: "custom",
    publicDir: false,
    clearScreen: false,
    logLevel,
    base,

    resolve: {
      alias: {
        "@editor": FRONTEND_SRC_ROOT,
      },
    },

    server: {
      host: true,
      port: devPort,
      strictPort: false,
    },

    preview: {
      host: "0.0.0.0",
      port: previewPort,
      strictPort: false,
    },

    define: {
      __VECTOPLAN_EDITOR_BUILD_MODE__: JSON.stringify(mode),
      __VECTOPLAN_EDITOR_BUILD_VERSION__: JSON.stringify(
        process.env.npm_package_version || "0.0.0",
      ),
    },

    build: {
      target: buildTarget,

      /**
       * Sehr wichtig:
       * `static/editor/` enthält auch handgepflegte Dateien wie
       * `css/editor.css`. Deshalb darf das Verzeichnis standardmäßig nicht
       * geleert werden.
       */
      outDir: STATIC_EDITOR_ROOT,
      emptyOutDir,

      sourcemap: sourceMapEnabled,
      minify,
      manifest: false,
      copyPublicDir: false,
      assetsInlineLimit: 0,
      reportCompressedSize: false,

      rollupOptions: {
        input: FRONTEND_ENTRY,
        output: {
          /**
           * Stabile Hauptdatei für Flask-Template:
           * /static/editor/js/main.js
           */
          entryFileNames: "js/main.js",

          /**
           * Zusätzliche Chunks landen geordnet unter js/chunks/.
           */
          chunkFileNames: "js/chunks/[name]-[hash].js",

          /**
           * Assets sauber gruppieren.
           */
          assetFileNames: (assetInfo) => {
            return resolveAssetOutputPath(assetInfo.name);
          },

          /**
           * Frühe, einfache Vendor-Trennung.
           * Wenn Three.js und weitere node_modules dazukommen, bleibt die
           * Ausgabe strukturierter.
           */
          manualChunks(id) {
            if (typeof id === "string" && id.includes("node_modules")) {
              return "vendor";
            }

            return undefined;
          },
        },
      },
    },
  };

  return config;
});