import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getVersion, updateDraft, listReviewHistory } from "@/lib/services/knowledge";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  topic: z.string().min(1).max(200).optional(),
  language: z.enum(["en", "si", "ta"]).optional(),
  content: z.string().min(1).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    await requireRole("admin", "doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { versionId } = await params;
  try {
    const version = await getVersion(versionId);
    const history = await listReviewHistory(versionId);
    return NextResponse.json({ version, history });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { versionId } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  try {
    const version = await updateDraft(versionId, session.sub, parsed.data);
    await recordAuditEvent(session.sub, "update_knowledge_draft", "knowledge_version", versionId);
    return NextResponse.json({ version });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
