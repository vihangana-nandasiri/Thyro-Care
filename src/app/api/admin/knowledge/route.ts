import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { createDraft, listDocuments } from "@/lib/services/knowledge";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError } from "@/lib/errors";

const schema = z.object({
  title: z.string().min(1).max(300),
  topic: z.string().min(1).max(200),
  language: z.enum(["en", "si", "ta"]),
  content: z.string().min(1),
});

export async function GET() {
  try {
    await requireRole("admin", "doctor");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const documents = await listDocuments();
  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { document, version } = await createDraft(session.sub, parsed.data);
  await recordAuditEvent(session.sub, "create_knowledge_draft", "knowledge_document", document.id);
  return NextResponse.json({ document, version });
}
