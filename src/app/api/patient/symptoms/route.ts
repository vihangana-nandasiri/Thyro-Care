import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { recordSymptom, listSymptoms } from "@/lib/services/symptoms";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError } from "@/lib/errors";

const safetyAnswersSchema = z.object({
  severeBreathingDifficulty: z.boolean().optional(),
  suddenNeckSwelling: z.boolean().optional(),
  severeUncontrolledBleeding: z.boolean().optional(),
  chestPainOrPalpitations: z.boolean().optional(),
  severeMuscleCrampsOrTingling: z.boolean().optional(),
  moderateSwallowingDifficulty: z.boolean().optional(),
  feverOver38: z.boolean().optional(),
  persistentHoarsenessOrVoiceChange: z.boolean().optional(),
  woundRednessOrDischarge: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const schema = z.object({
  symptomType: z.string().min(1).max(200),
  severity: z.string().min(1).max(50),
  description: z.string().max(2000).optional(),
  safetyAnswers: safetyAnswersSchema,
});

export async function GET() {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const rows = await listSymptoms(session.sub);
  return NextResponse.json({ symptoms: rows });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const symptom = await recordSymptom(session.sub, parsed.data);
  // Audit metadata never includes freeform description/notes (NFR-02) —
  // only the deterministic classification outcome.
  await recordAuditEvent(session.sub, "record_symptom", "symptom", symptom!.id, {
    safetyLevel: symptom!.safetyLevel,
  });
  return NextResponse.json({ symptom });
}
