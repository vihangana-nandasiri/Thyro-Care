import { NextResponse } from "next/server";
import { z } from "zod";
import { registerPatient } from "@/lib/services/auth";
import { signMfaSetup } from "@/lib/auth/jwt";
import { ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "@/lib/audit";

const schema = z
  .object({
    name: z.string().min(1).max(200),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/).refine(v=>v.replace(/\D/g,"").length>=7 && v.replace(/\D/g,"").length<=15),
    emergencyContactName: z.string().trim().max(200).optional(),
    emergencyContactPhone: z.string().trim().max(25).optional(),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    confirmPassword: z.string(),
    consent: z.literal(true),
    disclaimerAck: z.literal(true),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  try {
    const user = await registerPatient(parsed.data);
    await recordAuditEvent(user.id, "register", "user", user.id);
    return NextResponse.json({ ok: true, mfaSetupRequired:true, challengeToken:await signMfaSetup(user.id) });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({error:"Registration temporarily unavailable. Try again or sign in if the account was created."},{status:503});
  }
}
