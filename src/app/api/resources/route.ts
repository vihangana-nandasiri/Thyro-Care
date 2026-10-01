import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { isLang } from "@/lib/i18n/config";
import { listResources } from "@/lib/services/resources";
export async function GET(req: Request) {
  try {
    await requireRole("patient", "doctor", "admin");
    const value = new URL(req.url).searchParams.get("language") ?? "en";
    return NextResponse.json({
      resources: await listResources(isLang(value) ? value : "en"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to load resources" },
      { status: e instanceof ForbiddenError ? 403 : 503 },
    );
  }
}
