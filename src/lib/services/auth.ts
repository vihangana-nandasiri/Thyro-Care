import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, patientProfiles, passwordResetTokens } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ValidationError, NotFoundError } from "@/lib/errors";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export interface RegisterPatientInput {
  name: string;
  email: string;
  password: string;
  consent: boolean;
  disclaimerAck: boolean;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export async function registerPatient(input: RegisterPatientInput) {
  if (!input.consent || !input.disclaimerAck) {
    throw new ValidationError(
      "Consent and disclaimer acknowledgement are required.",
    );
  }
  const email = input.email.toLowerCase().trim();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    throw new ValidationError("That email is already registered.");
  }
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash, role: "patient" })
      .returning();
    await tx.insert(patientProfiles).values({
      userId: user.id,
      name: input.name,
      phone: input.phone,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      consentAt: now,
      disclaimerAckAt: now,
    });
    return user;
  });
}

export async function authenticateWithPassword(
  email: string,
  password: string,
) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  });
  if (!user || user.status !== "active") throw new InvalidCredentialsError();
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new InvalidCredentialsError();
  return user;
}

export async function startMfaEnrollment(userId: string, secret: string) {
  await db.update(users).set({ mfaSecret: secret }).where(eq(users.id, userId));
}

export async function confirmMfaEnrollment(userId: string) {
  await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, userId));
}

export async function issuePasswordResetToken(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
  });
  // Always do the same hashing work whether or not the account exists, so
  // response timing doesn't leak account existence (NFR-01).
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (!user) return null;
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  return token;
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new NotFoundError("Reset link is invalid or expired.");
  }
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, record.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, record.id));
  return record.userId;
}
