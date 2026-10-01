import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patientProfiles } from "@/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { Lang } from "@/lib/i18n/config";

export async function getOwnProfile(userId: string) {
  const profile = await db.query.patientProfiles.findFirst({
    where: eq(patientProfiles.userId, userId),
  });
  if (!profile) throw new NotFoundError("Profile not found.");
  return profile;
}

export interface ProfilePatch {
  name?: string;
  phone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  dob?: string | null;
  treatmentStage?: string | null;
  languagePref?: Lang;
}

/**
 * consentAt/disclaimerAckAt are intentionally not accepted here (FR-02.3) —
 * ProfilePatch has no field for them, so there is no code path that could
 * overwrite them through a profile update.
 */
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
  expectedVersion: number,
) {
  const [updated] = await db
    .update(patientProfiles)
    .set({ ...patch, version: expectedVersion + 1, updatedAt: new Date() })
    .where(
      and(eq(patientProfiles.userId, userId), eq(patientProfiles.version, expectedVersion)),
    )
    .returning();

  if (!updated) {
    const current = await db.query.patientProfiles.findFirst({
      where: eq(patientProfiles.userId, userId),
    });
    if (!current) throw new NotFoundError("Profile not found.");
    throw new ConflictError();
  }
  return updated;
}

export function completenessScore(profile: {
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  dob: string | null;
  treatmentStage: string | null;
}): number {
  const fields = [
    profile.phone,
    profile.emergencyContactName,
    profile.emergencyContactPhone,
    profile.dob,
    profile.treatmentStage,
  ];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}
