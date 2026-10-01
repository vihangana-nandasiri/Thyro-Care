import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

export const patientDoctorAssignments = pgTable(
  "patient_doctor_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => users.id),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.patientId, t.doctorId)],
);
