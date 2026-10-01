import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { users } from "./users";

export const doctorProfiles = pgTable("doctor_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  name: text("name").notNull(),
  specialty: text("specialty"),
});
