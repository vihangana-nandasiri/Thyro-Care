import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const doseStatusEnum = pgEnum("dose_status", [
  "taken",
  "missed",
  "skipped",
]);

export const medications = pgTable("medications", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => users.id),
  prescribedBy: uuid("prescribed_by")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  dose: text("dose").notNull(),
  unit: text("unit").notNull(),
  frequency: text("frequency").notNull(),
  /** Array of "HH:mm" strings, interpreted in `timezone`. */
  timesOfDay: jsonb("times_of_day").$type<string[]>().notNull(),
  timezone: text("timezone").notNull().default("Asia/Colombo"),
  instructions: text("instructions"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const doseLogs = pgTable(
  "dose_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    medicationId: uuid("medication_id")
      .notNull()
      .references(() => medications.id),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: doseStatusEnum("status").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.medicationId, t.scheduledFor)],
);
