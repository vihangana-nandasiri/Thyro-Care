import { api } from "@/services/api";
import type {
  ChatAssistantResponse,
  ChatFeedbackRequest,
  ChatSession,
  ChatSessionDetail,
  ChatSessionListResponse,
} from "@/types/chat";
import { toAppError } from "@/utils/apiError";

export async function listSessions(params?: {
  page?: number;
  page_size?: number;
}): Promise<ChatSessionListResponse> {
  try {
    const { data } = await api.get<ChatSessionListResponse>("/chat/sessions", { params });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createSession(title?: string): Promise<ChatSession> {
  try {
    const { data } = await api.post<ChatSession>("/chat/sessions", {
      title: title ?? null,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getSession(sessionId: string): Promise<ChatSessionDetail> {
  try {
    const { data } = await api.get<ChatSessionDetail>(`/chat/sessions/${sessionId}`);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await api.delete(`/chat/sessions/${sessionId}`);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<ChatSession> {
  try {
    const { data } = await api.patch<ChatSession>(`/chat/sessions/${sessionId}`, { title });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function sendMessage(
  sessionId: string,
  content: string,
): Promise<ChatAssistantResponse> {
  try {
    const { data } = await api.post<ChatAssistantResponse>(`/chat/sessions/${sessionId}/messages`, {
      content,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function submitMessageFeedback(
  assistantMessageId: string,
  feedback: ChatFeedbackRequest,
): Promise<void> {
  try {
    await api.post(`/chat/messages/${assistantMessageId}/feedback`, feedback);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteMessageFeedback(assistantMessageId: string): Promise<void> {
  try {
    await api.delete(`/chat/messages/${assistantMessageId}/feedback`);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteAllSessions(): Promise<void> {
  try {
    await api.delete("/chat/sessions");
  } catch (error) {
    throw toAppError(error);
  }
}

export async function exportChat(): Promise<Blob> {
  try {
    const { data } = await api.get<Blob>("/chat/export", { responseType: "blob" });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
