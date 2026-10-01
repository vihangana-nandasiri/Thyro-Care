import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateWithPassword, InvalidCredentialsError } from "@/lib/services/auth";
import { createSession } from "@/lib/auth/session";
import { signMfaChallenge, signMfaSetup } from "@/lib/auth/jwt";
import { isRateLimited } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  if (isRateLimited(`login:${parsed.data.email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  try {
    const user = await authenticateWithPassword(parsed.data.email, parsed.data.password);
    if (user.mfaEnabled) {
      const challengeToken = await signMfaChallenge(user.id);
      return NextResponse.json({ mfaRequired: true, challengeToken });
    }
    if (user.mfaRequired) return NextResponse.json({mfaSetupRequired:true,challengeToken:await signMfaSetup(user.id)});
    await createSession(user.id, user.role);
    await recordAuditEvent(user.id, "login", "user", user.id);
    return NextResponse.json({ mfaRequired: false, role: user.role });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    return NextResponse.json({error:"Sign-in temporarily unavailable. Please try again."},{status:503});
  }
}
