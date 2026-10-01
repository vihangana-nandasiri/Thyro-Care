import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { createDoctorAccount, listDoctors } from "@/lib/services/accounts";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, ValidationError } from "@/lib/errors";

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  specialty: z.string().max(200).optional(),
});

export async function GET() {
  try {
    await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
  const doctors = await listDoctors();
  return NextResponse.json({ doctors });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  try {
    const { user, tempPassword } = await createDoctorAccount(parsed.data);
    await recordAuditEvent(session.sub, "create_doctor_account", "user", user.id, {
      email: user.email,
    });
    return NextResponse.json({ email: user.email, tempPassword });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
