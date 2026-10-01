import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { discoverResources, isSerperEnabled } from "@/lib/resources/serper";
import { isRateLimited } from "@/lib/rate-limit";
export async function POST(req: Request) {
  try {
    const user = await requireRole("admin");
    const parsed = z
      .object({
        query: z.string().trim().min(2).max(200),
        kind: z.enum(["article", "news", "video"]),
        language: z.enum(["en", "si", "ta"]),
      })
      .safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid search" }, { status: 400 });
    if (!isSerperEnabled())
      return NextResponse.json({ enabled: false, results: [] });
    if (isRateLimited(`discover:${user.sub}`, 40, 3600000))
      return NextResponse.json(
        { error: "Search limit reached" },
        { status: 429 },
      );
    const { query, kind, language } = parsed.data;
    return NextResponse.json({
      enabled: true,
      results: await discoverResources(query, kind, language),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Search is temporarily unavailable" },
      { status: e instanceof ForbiddenError ? 403 : 503 },
    );
  }
}
