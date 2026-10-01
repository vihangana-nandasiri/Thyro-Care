import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listReports } from "@/lib/services/reports";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { ForbiddenError } from "@/lib/errors";

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
  const reports = await listReports(patientId);
  return NextResponse.json({ reports });
}
