import { NextResponse } from "next/server";
import { z } from "zod";
import { issuePasswordResetToken } from "@/lib/services/auth";
import { isRateLimited } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  if (isRateLimited(`forgot-password:${parsed.data.email.toLowerCase()}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const token = await issuePasswordResetToken(parsed.data.email);

  // ponytail: no SMTP configured yet, so in production the link is simply
  // not deliverable — the account still gets a token row, but nothing
  // exposes it. Returning the raw link in the response would let anyone
  // reset any account's password without proving they own that inbox
  // (account takeover) and would also leak which emails are registered
  // (enumeration) via whether resetLink is present. Wire up real email
  // delivery before this feature is usable in production; until then this
  // only works in development, where the response includes the link
  // directly so it can be tested without a mail server.
  const resetLink =
    token && process.env.NODE_ENV !== "production"
      ? `${process.env.APP_URL}/reset-password?token=${token}`
      : null;

  return NextResponse.json({
    message: "If that account exists, a password reset link has been generated.",
    resetLink,
  });
}
