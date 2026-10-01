import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { uploadReport, listReports } from "@/lib/services/reports";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, ValidationError } from "@/lib/errors";

export async function GET() {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const reports = await listReports(session.sub);
  return NextResponse.json({ reports });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const report = await uploadReport(session.sub, file.name, file.type, bytes);
    await recordAuditEvent(session.sub, "upload_report", "medical_report", report!.id, {
      filename: file.name,
    });
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
