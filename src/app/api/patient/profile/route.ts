import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getOwnProfile, updateProfile, completenessScore } from "@/lib/services/profile";
import { recordAuditEvent } from "@/lib/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).nullable().optional(),
  emergencyContactName: z.string().max(200).nullable().optional(),
  emergencyContactPhone: z.string().max(50).nullable().optional(),
  dob: z.string().nullable().optional(),
  treatmentStage: z.string().max(200).nullable().optional(),
  languagePref: z.enum(["en", "si", "ta"]).optional(),
  expectedVersion: z.number().int().positive(),
});

export async function GET() {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
  const profile = await getOwnProfile(session.sub);
  return NextResponse.json({ profile, completeness: completenessScore(profile) });
}

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { expectedVersion, ...patch } = parsed.data;
  try {
    const profile = await updateProfile(session.sub, patch, expectedVersion);
    await recordAuditEvent(session.sub, "update_profile", "patient_profile", session.sub);
    return NextResponse.json({ profile, completeness: completenessScore(profile) });
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
