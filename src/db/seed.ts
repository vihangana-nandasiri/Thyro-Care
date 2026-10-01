import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { hashPassword } from "@/lib/auth/password";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@thyrocare.local";
const password = process.env.SEED_ADMIN_PASSWORD;

if (!password) {
  console.error("Set SEED_ADMIN_PASSWORD to seed the initial admin account.");
  process.exit(1);
}

const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
if (existing) {
  console.log(`Admin account already exists: ${email}`);
  process.exit(0);
}

const passwordHash = await hashPassword(password);
const [admin] = await db
  .insert(users)
  .values({ email, passwordHash, role: "admin" })
  .returning();

console.log(`Created admin account ${admin.email} (${admin.id})`);
process.exit(0);
