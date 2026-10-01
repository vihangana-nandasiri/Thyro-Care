import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { generateMfaSecret, verifyMfaToken, qrDataUrl } from "@/lib/auth/mfa";
import { startMfaEnrollment, confirmMfaEnrollment } from "@/lib/services/auth";
import { verifyPassword } from "@/lib/auth/password";
import { isRateLimited } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

const startSchema = z.object({ password: z.string().min(1) });
const confirmSchema = z.object({ code: z.string().length(6) });

// Starting (or re-starting) MFA enrollment overwrites the stored secret, so
// it requires the current password — otherwise a hijacked session cookie
// could silently swap out the account's second factor.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = startSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Password confirmation required." }, { status: 400 });
  }
  if (isRateLimited(`mfa-enroll-start:${session.sub}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub) });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const { secret, otpauthUrl } = generateMfaSecret(user.email);
  await startMfaEnrollment(session.sub, secret);
  const qr = await qrDataUrl(otpauthUrl);
  return NextResponse.json({ secret, qr });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  if (isRateLimited(`mfa-enroll-confirm:${session.sub}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub) });
  if (!user?.mfaSecret) {
    return NextResponse.json({ error: "Start enrollment first." }, { status: 400 });
  }
  if (!verifyMfaToken(user.mfaSecret, parsed.data.code)) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }
  await confirmMfaEnrollment(session.sub);
  await recordAuditEvent(session.sub, "mfa_enabled", "user", session.sub);
  return NextResponse.json({ ok: true });
}
