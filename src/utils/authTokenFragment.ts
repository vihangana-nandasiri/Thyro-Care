/**
 * Read a one-time auth action token from the URL hash (#token=...) and
 * immediately clear it from the address bar via history.replaceState.
 * Never log or persist the token.
 */
export function readAndClearTokenFragment(): string | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get("token");
  if (!token || token.trim().length === 0) return null;

  const cleaned = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, document.title, cleaned);
  return token.trim();
}
