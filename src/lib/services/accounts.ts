import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, doctorProfiles, patientDoctorAssignments, patientProfiles } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

function generateTempPassword(): string {
  return randomBytes(9).toString("base64url"); // 12 chars, url-safe
}

export interface CreateDoctorInput {
  name: string;
  email: string;
  specialty?: string;
}

export async function createDoctorAccount(input: CreateDoctorInput) {
  const email = input.email.toLowerCase().trim();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw new ValidationError("That email is already registered.");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, role: "doctor" })
    .returning();
  await db.insert(doctorProfiles).values({
    userId: user.id,
    name: input.name,
    specialty: input.specialty,
  });
  return { user, tempPassword };
}

export async function assignDoctorToPatient(
  patientId: string,
  doctorId: string,
  assignedBy: string,
) {
  const [patient, doctor] = await Promise.all([
    db.query.patientProfiles.findFirst({ where: eq(patientProfiles.userId, patientId) }),
    db.query.doctorProfiles.findFirst({ where: eq(doctorProfiles.userId, doctorId) }),
  ]);
  if (!patient) throw new NotFoundError("Patient not found.");
  if (!doctor) throw new NotFoundError("Doctor not found.");

  const existing = await db.query.patientDoctorAssignments.findFirst({
    where: and(
      eq(patientDoctorAssignments.patientId, patientId),
      eq(patientDoctorAssignments.doctorId, doctorId),
    ),
  });
  if (existing) return existing;

  const [assignment] = await db
    .insert(patientDoctorAssignments)
    .values({ patientId, doctorId, assignedBy })
    .returning();
  return assignment;
}

export async function assertDoctorAssignedToPatient(doctorId: string, patientId: string) {
  const assignment = await db.query.patientDoctorAssignments.findFirst({
    where: and(
      eq(patientDoctorAssignments.doctorId, doctorId),
      eq(patientDoctorAssignments.patientId, patientId),
    ),
  });
  if (!assignment) throw new ForbiddenError("Not allowed for this patient.");
}

export async function listAccounts() {
  return db.query.users.findMany({
    columns: { id: true, email: true, role: true, status: true, createdAt: true },
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });
}

export async function listPatientsWithAssignments() {
  const patients = await db
    .select({
      userId: patientProfiles.userId,
      name: patientProfiles.name,
    })
    .from(patientProfiles);

  const assignments = await db.select().from(patientDoctorAssignments);

  return patients.map((p) => ({
    ...p,
    doctorIds: assignments.filter((a) => a.patientId === p.userId).map((a) => a.doctorId),
  }));
}

export async function listAssignedPatients(doctorId: string) {
  const assignments = await db
    .select({ patientId: patientDoctorAssignments.patientId })
    .from(patientDoctorAssignments)
    .where(eq(patientDoctorAssignments.doctorId, doctorId));
  const ids = assignments.map((a) => a.patientId);
  if (ids.length === 0) return [];
  const patients = await db.query.patientProfiles.findMany({
    where: (p, { inArray }) => inArray(p.userId, ids),
  });
  return patients;
}

export async function listDoctors() {
  return db
    .select({ userId: doctorProfiles.userId, name: doctorProfiles.name, specialty: doctorProfiles.specialty })
    .from(doctorProfiles);
}
