import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signAccessToken, signRefreshToken, verifyRefreshToken, type Role } from "./jwt";

/** New access + refresh tokens for a still-valid refresh token, re-checking
 * the account (suspended, or MFA now required) so a refresh can't outlive a
 * revoked account. Null means the user must sign in again. */
export async function refreshTokens(
  refreshToken: string,
): Promise<{ access: string; refresh: string; role: Role; sub: string } | null> {
  try {
    const { sub } = await verifyRefreshToken(refreshToken);
    const user = await db.query.users.findFirst({ where: eq(users.id, sub) });
    if (!user || user.status !== "active" || (user.mfaRequired && !user.mfaEnabled)) return null;
    const [access, refresh] = await Promise.all([
      signAccessToken({ sub: user.id, role: user.role }),
      signRefreshToken(user.id),
    ]);
    return { access, refresh, role: user.role, sub: user.id };
  } catch {
    return null;
  }
}
