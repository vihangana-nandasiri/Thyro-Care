import { test, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, medications, doseLogs } from "@/db/schema";
import { generateSchedule, calculateAdherence, createMedication, logDose } from "./medications";
import { ForbiddenError } from "@/lib/errors";

test("generateSchedule expands twice-daily over 3 days into 6 occurrences", () => {
  const occ = generateSchedule(
    {
      timesOfDay: ["08:00", "20:00"],
      timezone: "Asia/Colombo",
      startDate: "2026-01-01",
      endDate: "2026-01-03",
    },
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-01-04T00:00:00Z"),
  );
  expect(occ.length).toBe(6);
});

test("generateSchedule respects the medication's own start/end bounds", () => {
  const occ = generateSchedule(
    {
      timesOfDay: ["09:00"],
      timezone: "UTC",
      startDate: "2026-01-02",
      endDate: "2026-01-02",
    },
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-01-05T00:00:00Z"),
  );
  expect(occ.length).toBe(1);
  expect(occ[0].scheduledFor.toISOString()).toBe("2026-01-02T09:00:00.000Z");
});

test("generateSchedule converts a non-UTC timezone correctly", () => {
  // Asia/Colombo is UTC+5:30, so 08:00 local is 02:30 UTC.
  const occ = generateSchedule(
    { timesOfDay: ["08:00"], timezone: "Asia/Colombo", startDate: "2026-01-01", endDate: "2026-01-01" },
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-01-01T23:59:59Z"),
  );
  expect(occ[0].scheduledFor.toISOString()).toBe("2026-01-01T02:30:00.000Z");
});

test("calculateAdherence excludes skipped occurrences from the denominator", () => {
  const result = calculateAdherence({ taken: 3, missed: 1, skipped: 1 });
  expect(result.eligible).toBe(4);
  expect(result.adherencePct).toBe(75);
});

test("calculateAdherence returns null percentage when nothing is eligible yet", () => {
  const result = calculateAdherence({ taken: 0, missed: 0, skipped: 2 });
  expect(result.eligible).toBe(0);
  expect(result.adherencePct).toBeNull();
});

test("logDose rejects a dose scheduled for a future day, and accepts today's", async () => {
  const [patient] = await db
    .insert(users)
    .values({ email: `dose-test.${Date.now()}@example.com`, passwordHash: "x", role: "patient" })
    .returning();
  const [doctor] = await db
    .insert(users)
    .values({ email: `dose-doctor.${Date.now()}@example.com`, passwordHash: "x", role: "doctor" })
    .returning();
  const today = new Date().toISOString().slice(0, 10);
  const medication = await createMedication(doctor.id, patient.id, {
    name: "Levothyroxine",
    dose: "50",
    unit: "mcg",
    frequency: "once daily",
    timesOfDay: ["08:00"],
    timezone: "UTC",
    startDate: today,
  });
  try {
    const tomorrow = new Date(Date.now() + 86_400_000);
    await expect(logDose(patient.id, medication!.id, tomorrow, "taken")).rejects.toThrow(
      ForbiddenError,
    );
    const now = new Date();
    const log = await logDose(patient.id, medication!.id, now, "taken");
    expect(log!.status).toBe("taken");
  } finally {
    await db.delete(doseLogs).where(eq(doseLogs.medicationId, medication!.id));
    await db.delete(medications).where(eq(medications.id, medication!.id));
    await db.delete(users).where(eq(users.id, patient.id));
    await db.delete(users).where(eq(users.id, doctor.id));
  }
});
