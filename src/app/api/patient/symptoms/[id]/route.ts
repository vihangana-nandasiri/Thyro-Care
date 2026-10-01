import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { updateSymptomStatus, softDeleteSymptom } from "@/lib/services/symptoms";
import { recordAuditEvent } from "@/lib/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

const schema = z.object({
  status: z.enum(["open", "reviewed", "resolved"]),
  expectedVersion: z.number().int().positive(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  try {
    const symptom = await updateSymptomStatus(id, session.sub, parsed.data.status, parsed.data.expectedVersion);
    await recordAuditEvent(session.sub, "update_symptom_status", "symptom", id, {
      status: parsed.data.status,
    });
    return NextResponse.json({ symptom });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { id } = await params;
  try {
    await softDeleteSymptom(id, session.sub);
    await recordAuditEvent(session.sub, "delete_symptom", "symptom", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
