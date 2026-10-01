import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { softDeleteReport } from "@/lib/services/reports";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

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
    await softDeleteReport(id, session.sub);
    await recordAuditEvent(session.sub, "delete_report", "medical_report", id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
