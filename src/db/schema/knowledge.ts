import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { languageEnum } from "./patients";

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "active",
  "retired",
]);
export const versionStatusEnum = pgEnum("version_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "changes_requested",
  "retired",
]);
export const reviewActionEnum = pgEnum("review_action", [
  "submit",
  "approve",
  "reject",
  "request_changes",
  "retire",
  "restore",
]);

/** Stored `tsvector`, generated from title+content on every write. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  currentVersionId: uuid("current_version_id"),
  status: documentStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const knowledgeVersions = pgTable(
  "knowledge_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id),
    versionNo: integer("version_no").notNull(),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    language: languageEnum("language").notNull().default("en"),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    status: versionStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id),
    decisionComment: text("decision_comment"),
    // Gemini's text-embedding-004 output dimension.
    embedding: vector("embedding", { dimensions: 768 }),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("knowledge_versions_search_idx").using("gin", t.searchVector)],
);

export const reviewHistory = pgTable("review_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id")
    .notNull()
    .references(() => knowledgeVersions.id),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  action: reviewActionEnum("action").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
