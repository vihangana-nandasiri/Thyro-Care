import { cookies } from "next/headers";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  type Role,
  type SessionPayload,
} from "./jwt";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
const isProd = process.env.NODE_ENV === "production";
const base = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };
export const ACCESS_COOKIE_OPTS = { ...base, maxAge: 60 * 15 };
export const REFRESH_COOKIE_OPTS = { ...base, maxAge: 60 * 60 * 24 * 30 };

export async function createSession(userId: string, role: Role): Promise<void> {
  const [access, refresh] = await Promise.all([
    signAccessToken({ sub: userId, role }),
    signRefreshToken(userId),
  ]);
  const store = await cookies();
  store.set(ACCESS_COOKIE, access, ACCESS_COOKIE_OPTS);
  store.set(REFRESH_COOKIE, refresh, REFRESH_COOKIE_OPTS);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export async function getRefreshCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
