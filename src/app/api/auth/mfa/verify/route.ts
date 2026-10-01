import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyMfaChallenge } from "@/lib/auth/jwt";
import { verifyMfaToken } from "@/lib/auth/mfa";
import { createSession } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  challengeToken: z.string(),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  let sub: string;
  try {
    ({ sub } = await verifyMfaChallenge(parsed.data.challengeToken));
  } catch {
    return NextResponse.json({ error: "Challenge expired, please log in again." }, { status: 401 });
  }
  if (isRateLimited(`mfa-verify:${sub}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, sub) });
  if (!user || user.status !== "active" || !user.mfaEnabled || !user.mfaSecret) {
    return NextResponse.json({ error: "MFA is not enabled for this account." }, { status: 400 });
  }
  if (!verifyMfaToken(user.mfaSecret, parsed.data.code)) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }
  await createSession(user.id, user.role);
  await recordAuditEvent(user.id, "login_mfa", "user", user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
