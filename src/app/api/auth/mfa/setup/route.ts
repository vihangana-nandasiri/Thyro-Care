import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyMfaSetup } from "@/lib/auth/jwt";
import { generateMfaSecret, qrDataUrl, verifyMfaToken } from "@/lib/auth/mfa";
import { createSession } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit";
import * as OTPAuth from "otpauth";

const schema=z.object({challengeToken:z.string(),code:z.string().regex(/^\d{6}$/).optional()});
async function handle(req:Request,confirm:boolean) {
  try {
    const input=schema.safeParse(await req.json());
    if(!input.success || (confirm && !input.data.code))return NextResponse.json({error:"Invalid request"},{status:400});
    const {sub}=await verifyMfaSetup(input.data.challengeToken);
    if(isRateLimited(`mfa-setup:${sub}`,12,900000))return NextResponse.json({error:"Please try again later"},{status:429});
    let user=await db.query.users.findFirst({where:eq(users.id,sub)});
    if(!user || user.status!=="active" || user.mfaEnabled)return NextResponse.json({error:"Sign in again"},{status:401});
    if(!confirm) {
      if(!user.mfaSecret) {
        const {secret}=generateMfaSecret(user.email);
        await db.update(users).set({mfaSecret:secret}).where(and(eq(users.id,sub),eq(users.mfaEnabled,false),isNull(users.mfaSecret)));
        user=await db.query.users.findFirst({where:eq(users.id,sub)});
      }
      if(!user?.mfaSecret || user.mfaEnabled)return NextResponse.json({error:"Sign in again"},{status:401});
      const totp=new OTPAuth.TOTP({issuer:"ThyroCare AI",label:user.email,algorithm:"SHA1",digits:6,period:30,secret:OTPAuth.Secret.fromBase32(user.mfaSecret)});
      return NextResponse.json({qr:await qrDataUrl(totp.toString()),secret:user.mfaSecret});
    }
    if(!user.mfaSecret || !verifyMfaToken(user.mfaSecret,input.data.code!))return NextResponse.json({error:"Incorrect code"},{status:401});
    const [updated]=await db.update(users).set({mfaEnabled:true}).where(and(eq(users.id,sub),eq(users.status,"active"),eq(users.mfaEnabled,false),eq(users.mfaSecret,user.mfaSecret))).returning();
    if(!updated)return NextResponse.json({error:"Sign in again"},{status:401});
    await createSession(user.id,user.role);
    await recordAuditEvent(user.id,"mfa_enabled","user",user.id);
    return NextResponse.json({role:user.role});
  }catch{return NextResponse.json({error:"Enrollment expired or unavailable. Sign in again."},{status:401});}
}
export async function POST(req:Request){return handle(req,false);}
export async function PATCH(req:Request){return handle(req,true);}
