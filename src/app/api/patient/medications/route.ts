import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listMedications, generateScheduleWithStatus, getAdherence } from "@/lib/services/medications";
import { ForbiddenError } from "@/lib/errors";

const RANGE_DAYS_PAST = 14;
const RANGE_DAYS_FUTURE = 7;

export async function GET() {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const meds = await listMedications(session.sub);
  const now = new Date();
  const rangeStart = new Date(now.getTime() - RANGE_DAYS_PAST * 86_400_000);
  const rangeEnd = new Date(now.getTime() + RANGE_DAYS_FUTURE * 86_400_000);

  const withSchedule = await Promise.all(
    meds.map(async (m) => ({
      medication: m,
      schedule: await generateScheduleWithStatus(m, rangeStart, rangeEnd),
      adherence: await getAdherence(m.id, session.sub),
    })),
  );
  return NextResponse.json({ medications: withSchedule });
}
