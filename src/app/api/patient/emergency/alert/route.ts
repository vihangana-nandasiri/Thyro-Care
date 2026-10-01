import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError } from "@/lib/errors";

const schema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

/** The explicit "I'm having an emergency" toggle on the emergency page —
 * unlike just opening the page, this is a deliberate patient action, so it
 * is what actually alerts the care team (with location, if shared). */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  await recordAuditEvent(session.sub, "emergency_triggered", "user", session.sub, {
    lat: parsed.data.lat ?? null,
    lng: parsed.data.lng ?? null,
  });
  return NextResponse.json({ ok: true });
}
