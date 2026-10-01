import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getRefreshCookie,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
} from "@/lib/auth/session";
import { refreshTokens } from "@/lib/auth/refresh";

export async function POST() {
  const refreshToken = await getRefreshCookie();
  if (!refreshToken) {
    return NextResponse.json({ error: "No session to refresh." }, { status: 401 });
  }
  const tokens = await refreshTokens(refreshToken);
  if (!tokens) return NextResponse.json({ error: "Session invalid." }, { status: 401 });
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access, ACCESS_COOKIE_OPTS);
  store.set(REFRESH_COOKIE, tokens.refresh, REFRESH_COOKIE_OPTS);
  return NextResponse.json({ ok: true });
}
