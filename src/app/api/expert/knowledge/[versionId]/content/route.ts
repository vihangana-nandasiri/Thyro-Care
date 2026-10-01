import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { editPendingContent } from "@/lib/services/knowledge";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit";
export async function PATCH(req:Request,{params}:{params:Promise<{versionId:string}>}) {
  try {const user=await requireRole("doctor");const {versionId}=await params;
    const input=z.object({content:z.string().trim().min(1).max(50000),expectedContentHash:z.string().length(64)}).safeParse(await req.json());
    if(!input.success||!z.string().uuid().safeParse(versionId).success)return NextResponse.json({error:"Invalid input"},{status:400});
    const version=await editPendingContent(versionId,user.sub,input.data.content,input.data.expectedContentHash);
    await recordAuditEvent(user.sub,"doctor_edit_knowledge","knowledge_version",versionId);
    return NextResponse.json({version});
  }catch(e){return NextResponse.json({error:"Unable to save. Reload before trying again."},{status:e instanceof ForbiddenError?403:e instanceof ConflictError?409:503});}
}
