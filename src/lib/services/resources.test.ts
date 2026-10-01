import { expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { educationalResources, users } from "@/db/schema";
import {
  saveResource,
  decideResource,
  listResources,
  editResource,
  deleteResource,
} from "./resources";
test("resources require both approvals and editing resets them", async () => {
  const [admin, doctor] = await db
    .insert(users)
    .values([
      {
        email: `resource-admin.${crypto.randomUUID()}@example.com`,
        passwordHash: "x",
        role: "admin" as const,
      },
      {
        email: `resource-doctor.${crypto.randomUUID()}@example.com`,
        passwordHash: "x",
        role: "doctor" as const,
      },
    ])
    .returning();
  try {
    let r = await saveResource(admin.id, {
      title: "Review test",
      url: "https://www.thyroid.org/",
      description: "Test fixture",
      imageUrl: null,
      kind: "article",
      language: "ta",
    });
    r = await decideResource(admin.id, r.id, "approved", r.version);
    expect((await listResources("ta")).some((i) => i.id === r.id)).toBe(false);
    r = await decideResource(doctor.id, r.id, "approved", r.version);
    expect((await listResources("ta")).some((i) => i.id === r.id)).toBe(true);
    expect((await listResources("en")).some((i) => i.id === r.id)).toBe(false);
    const oldVersion = r.version;
    r = await editResource(
      doctor.id,
      r.id,
      { ...r, title: "Doctor corrected title" },
      r.version,
    );
    expect(r.approvedBy).toBeNull();
    expect(r.doctorApprovedBy).toBeNull();
    expect((await listResources("ta")).some((i) => i.id === r.id)).toBe(false);
    await expect(
      decideResource(admin.id, r.id, "approved", oldVersion),
    ).rejects.toThrow();
    await expect(deleteResource(doctor.id, r.id, r.version)).rejects.toThrow();
    await deleteResource(admin.id, r.id, r.version);
  } finally {
    await db
      .delete(educationalResources)
      .where(eq(educationalResources.createdBy, admin.id));
    await db.delete(users).where(inArray(users.id, [admin.id, doctor.id]));
  }
}, 120000);
