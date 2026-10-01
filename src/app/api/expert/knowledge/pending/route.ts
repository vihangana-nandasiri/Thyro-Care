import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { listPendingReview } from "@/lib/services/knowledge";
import { ForbiddenError } from "@/lib/errors";

export async function GET() {
  try {
    await requireRole("doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const versions = await listPendingReview();
  return NextResponse.json({ versions });
}
