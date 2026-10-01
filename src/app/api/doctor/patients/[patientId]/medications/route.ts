import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { createMedication, listMedications } from "@/lib/services/medications";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError } from "@/lib/errors";

const schema = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().min(1).max(100),
  unit: z.string().min(1).max(50),
  frequency: z.string().min(1).max(200),
  timesOfDay: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  timezone: z.string().min(1),
  instructions: z.string().max(2000).optional(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  let session;
  try {
    session = await requireRole("doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { patientId } = await params;
  try {
    await assertDoctorAssignedToPatient(session.sub, patientId);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const meds = await listMedications(patientId);
  return NextResponse.json({ medications: meds });
}

export async function POST(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  let session;
  try {
    session = await requireRole("doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { patientId } = await params;
  try {
    await assertDoctorAssignedToPatient(session.sub, patientId);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const medication = await createMedication(session.sub, patientId, parsed.data);
  await recordAuditEvent(session.sub, "create_medication", "medication", medication.id, {
    patientId,
  });
  return NextResponse.json({ medication });
}
