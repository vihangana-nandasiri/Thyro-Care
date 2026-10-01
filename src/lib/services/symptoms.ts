import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { symptoms, type symptomStatusEnum } from "@/db/schema";
import { assessSafety, SAFETY_RULE_VERSION, type SafetyAnswers } from "@/lib/safety/rules";
import { ConflictError, NotFoundError } from "@/lib/errors";

type SymptomStatus = (typeof symptomStatusEnum.enumValues)[number];

export interface SymptomInput {
  symptomType: string;
  severity: string;
  description?: string;
  safetyAnswers: SafetyAnswers;
}

export async function recordSymptom(patientId: string, input: SymptomInput) {
  const safetyLevel = assessSafety(input.safetyAnswers);
  const [symptom] = await db
    .insert(symptoms)
    .values({
      patientId,
      symptomType: input.symptomType,
      severity: input.severity,
      description: input.description,
      safetyAnswers: input.safetyAnswers as Record<string, unknown>,
      safetyLevel,
      safetyRuleVersion: SAFETY_RULE_VERSION,
    })
    .returning();
  return symptom;
}

export async function listSymptoms(patientId: string) {
  return db.query.symptoms.findMany({
    where: and(eq(symptoms.patientId, patientId), isNull(symptoms.deletedAt)),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });
}

export async function updateSymptomStatus(
  id: string,
  patientId: string,
  status: SymptomStatus,
  expectedVersion: number,
) {
  const [updated] = await db
    .update(symptoms)
    .set({ status, version: expectedVersion + 1 })
    .where(
      and(eq(symptoms.id, id), eq(symptoms.patientId, patientId), eq(symptoms.version, expectedVersion)),
    )
    .returning();
  if (!updated) {
    const current = await db.query.symptoms.findFirst({
      where: and(eq(symptoms.id, id), eq(symptoms.patientId, patientId)),
    });
    if (!current) throw new NotFoundError("Symptom not found.");
    throw new ConflictError();
  }
  return updated;
}

export async function softDeleteSymptom(id: string, patientId: string) {
  const [updated] = await db
    .update(symptoms)
    .set({ deletedAt: new Date() })
    .where(and(eq(symptoms.id, id), eq(symptoms.patientId, patientId)))
    .returning();
  if (!updated) throw new NotFoundError("Symptom not found.");
  return updated;
}
