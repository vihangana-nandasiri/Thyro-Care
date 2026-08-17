import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Menu, MoreHorizontal, Plus, Send, Square, Trash2 } from "lucide-react";
import { Card, Btn, LoadingState, ErrorState } from "@/components/common";
import { ChatBubble, ChatSafetyBanner, SourceDrawer, StreamingBubble } from "@/components/chat";
import { BLUE, TEAL } from "@/constants/colors";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";
import {
  createSession,
  deleteAllSessions,
  deleteSession,
  deleteMessageFeedback,
  exportChat,
  getSession,
  listSessions,
  sendMessage,
  submitMessageFeedback,
  updateSessionTitle,
} from "@/services/chatService";
import { ChatStreamError, streamMessage } from "@/services/chatStream";
import type {
  ChatCitation,
  ChatFeedbackRating,
  ChatMessage,
  ChatMsg,
  ChatSession,
} from "@/types/chat";
import type { AppError } from "@/types/api";

const QUICK_ACTIONS = [
  "Medication Help",
  "Symptom Check",
  "Low-Iodine Diet",
  "Follow-up Care",
  "Emotional Support",
];

const SUGGESTIONS = [
  "What is general education about fatigue after thyroidectomy?",
  "Where can I learn about low-iodine diet basics?",
  "When should I use the symptom safety check?",
];

const DISCLAIMER =
  "ThyroCare AI provides general educational information based on approved sources. It does not provide a diagnosis, interpret medical results, or replace advice from your healthcare team.";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toBubble(message: ChatMessage): ChatMsg {
  return {
    id: message.id,
    from: message.role === "user" ? "user" : "ai",
    text: message.content,
    time: formatTime(message.created_at),
    response_mode: message.response_mode,
    citations: message.citations,
    evidence_coverage: message.evidence_coverage,
    follow_up_suggestions: message.follow_up_suggestions,
    safety_notice: message.safety_notice,
  };
}

export function ChatPage() {
  useDocumentTitle("AI Chat");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { error: toastError, success } = useToast();
  const userName = user?.full_name || "Patient";

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [sourceCitations, setSourceCitations] = useState<ChatCitation[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [deleteAllSupported, setDeleteAllSupported] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streamText]);

  const refreshSessions = useCallback(async () => {
    const list = await listSessions({ page: 1, page_size: 30 });
    setSessions(list.items);
    return list.items;
  }, []);

  const openSession = useCallback(async (id: string) => {
    const detail = await getSession(id);
    setSessionId(detail.session.id);
    setMsgs(detail.messages.map(toBubble));
    setRedirectNotice(null);
    setMobileSessionsOpen(false);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await refreshSessions();
      if (items.length > 0) {
        await openSession(items[0].id);
      } else {
        const created = await createSession("New conversation");
        await refreshSessions();
        await openSession(created.id);
      }
    } catch (err) {
      const appErr = err as AppError;
      setLoadError(appErr?.message || "Chat could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [openSession, refreshSessions]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const created = await createSession("New conversation");
    await refreshSessions();
    setSessionId(created.id);
    return created.id;
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setStreamText("");
    setLastFailedMessage(null);
    setRedirectNotice(null);
    const optimistic: ChatMsg = {
      id: `local-${Date.now()}`,
      from: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMsgs((prev) => [...prev, optimistic]);
    setInput("");
    const controller = new AbortController();
    streamAbortRef.current = controller;
    try {
      const id = await ensureSession();
      let accepted = false;
      let result;
      try {
        result = await streamMessage(
          id,
          trimmed,
          {
            onEvent: (event) => {
              if (event.event === "message.accepted") accepted = true;
              if (event.event === "response.delta") {
                const data = event.data as { delta?: string; content?: string; text?: string };
                setStreamText(
                  (current) => current + (data.delta ?? data.content ?? data.text ?? ""),
                );
              }
            },
          },
          controller.signal,
        );
      } catch (streamError) {
        if (controller.signal.aborted) throw streamError;
        if (accepted) throw streamError;
        result = await sendMessage(id, trimmed);
      }
      setMsgs((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
        return [
          ...withoutOptimistic,
          toBubble(result.user_message),
          toBubble({
            ...result.assistant_message,
            response_mode: result.assistant_message.response_mode ?? result.response_mode,
            citations: result.assistant_message.citations?.length
              ? result.assistant_message.citations
              : result.citations,
            evidence_coverage:
              result.assistant_message.evidence_coverage ?? result.evidence_coverage,
            follow_up_suggestions:
              result.assistant_message.follow_up_suggestions ?? result.follow_up_suggestions,
          }),
        ];
      });
      if (result.response_mode === "safety_redirect") {
        setRedirectNotice(result.assistant_message.content);
      }
      await refreshSessions();
    } catch (err) {
      const appErr = err as AppError;
      setMsgs((prev) => prev.filter((m) => m.id !== optimistic.id));
      if (controller.signal.aborted) {
        setInput(trimmed);
        toastError("Generation stopped. You can edit and send your message again.");
      } else if (!navigator.onLine) {
        setLastFailedMessage(trimmed);
        toastError("You appear to be offline. Reconnect and retry your message.");
      } else if (appErr?.status === 429 || (err instanceof ChatStreamError && err.status === 429)) {
        setLastFailedMessage(trimmed);
        toastError("Too many messages. Please wait a moment and try again.");
      } else if (
        (err instanceof ChatStreamError && err.status && err.status >= 500) ||
        appErr?.status === 503
      ) {
        setLastFailedMessage(trimmed);
        toastError("The answer provider is temporarily unavailable. Please retry shortly.");
      } else {
        setLastFailedMessage(trimmed);
        toastError(appErr?.message || "Message could not be sent. Please try again.");
      }
    } finally {
      streamAbortRef.current = null;
      setStreamText("");
      setSending(false);
    }
  };

  const handleFeedback = async (
    messageId: string,
    rating: ChatFeedbackRating,
    reasonCode?: string,
    comment?: string,
  ) => {
    await submitMessageFeedback(messageId, { rating, reason_code: reasonCode, comment });
  };

  const handleRename = async (session: ChatSession) => {
    const title = window.prompt("Rename conversation", session.title)?.trim();
    if (!title || title === session.title) return;
    try {
      await updateSessionTitle(session.id, title);
      await refreshSessions();
    } catch (err) {
      toastError((err as AppError).message || "Could not rename conversation");
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportChat();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "thyrocare-chat-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError((err as AppError).message || "Could not export conversations");
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Delete all conversations? This cannot be undone.")) return;
    try {
      await deleteAllSessions();
      await handleNewChat();
    } catch (err) {
      if ((err as AppError).status === 404) setDeleteAllSupported(false);
      else toastError((err as AppError).message || "Could not delete conversations");
    }
  };

  const handleNewChat = async () => {
    try {
      const created = await createSession("New conversation");
      await refreshSessions();
      await openSession(created.id);
      success("New chat started");
    } catch (err) {
      const appErr = err as AppError;
      toastError(appErr?.message || "Could not create chat");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await deleteSession(id);
      const items = await refreshSessions();
      if (items[0]) {
        await openSession(items[0].id);
      } else {
        await handleNewChat();
      }
      success("Conversation deleted");
    } catch (err) {
      const appErr = err as AppError;
      toastError(appErr?.message || "Could not delete conversation");
    }
  };

  if (loading) return <LoadingState message="Loading chat…" />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load chat"
        message={loadError}
        onRetry={() => void bootstrap()}
      />
    );
  }

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-130px)] min-h-[420px]">
        <Card
          className={`w-56 flex-shrink-0 flex-col p-3 gap-2 ${mobileSessionsOpen ? "fixed inset-y-0 left-0 z-50 flex h-full shadow-xl" : "hidden lg:flex"}`}
        >
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
            Recent Chats
          </h4>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2">No conversations yet.</p>
          ) : (
            sessions.map((c) => (
              <div key={c.id} className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => void openSession(c.id)}
                  className={`flex-1 text-left px-2 py-2 rounded-xl hover:bg-accent transition text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    sessionId === c.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="font-medium text-foreground truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.last_message_at
                      ? new Date(c.last_message_at).toLocaleDateString()
                      : new Date(c.created_at).toLocaleDateString()}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  className="p-1.5 text-muted-foreground hover:text-red-600 cursor-pointer"
                  onClick={() => void handleDelete(c.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Rename conversation"
                  className="p-1.5 text-muted-foreground hover:text-primary cursor-pointer"
                  onClick={() => void handleRename(c)}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
          <Btn
            variant="ghost"
            size="sm"
            className="mt-auto w-full justify-center"
            type="button"
            onClick={() => void handleNewChat()}
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> New Chat
          </Btn>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Export conversations
          </button>
          {deleteAllSupported && (
            <button
              type="button"
              onClick={() => void handleDeleteAll()}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Delete all conversations
            </button>
          )}
        </Card>

        <Card className="flex-1 flex flex-col p-0 overflow-hidden min-w-0">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 lg:hidden">
            <button
              type="button"
              aria-label="Open conversations"
              onClick={() => setMobileSessionsOpen(true)}
              className="rounded-lg p-2 hover:bg-accent"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">Conversations</span>
          </div>
          <ChatSafetyBanner />
          <p className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border leading-relaxed">
            {DISCLAIMER}
          </p>

          {redirectNotice ? (
            <div
              className="mx-4 mt-3 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              <p className="font-semibold">Safety check recommended</p>
              <p className="mt-1 text-xs">{redirectNotice}</p>
              <p className="mt-1 text-xs">
                This application cannot contact emergency services. Chat text is not used to
                classify emergency severity.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="text-xs font-bold text-red-700 hover:underline cursor-pointer"
                  onClick={() => navigate(ROUTES.SYMPTOMS)}
                >
                  Open symptom safety check →
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-red-700 hover:underline cursor-pointer"
                  onClick={() => navigate(ROUTES.EMERGENCY)}
                >
                  Emergency Support →
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="px-4 py-2.5 border-b border-border flex gap-2 overflow-x-auto scrollbar-hide"
            role="group"
            aria-label="Quick actions"
          >
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => void send(a)}
                disabled={sending}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                {a}
              </button>
            ))}
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Chat messages"
          >
            {msgs.length === 0 ? (
              <div className="mx-auto mt-12 max-w-md text-center">
                <h2 className="text-base font-bold text-foreground">Ask an education question</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  I can explain thyroid-care topics using approved sources when available. I cannot
                  diagnose conditions or interpret lab results.
                </p>
              </div>
            ) : (
              msgs.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  userName={userName}
                  onOpenSources={(message) => {
                    setSourceCitations(message.citations ?? []);
                    setSourcesOpen(true);
                  }}
                  onFeedback={handleFeedback}
                  onRemoveFeedback={deleteMessageFeedback}
                />
              ))
            )}
            {sending && <StreamingBubble text={streamText} />}
            <div ref={bottomRef} />
          </div>

          {lastFailedMessage && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>Your last message was not sent.</span>
              <button
                type="button"
                onClick={() => void send(lastFailedMessage)}
                className="font-bold hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          <div
            className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-t border-border"
            role="group"
            aria-label="Suggestions"
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={sending}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs border border-border text-muted-foreground hover:border-primary hover:text-primary transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="px-3 sm:px-4 py-3 border-t border-border flex items-center gap-2">
            <label className="sr-only" htmlFor="chat-input">
              Message
            </label>
            <input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send(input);
              }}
              placeholder="Ask about medications, diet, or follow-up care..."
              className="flex-1 min-w-0 py-2.5 px-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={sending}
              maxLength={4000}
            />
            {sending ? (
              <button
                type="button"
                onClick={() => streamAbortRef.current?.abort()}
                aria-label="Stop generating"
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted text-foreground hover:bg-accent"
              >
                <Square className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={!input.trim()}
                aria-label="Send message"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </Card>
      </div>
      <SourceDrawer
        citations={sourceCitations}
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
    </>
  );
}
