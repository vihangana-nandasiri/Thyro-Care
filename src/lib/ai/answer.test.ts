import { test, expect, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, chatSessions, chatMessages, auditEvents } from "@/db/schema";
import {
  getOrCreateSession,
  answerQuestion,
  listConversations,
  readConversation,
  citedChunks,
} from "./answer";

async function createTestPatient() {
  const [user] = await db
    .insert(users)
    .values({
      email: `chat-test.${Date.now()}@example.com`,
      passwordHash: "x",
      role: "patient",
    })
    .returning();
  return user.id;
}

async function cleanup(patientId: string, sessionId: string) {
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  await db.delete(auditEvents).where(eq(auditEvents.actorId, patientId));
  await db.delete(users).where(eq(users.id, patientId));
}

test("emergency free text never calls the LLM and redirects instead", async () => {
  const patientId = await createTestPatient();
  const session = await getOrCreateSession(patientId, "en");
  const mockCompletion = mock(async () => "should never be called");
  try {
    const message = await answerQuestion(
      patientId,
      session.id,
      "I can't breathe, please help",
      "en",
      mockCompletion,
    );
    expect(mockCompletion).not.toHaveBeenCalled();
    expect(message.content).toMatch(/emergency/i);
    const history = await listConversations(patientId);
    expect(history.find((item) => item.id === session.id)?.title).toBe(
      "I can't breathe, please help",
    );
    expect(await readConversation(patientId, session.id)).toHaveLength(2);
    const otherPatient = crypto.randomUUID();
    expect(await listConversations(otherPatient)).toEqual([]);
    await expect(readConversation(otherPatient, session.id)).rejects.toThrow(
      "Chat session not found",
    );
  } finally {
    await cleanup(patientId, session.id);
  }
});

test("dosage question is classified by the LLM and redirects to doctor without generating content", async () => {
  const patientId = await createTestPatient();
  const session = await getOrCreateSession(patientId, "en");
  const mockCompletion = mock(async () => '{"category":"doctor"}');
  try {
    const message = await answerQuestion(
      patientId,
      session.id,
      "Should I increase my thyroid medication dose?",
      "en",
      mockCompletion,
    );
    expect(mockCompletion).toHaveBeenCalledTimes(1);
    expect(message.content).toMatch(/doctor/i);
  } finally {
    await cleanup(patientId, session.id);
  }
});

test("classifier failure fails safe to a doctor redirect, never silently allowed", async () => {
  const patientId = await createTestPatient();
  const session = await getOrCreateSession(patientId, "en");
  const mockCompletion = mock(async () => "not valid json");
  try {
    const message = await answerQuestion(
      patientId,
      session.id,
      "What foods should I avoid before RAI treatment?",
      "en",
      mockCompletion,
    );
    expect(message.content).toMatch(/doctor/i);
  } finally {
    await cleanup(patientId, session.id);
  }
});

test("citedChunks keeps only the articles the answer references", () => {
  const chunks = [1, 2, 3].map((n) => ({ title: `A${n}`, documentId: `d${n}` }));
  expect(citedChunks("Keep it dry [1]. Call if red [1, 3].", chunks)?.map((c) => c.title)).toEqual(["A1", "A3"]);
  expect(citedChunks("Your next dose is 8am.", chunks)).toBeNull();
  expect(citedChunks("See [9].", chunks)).toBeNull();
  expect(citedChunks("Recovery varies [1–3].", chunks)?.length).toBe(3);
});
