import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const languageEnum = pgEnum("language", ["en", "si", "ta"]);

export const patientProfiles = pgTable("patient_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  name: text("name").notNull(),
  phone: text("phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  dob: date("dob"),
  treatmentStage: text("treatment_stage"),
  languagePref: languageEnum("language_pref").notNull().default("en"),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  disclaimerAckAt: timestamp("disclaimer_ack_at", {
    withTimezone: true,
  }).notNull(),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
