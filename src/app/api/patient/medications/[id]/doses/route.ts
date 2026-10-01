import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { logDose } from "@/lib/services/medications";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const schema = z.object({
  scheduledFor: z.string().datetime(),
  status: z.enum(["taken", "missed", "skipped"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { id: medicationId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  try {
    const log = await logDose(
      session.sub,
      medicationId,
      new Date(parsed.data.scheduledFor),
      parsed.data.status,
    );
    await recordAuditEvent(session.sub, "log_dose", "dose_log", log!.id, {
      medicationId,
      status: parsed.data.status,
    });
    return NextResponse.json({ log });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
