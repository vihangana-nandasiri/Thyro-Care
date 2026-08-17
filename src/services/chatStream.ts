import { env } from "@/config/env";
import { readCsrfCookie } from "@/services/csrf";
import { getAccessToken } from "@/services/tokenStore";
import type { ChatAssistantResponse } from "@/types/chat";

export type ChatStreamEventName =
  | "message.accepted"
  | "retrieval.completed"
  | "response.delta"
  | "response.completed"
  | "response.refused"
  | "response.error";

export interface ChatStreamEvent {
  event: ChatStreamEventName;
  data: unknown;
}

export interface ChatStreamHandlers {
  onEvent: (event: ChatStreamEvent) => void;
}

export class ChatStreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ChatStreamError";
  }
}

function parseEvent(block: string): ChatStreamEvent | null {
  const lines = block.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice(6)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!event || !data) return null;
  try {
    return { event: event as ChatStreamEventName, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

/** Sends a chat message over fetch SSE and resolves with its completed payload. */
export async function streamMessage(
  sessionId: string,
  content: string,
  handlers: ChatStreamHandlers,
  signal: AbortSignal,
): Promise<ChatAssistantResponse> {
  const token = getAccessToken();
  const csrf = readCsrfCookie();
  const response = await fetch(`${env.apiBaseUrl}/chat/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new ChatStreamError(`Streaming request failed (${response.status})`, response.status);
  }
  if (!response.body) throw new ChatStreamError("Streaming is not available.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let completed: ChatAssistantResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const blocks = pending.split(/\r?\n\r?\n/);
    pending = blocks.pop() ?? "";
    for (const block of blocks) {
      const event = parseEvent(block);
      if (!event) continue;
      handlers.onEvent(event);
      if (event.event === "response.completed") {
        completed = event.data as ChatAssistantResponse;
      }
      if (event.event === "response.error") {
        const detail = event.data as { message?: string };
        throw new ChatStreamError(detail.message || "The response could not be completed.");
      }
    }
    if (done) break;
  }

  if (!completed) throw new ChatStreamError("The response stream ended before completion.");
  return completed;
}
