/**
 * Centralized frontend environment config.
 * Do not read import.meta.env directly from components.
 * VITE_* values are embedded at build time — changing them requires a new build/deploy.
 */

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";
const DEFAULT_APP_NAME = "ThyroCare AI";

function readEnv(key: keyof ImportMetaEnv, fallback?: string): string | undefined {
  const value = import.meta.env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

function isLoopbackApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

function assertValidApiBaseUrl(url: string, context: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[env] ${context}: VITE_API_BASE_URL is not a valid URL (received "${url}").`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[env] ${context}: VITE_API_BASE_URL must use http: or https: (received "${url}").`,
    );
  }
}

const configuredApiBaseUrl = readEnv("VITE_API_BASE_URL");
const appEnvironment = readEnv("VITE_APP_ENV", import.meta.env.DEV ? "development" : "deployed")!;
const isProductionApp = appEnvironment === "production";
const isProductionBundle = Boolean(import.meta.env.PROD);
const isDevelopment = Boolean(import.meta.env.DEV);

let apiBaseUrl: string;

if (isProductionApp) {
  if (!configuredApiBaseUrl) {
    throw new Error(
      "[env] VITE_API_BASE_URL is required when VITE_APP_ENV=production. " +
        "Set it in the Cloudflare build environment (see .env.production.example). " +
        "Do not use localhost for production app builds.",
    );
  }
  assertValidApiBaseUrl(configuredApiBaseUrl, "production");
  if (isLoopbackApiUrl(configuredApiBaseUrl)) {
    throw new Error(
      "[env] Production builds must not use localhost or 127.0.0.1 for VITE_API_BASE_URL " +
        `(received "${configuredApiBaseUrl}").`,
    );
  }
  apiBaseUrl = configuredApiBaseUrl;
} else if (isProductionBundle) {
  // Static deploy without VITE_APP_ENV=production (frontend-only until backend exists).
  // Never fall back to localhost in a production Vite bundle.
  if (!configuredApiBaseUrl) {
    console.error(
      "[env] VITE_API_BASE_URL is not set for this production bundle. " +
        "API features will not work until a public API URL is configured and the app is rebuilt.",
    );
    apiBaseUrl = "";
  } else {
    assertValidApiBaseUrl(configuredApiBaseUrl, "production-bundle");
    if (isLoopbackApiUrl(configuredApiBaseUrl)) {
      throw new Error(
        "[env] Production bundles must not use localhost or 127.0.0.1 for VITE_API_BASE_URL " +
          `(received "${configuredApiBaseUrl}").`,
      );
    }
    apiBaseUrl = configuredApiBaseUrl;
  }
} else {
  apiBaseUrl = configuredApiBaseUrl ?? DEFAULT_API_BASE_URL;
  assertValidApiBaseUrl(apiBaseUrl, "development");
}

export const env = Object.freeze({
  apiBaseUrl,
  appName: readEnv("VITE_APP_NAME", DEFAULT_APP_NAME)!,
  appEnvironment,
  isDevelopment,
  isProduction: isProductionApp || isProductionBundle,
  /** Present only when Google Sign-In is configured for this build. */
  googleClientId: readEnv("VITE_GOOGLE_CLIENT_ID") ?? "",
});

export type AppEnv = typeof env;
