// ponytail: manual-test cleanup helper, not part of the app. Deletes any
// account whose email matches the e2e-test convention used in this repo's
// manual verification steps ("+e2e@" or "e2e-*@").
import { like, or, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  users,
  patientProfiles,
  doctorProfiles,
  patientDoctorAssignments,
  passwordResetTokens,
  auditEvents,
  medications,
  doseLogs,
  symptoms,
  medicalReports,
  chatSessions,
  chatMessages,
} from "./schema";

const rows = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(or(like(users.email, "%+e2e@%"), like(users.email, "e2e-%@%")));

const ids = rows.map((r) => r.id);
if (ids.length) {
  const meds = await db
    .select({ id: medications.id })
    .from(medications)
    .where(or(inArray(medications.patientId, ids), inArray(medications.prescribedBy, ids)));
  const medIds = meds.map((m) => m.id);
  if (medIds.length) {
    await db.delete(doseLogs).where(inArray(doseLogs.medicationId, medIds));
    await db.delete(medications).where(inArray(medications.id, medIds));
  }
  await db.delete(symptoms).where(inArray(symptoms.patientId, ids));
  await db.delete(medicalReports).where(inArray(medicalReports.patientId, ids));
  const sessions = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(inArray(chatSessions.patientId, ids));
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length) {
    await db.delete(chatMessages).where(inArray(chatMessages.sessionId, sessionIds));
  }
  await db.delete(chatSessions).where(inArray(chatSessions.patientId, ids));
  await db.delete(auditEvents).where(inArray(auditEvents.actorId, ids));
  await db.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, ids));
  await db.delete(patientDoctorAssignments).where(inArray(patientDoctorAssignments.patientId, ids));
  await db.delete(patientDoctorAssignments).where(inArray(patientDoctorAssignments.doctorId, ids));
  await db.delete(patientProfiles).where(inArray(patientProfiles.userId, ids));
  await db.delete(doctorProfiles).where(inArray(doctorProfiles.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}
console.log(
  "cleaned up",
  rows.map((r) => r.email),
);
process.exit(0);
