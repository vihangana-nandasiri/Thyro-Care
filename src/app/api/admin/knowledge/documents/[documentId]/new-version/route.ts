import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { createNewVersionFromApproved } from "@/lib/services/knowledge";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const schema = z.object({ content: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { documentId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  try {
    const version = await createNewVersionFromApproved(session.sub, documentId, parsed.data.content);
    await recordAuditEvent(session.sub, "create_knowledge_version", "knowledge_version", version!.id, {
      documentId,
    });
    return NextResponse.json({ version });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
