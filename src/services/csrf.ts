/** CSRF cookie reader for refresh/logout double-submit. */

export function readCsrfCookie(name = "thyrocare_csrf"): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}
