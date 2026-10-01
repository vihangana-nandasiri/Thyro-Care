import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  doctorProfiles,
  patientDoctorAssignments,
  patientProfiles,
  users,
} from "./schema";
import { hashPassword } from "@/lib/auth/password";

const password = process.env.SEED_DEMO_PASSWORD;

if (!password) {
  console.error("Set SEED_DEMO_PASSWORD to seed the demo accounts.");
  process.exit(1);
}

const passwordHash = await hashPassword(password);

async function upsertUser(
  email: string,
  role: "admin" | "doctor" | "patient",
) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        role,
        status: "active",
        mfaEnabled: false,
        mfaRequired: false,
        mfaSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({ email, passwordHash, role, mfaRequired: false })
    .returning();
  return created;
}

const adminOne = await upsertUser("admin.demo1@thyrocare.local", "admin");
await upsertUser("admin.demo2@thyrocare.local", "admin");

const doctorOne = await upsertUser("doctor.demo1@thyrocare.local", "doctor");
const doctorTwo = await upsertUser("doctor.demo2@thyrocare.local", "doctor");

await db
  .insert(doctorProfiles)
  .values({ userId: doctorOne.id, name: "Dr. Anjali Perera", specialty: "Endocrinology" })
  .onConflictDoUpdate({
    target: doctorProfiles.userId,
    set: { name: "Dr. Anjali Perera", specialty: "Endocrinology" },
  });
await db
  .insert(doctorProfiles)
  .values({ userId: doctorTwo.id, name: "Dr. Kavin Raj", specialty: "Oncology" })
  .onConflictDoUpdate({
    target: doctorProfiles.userId,
    set: { name: "Dr. Kavin Raj", specialty: "Oncology" },
  });

const now = new Date();
const patientOne = await upsertUser("patient.demo1@thyrocare.local", "patient");
const patientTwo = await upsertUser("patient.demo2@thyrocare.local", "patient");

await db
  .insert(patientProfiles)
  .values({
    userId: patientOne.id,
    name: "Meena Sivarajah",
    languagePref: "ta",
    treatmentStage: "Post-thyroidectomy follow-up",
    consentAt: now,
    disclaimerAckAt: now,
  })
  .onConflictDoUpdate({
    target: patientProfiles.userId,
    set: {
      name: "Meena Sivarajah",
      languagePref: "ta",
      treatmentStage: "Post-thyroidectomy follow-up",
      updatedAt: now,
    },
  });
await db
  .insert(patientProfiles)
  .values({
    userId: patientTwo.id,
    name: "Nimali Jayasinghe",
    languagePref: "si",
    treatmentStage: "Routine surveillance",
    consentAt: now,
    disclaimerAckAt: now,
  })
  .onConflictDoUpdate({
    target: patientProfiles.userId,
    set: {
      name: "Nimali Jayasinghe",
      languagePref: "si",
      treatmentStage: "Routine surveillance",
      updatedAt: now,
    },
  });

for (const [patientId, doctorId] of [
  [patientOne.id, doctorOne.id],
  [patientTwo.id, doctorTwo.id],
] as const) {
  const existing = await db.query.patientDoctorAssignments.findFirst({
    where: and(
      eq(patientDoctorAssignments.patientId, patientId),
      eq(patientDoctorAssignments.doctorId, doctorId),
    ),
  });

  if (!existing) {
    await db.insert(patientDoctorAssignments).values({
      patientId,
      doctorId,
      assignedBy: adminOne.id,
    });
  }
}

console.log("Demo accounts are ready:");
console.log("  admin.demo1@thyrocare.local, admin.demo2@thyrocare.local");
console.log("  doctor.demo1@thyrocare.local, doctor.demo2@thyrocare.local");
console.log("  patient.demo1@thyrocare.local, patient.demo2@thyrocare.local");
process.exit(0);
