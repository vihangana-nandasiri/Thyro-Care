import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { decideResource, editResource, deleteResource } from "@/lib/services/resources";
import { resourceInput } from "@/lib/resources/types";
import { recordAuditEvent } from "@/lib/audit";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole("admin", "doctor");
    const { id } = await params;
    const parsed = z
      .union([z.object({ status: z.enum(["approved", "rejected", "pending"]), version: z.number().int().positive() }),z.object({ resource: resourceInput, version: z.number().int().positive() })])
      .safeParse(await req.json());
    if (!z.string().uuid().safeParse(id).success || !parsed.success)
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const resource = "resource" in parsed.data ? await editResource(user.sub,id,parsed.data.resource,parsed.data.version) : await decideResource(user.sub, id, parsed.data.status,parsed.data.version);
    await recordAuditEvent(
      user.sub,
      "resource" in parsed.data ? "resource_edited" : `resource_${parsed.data.status}`,
      "educational_resource",
      id,
    );
    return NextResponse.json({ resource });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to update resource" },
      {
        status:
          e instanceof ConflictError ? 409 : e instanceof ForbiddenError
            ? 403
            : e instanceof NotFoundError
              ? 404
              : 503,
      },
    );
  }
}

export async function DELETE(req: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    const user = await requireRole("admin"); const {id} = await params;
    const body = z.object({version:z.number().int().positive()}).safeParse(await req.json());
    if (!body.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({error:"Invalid request"},{status:400});
    await deleteResource(user.sub,id,body.data.version);
    await recordAuditEvent(user.sub,"resource_deleted","educational_resource",id);
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:"Unable to delete resource"},{status:e instanceof ForbiddenError?403:e instanceof ConflictError?409:503}); }
}
