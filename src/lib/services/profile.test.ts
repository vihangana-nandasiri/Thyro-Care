import { test, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, patientProfiles } from "@/db/schema";
import { updateProfile } from "./profile";
import { ConflictError } from "@/lib/errors";

async function createTestPatient() {
  const [user] = await db
    .insert(users)
    .values({
      email: `profile-test.${Date.now()}@example.com`,
      passwordHash: "x",
      role: "patient",
    })
    .returning();
  const now = new Date();
  await db.insert(patientProfiles).values({
    userId: user.id,
    name: "Original Name",
    consentAt: now,
    disclaimerAckAt: now,
  });
  return user.id;
}

async function cleanup(userId: string) {
  await db.delete(patientProfiles).where(eq(patientProfiles.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

test("updateProfile with a stale version throws ConflictError and leaves the row unchanged", async () => {
  const userId = await createTestPatient();
  try {
    await updateProfile(userId, { name: "New Name" }, 1);

    await expect(updateProfile(userId, { name: "Stale Update" }, 1)).rejects.toThrow(
      ConflictError,
    );

    const current = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.userId, userId),
    });
    expect(current?.name).toBe("New Name");
    expect(current?.version).toBe(2);
  } finally {
    await cleanup(userId);
  }
});

test("updateProfile never touches consentAt or disclaimerAckAt", async () => {
  const userId = await createTestPatient();
  try {
    const before = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.userId, userId),
    });
    await updateProfile(userId, { name: "Updated" }, 1);
    const after = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.userId, userId),
    });
    expect(after?.consentAt.getTime()).toBe(before!.consentAt.getTime());
    expect(after?.disclaimerAckAt.getTime()).toBe(before!.disclaimerAckAt.getTime());
  } finally {
    await cleanup(userId);
  }
});
