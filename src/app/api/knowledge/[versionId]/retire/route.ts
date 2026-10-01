import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { retire } from "@/lib/services/knowledge";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const schema = z.object({ reason: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  let session;
  try {
    session = await requireRole("admin", "doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { versionId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  try {
    const version = await retire(versionId, session.sub, parsed.data.reason);
    await recordAuditEvent(session.sub, "knowledge_retire", "knowledge_version", versionId);
    return NextResponse.json({ version });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
