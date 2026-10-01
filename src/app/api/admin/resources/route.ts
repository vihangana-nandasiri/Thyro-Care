import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { isLang } from "@/lib/i18n/config";
import { resourceInput } from "@/lib/resources/types";
import { listResources, saveResource } from "@/lib/services/resources";
import { recordAuditEvent } from "@/lib/audit";
export async function GET(req: Request) {
  try {
    await requireRole("admin", "doctor");
    const value = new URL(req.url).searchParams.get("language") ?? "en";
    return NextResponse.json({
      resources: await listResources(isLang(value) ? value : "en", true),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to load resources" },
      { status: e instanceof ForbiddenError ? 403 : 503 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const user = await requireRole("admin");
    const input = resourceInput.safeParse(await req.json());
    if (!input.success)
      return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    const resource = await saveResource(user.sub, input.data);
    await recordAuditEvent(
      user.sub,
      "create_resource",
      "educational_resource",
      resource.id,
    );
    return NextResponse.json({ resource }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to save resource" },
      { status: e instanceof ForbiddenError ? 403 : 503 },
    );
  }
}
