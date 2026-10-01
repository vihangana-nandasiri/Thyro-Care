import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getOrCreateSession, answerQuestion, listConversations, readConversation } from "@/lib/ai/answer";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isRateLimited } from "@/lib/rate-limit";

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  question: z.string().min(1).max(1000),
  language: z.enum(["en", "si", "ta"]).default("en"),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireRole("patient");
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  if (isRateLimited(`chat:${session.sub}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many questions this hour. Try again later." }, { status: 429 });
  }

  try {
    const chatSession = await getOrCreateSession(session.sub, parsed.data.language, parsed.data.sessionId);
    const message = await answerQuestion(
      session.sub,
      chatSession.id,
      parsed.data.question,
      parsed.data.language,
    );
    await recordAuditEvent(session.sub, "chat_question", "chat_session", chatSession.id);
    return NextResponse.json({
      enabled: true,
      sessionId: chatSession.id,
      message: { id:message.id, role: message.role, content: message.content, citations: message.citations },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({error:"Assistant temporarily unavailable. Please try again."},{status:503});
  }
}

export async function GET(req:Request){
  try {const session=await requireRole("patient");const id=new URL(req.url).searchParams.get("sessionId");if(id&&!z.string().uuid().safeParse(id).success)return NextResponse.json({error:"Invalid session"},{status:400});return NextResponse.json(id?{messages:await readConversation(session.sub,id)}:{sessions:await listConversations(session.sub)});}
  catch(e){return NextResponse.json({error:"Unable to load conversations"},{status:e instanceof ForbiddenError?403:e instanceof NotFoundError?404:503});}
}
