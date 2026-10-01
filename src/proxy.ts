import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type SessionPayload } from "@/lib/auth/jwt";
import { refreshTokens } from "@/lib/auth/refresh";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
} from "@/lib/auth/session";

const roleRoutes: Record<string, string> = {
  "/patient": "patient",
  "/doctor": "doctor",
  "/admin": "admin",
};

/** Keeps a session alive: the access token lasts 15 minutes, so when it has
 * expired but the 30-day refresh token is still good, both are re-issued
 * here, before the page or API route runs. Without this every user was sent
 * back to /login 15 minutes after signing in. */
export async function proxy(req: NextRequest) {
  let session: SessionPayload | null = null;
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (access) session = await verifyAccessToken(access).catch(() => null);

  let refreshed: Awaited<ReturnType<typeof refreshTokens>> = null;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!session && refresh) {
    refreshed = await refreshTokens(refresh);
    if (refreshed) {
      session = { sub: refreshed.sub, role: refreshed.role };
      // Downstream server code reads cookies from the request, so it must see the new token too.
      req.cookies.set(ACCESS_COOKIE, refreshed.access);
      req.cookies.set(REFRESH_COOKIE, refreshed.refresh);
    }
  }

  const { pathname } = req.nextUrl;
  const prefix = Object.keys(roleRoutes).find((p) => pathname.startsWith(p));
  let res: NextResponse;
  if (prefix && !session) res = NextResponse.redirect(new URL("/login", req.url));
  else if (prefix && session!.role !== roleRoutes[prefix])
    res = NextResponse.redirect(new URL(`/${session!.role}/dashboard`, req.url));
  else res = NextResponse.next({ request: { headers: req.headers } });

  if (refreshed) {
    res.cookies.set(ACCESS_COOKIE, refreshed.access, ACCESS_COOKIE_OPTS);
    res.cookies.set(REFRESH_COOKIE, refreshed.refresh, REFRESH_COOKIE_OPTS);
  }
  return res;
}

export const config = {
  // API routes too, so a page left open past 15 minutes can still save. /api/auth
  // is excluded: login/logout/refresh manage the cookies themselves.
  matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*", "/emergency", "/api/((?!auth/).*)"],
};
