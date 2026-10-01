import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { updateMedication, softDeleteMedication } from "@/lib/services/medications";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { recordAuditEvent } from "@/lib/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  dose: z.string().min(1).max(100).optional(),
  unit: z.string().min(1).max(50).optional(),
  frequency: z.string().min(1).max(200).optional(),
  timesOfDay: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).optional(),
  timezone: z.string().min(1).optional(),
  instructions: z.string().max(2000).optional(),
  endDate: z.string().nullable().optional(),
  expectedVersion: z.number().int().positive(),
});

async function guard(patientId: string) {
  const session = await requireRole("doctor");
  await assertDoctorAssignedToPatient(session.sub, patientId);
  return session;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ patientId: string; medicationId: string }> },
) {
  const { patientId, medicationId } = await params;
  let session;
  try {
    session = await guard(patientId);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { expectedVersion, ...patch } = parsed.data;
  try {
    const medication = await updateMedication(medicationId, patch, expectedVersion, session.sub);
    await recordAuditEvent(session.sub, "update_medication", "medication", medicationId, {});
    return NextResponse.json({ medication });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ patientId: string; medicationId: string }> },
) {
  const { patientId, medicationId } = await params;
  let session;
  try {
    session = await guard(patientId);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  try {
    await softDeleteMedication(medicationId, session.sub);
    await recordAuditEvent(session.sub, "delete_medication", "medication", medicationId, {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
