import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { medications, doseLogs, type doseStatusEnum } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

type DoseStatus = (typeof doseStatusEnum.enumValues)[number];

export interface MedicationInput {
  name: string;
  dose: string;
  unit: string;
  frequency: string;
  timesOfDay: string[];
  timezone: string;
  instructions?: string;
  startDate: string;
  endDate?: string | null;
}

export async function createMedication(
  doctorId: string,
  patientId: string,
  input: MedicationInput,
) {
  const [medication] = await db
    .insert(medications)
    .values({ ...input, patientId, prescribedBy: doctorId })
    .returning();
  return medication;
}

export async function listMedications(patientId: string) {
  return db.query.medications.findMany({
    where: (m, { and, eq, isNull }) => and(eq(m.patientId, patientId), isNull(m.deletedAt)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function updateMedication(
  id: string,
  patch: Partial<MedicationInput>,
  expectedVersion: number,
  actorId: string,
) {
  const [updated] = await db
    .update(medications)
    .set({ ...patch, version: expectedVersion + 1, updatedAt: new Date() })
    .where(
      and(
        eq(medications.id, id),
        eq(medications.version, expectedVersion),
        eq(medications.prescribedBy, actorId),
      ),
    )
    .returning();
  if (!updated) {
    const current = await db.query.medications.findFirst({ where: eq(medications.id, id) });
    if (!current) throw new NotFoundError("Medication not found.");
    if (current.prescribedBy !== actorId) throw new NotFoundError("Medication not found.");
    throw new ConflictError();
  }
  return updated;
}

export async function softDeleteMedication(id: string, actorId: string) {
  const [updated] = await db
    .update(medications)
    .set({ deletedAt: new Date() })
    .where(and(eq(medications.id, id), eq(medications.prescribedBy, actorId)))
    .returning();
  if (!updated) throw new NotFoundError("Medication not found.");
  return updated;
}

/** Converts a wall-clock time in an IANA timezone to its UTC instant, using
 * only Intl (no date library) — see the round-trip trick documented inline. */
function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(asUtc)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  const diff = asIfUtc - asUtc;
  return new Date(asUtc - diff);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function generateSchedule(
  medication: Pick<MedicationInput, "timesOfDay" | "timezone" | "startDate" | "endDate">,
  rangeStart: Date,
  rangeEnd: Date,
): { scheduledFor: Date }[] {
  const clampStart = medication.startDate > toDateStr(rangeStart) ? medication.startDate : toDateStr(rangeStart);
  const rangeEndStr = toDateStr(rangeEnd);
  const clampEnd =
    medication.endDate && medication.endDate < rangeEndStr ? medication.endDate : rangeEndStr;

  const occurrences: { scheduledFor: Date }[] = [];
  for (let day = clampStart; day <= clampEnd; day = addDays(day, 1)) {
    for (const time of medication.timesOfDay) {
      const scheduledFor = zonedTimeToUtc(day, time, medication.timezone);
      if (scheduledFor >= rangeStart && scheduledFor <= rangeEnd) {
        occurrences.push({ scheduledFor });
      }
    }
  }
  return occurrences;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateStrInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** generateSchedule's occurrences merged with any logged status for that dose. */
export async function generateScheduleWithStatus(
  medication: Pick<MedicationInput, "timesOfDay" | "timezone" | "startDate" | "endDate"> & { id: string },
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ scheduledFor: Date; status: DoseStatus | null }[]> {
  const occurrences = generateSchedule(medication, rangeStart, rangeEnd);
  const logs = await db.query.doseLogs.findMany({
    where: eq(doseLogs.medicationId, medication.id),
  });
  const statusByTime = new Map(logs.map((l) => [l.scheduledFor.toISOString(), l.status]));
  return occurrences.map((o) => ({
    scheduledFor: o.scheduledFor,
    status: statusByTime.get(o.scheduledFor.toISOString()) ?? null,
  }));
}

export async function logDose(
  patientId: string,
  medicationId: string,
  scheduledFor: Date,
  status: DoseStatus,
) {
  const medication = await db.query.medications.findFirst({
    where: eq(medications.id, medicationId),
  });
  if (!medication || medication.patientId !== patientId) {
    throw new NotFoundError("Medication not found.");
  }
  if (dateStrInZone(scheduledFor, medication.timezone) > dateStrInZone(new Date(), medication.timezone)) {
    throw new ForbiddenError("Cannot log a dose scheduled for a future day.");
  }
  const [log] = await db
    .insert(doseLogs)
    .values({ medicationId, scheduledFor, status })
    .onConflictDoUpdate({
      target: [doseLogs.medicationId, doseLogs.scheduledFor],
      set: { status, loggedAt: new Date() },
    })
    .returning();
  return log;
}

export interface AdherenceCounts {
  taken: number;
  missed: number;
  skipped: number;
}

/** Pure: skipped occurrences are excluded from the denominator (FR-03.4). */
export function calculateAdherence(counts: AdherenceCounts): {
  taken: number;
  missed: number;
  skipped: number;
  eligible: number;
  adherencePct: number | null;
} {
  const eligible = counts.taken + counts.missed;
  const adherencePct = eligible === 0 ? null : Math.round((counts.taken / eligible) * 100);
  return { ...counts, eligible, adherencePct };
}

export async function getAdherence(medicationId: string, patientId: string) {
  const medication = await db.query.medications.findFirst({
    where: eq(medications.id, medicationId),
  });
  if (!medication || medication.patientId !== patientId) {
    throw new ForbiddenError("Not allowed.");
  }
  const logs = await db.query.doseLogs.findMany({
    where: eq(doseLogs.medicationId, medicationId),
  });
  const counts: AdherenceCounts = { taken: 0, missed: 0, skipped: 0 };
  for (const log of logs) counts[log.status] += 1;
  return calculateAdherence(counts);
}
