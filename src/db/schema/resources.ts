import { pgTable, uuid, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { languageEnum } from "./patients";
export const resourceKindEnum = pgEnum("resource_kind", [
  "article",
  "news",
  "video",
]);
export const resourceStatusEnum = pgEnum("resource_status", [
  "pending",
  "approved",
  "rejected",
]);
export const educationalResources = pgTable("educational_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  kind: resourceKindEnum("kind").notNull(),
  language: languageEnum("language").notNull().default("en"),
  status: resourceStatusEnum("status").notNull().default("pending"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  doctorApprovedBy: uuid("doctor_approved_by").references(() => users.id),
  doctorApprovedAt: timestamp("doctor_approved_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
