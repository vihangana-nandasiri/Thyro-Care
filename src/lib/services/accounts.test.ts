import { test, expect } from "bun:test";
import { createDoctorAccount } from "./accounts";
import { verifyPassword } from "@/lib/auth/password";

test("createDoctorAccount generates a temp password that verifies against the stored hash", async () => {
  const email = `doctor.${Date.now()}@example.com`;
  const { user, tempPassword } = await createDoctorAccount({ name: "Dr. Test", email });
  expect(user.role).toBe("doctor");
  expect(await verifyPassword(tempPassword, user.passwordHash)).toBe(true);

  const { db } = await import("@/db");
  const { users, doctorProfiles } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(doctorProfiles).where(eq(doctorProfiles.userId, user.id));
  await db.delete(users).where(eq(users.id, user.id));
});
