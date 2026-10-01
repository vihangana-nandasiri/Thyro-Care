import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { submitForReview } from "@/lib/services/knowledge";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { versionId } = await params;
  try {
    const version = await submitForReview(versionId, session.sub);
    await recordAuditEvent(session.sub, "submit_knowledge_version", "knowledge_version", versionId);
    return NextResponse.json({ version });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
