import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { updateAlertStatus, getAlertPatientId, ALERT_STATUSES } from "@/lib/services/audit";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const schema = z.object({ status: z.enum(ALERT_STATUSES) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireRole("doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  try {
    const patientId = await getAlertPatientId(id);
    if (!patientId) return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    await assertDoctorAssignedToPatient(session.sub, patientId);
    await updateAlertStatus(id, parsed.data.status);
    await recordAuditEvent(session.sub, "update_alert_status", "audit_event", id, {
      status: parsed.data.status,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
