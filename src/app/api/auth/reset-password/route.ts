import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/services/auth";
import { NotFoundError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  try {
    const userId = await resetPassword(parsed.data.token, parsed.data.newPassword);
    await recordAuditEvent(userId, "reset_password", "user", userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
