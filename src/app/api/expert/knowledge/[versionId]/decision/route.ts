import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { approve, reject, requestChanges } from "@/lib/services/knowledge";
import { recordAuditEvent } from "@/lib/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), expectedContentHash: z.string() }),
  z.object({ action: z.literal("reject"), comment: z.string().min(1) }),
  z.object({ action: z.literal("request_changes"), comment: z.string().min(1) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  let session;
  try {
    session = await requireRole("doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const { versionId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  try {
    const version =
      parsed.data.action === "approve"
        ? await approve(versionId, session.sub, parsed.data.expectedContentHash)
        : parsed.data.action === "reject"
          ? await reject(versionId, session.sub, parsed.data.comment)
          : await requestChanges(versionId, session.sub, parsed.data.comment);

    await recordAuditEvent(session.sub, `knowledge_${parsed.data.action}`, "knowledge_version", versionId);
    return NextResponse.json({ version });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
