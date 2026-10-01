import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const safetyLevelEnum = pgEnum("safety_level", [
  "routine",
  "monitor",
  "urgent",
  "emergency",
]);
export const symptomStatusEnum = pgEnum("symptom_status", [
  "open",
  "reviewed",
  "resolved",
]);

export const symptoms = pgTable("symptoms", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => users.id),
  symptomType: text("symptom_type").notNull(),
  severity: text("severity").notNull(),
  description: text("description"),
  safetyAnswers: jsonb("safety_answers").$type<Record<string, unknown>>().notNull(),
  safetyLevel: safetyLevelEnum("safety_level").notNull(),
  safetyRuleVersion: integer("safety_rule_version").notNull(),
  status: symptomStatusEnum("status").notNull().default("open"),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
