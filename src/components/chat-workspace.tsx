"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Leaf,
  MessageCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { experience } from "@/lib/i18n/experience";
import { localeForLang } from "@/lib/i18n/config";
interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: { title: string; documentId: string }[] | null;
}
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}
export function ChatWorkspace() {
  const { lang } = useT();
  return <ConversationWorkspace key={lang} />;
}
function ConversationWorkspace() {
  const { lang, t } = useT();
  const x = (key: Parameters<typeof experience>[1]) => experience(lang, key);
  const [sessions, setSessions] = useState<Conversation[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/patient/chat", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const incoming: Conversation[] = (await r.json()).sessions;
        setSessions((current) => {
          const seen = new Set(current.map((s) => s.id));
          return [...current, ...incoming.filter((s) => !seen.has(s.id))];
        });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  async function load(id: string) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(false);
    try {
      const r = await fetch(`/api/patient/chat?sessionId=${id}`, {
        signal: controller.signal,
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setSessionId(id);
      setMessages(data.messages);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function newChat() {
    abort.current?.abort();
    setSessionId(null);
    setMessages([]);
    setError(false);
    setBusy(false);
    setInput("");
    textarea.current?.focus();
  }
  async function send(question: string) {
    if (!question.trim() || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(false);
    setInput("");
    setMessages((old) => [...old, { role: "user", content: question }]);
    try {
      const r = await fetch("/api/patient/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          question,
          language: lang,
        }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setSessionId(data.sessionId);
      setMessages((old) => [...old, data.message]);
      if (!sessionId)
        setSessions((old) => [
          {
            id: data.sessionId,
            title: question,
            createdAt: new Date().toISOString(),
          },
          ...old.filter((s) => s.id !== data.sessionId),
        ]);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(true);
        setInput(question);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }
  return (
    <div className="chat-layout">
      <aside className="chat-history">
        <button className="button button-primary w-full" onClick={newChat}>
          <Plus size={16} />
          {x("newChat")}
        </button>
        <span className="eyebrow">{x("recent")}</span>
        {loading ? (
          <p>{x("loading")}</p>
        ) : !sessions.length ? (
          <p>{x("noChats")}</p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              className={`history-item ${sessionId === s.id ? "active" : ""}`}
              onClick={() => load(s.id)}
              title={s.title}
            >
              {s.title || x("newChat")}
              <small>
                {new Date(s.createdAt).toLocaleDateString(localeForLang(lang))}
              </small>
            </button>
          ))
        )}
      </aside>
      <section className="chat-surface">
        <header className="chat-header">
          <span className="assistant-mark">
            <Leaf size={22} />
          </span>
          <div>
            <strong>{x("assistant")}</strong>
            <small>{x("chatNote")}</small>
          </div>
          <Link href="/emergency">{x("emergency")} ↗</Link>
        </header>
        <div
          className="chat-messages"
          role="log"
          aria-label={x("assistant")}
          aria-live="polite"
          aria-busy={busy}
        >
          {!messages.length ? (
            <div className="chat-welcome">
              <div className="assistant-mark">
                <MessageCircle size={29} strokeWidth={1.3} />
              </div>
              <h1>{x("chatTitle")}</h1>
              <p>{x("chatIntro")}</p>
              <div className="chat-suggestions">
                {(
                  ["promptRecovery", "promptSymptoms"] as const
                ).map((k) => (
                  <button key={k} disabled={busy} onClick={() => send(x(k))}>
                    {x(k)}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <article key={m.id ?? i} className={`chat-message ${m.role}`}>
                <div className="message-label">
                  {m.role === "assistant" ? "THYROCARE" : t("role.patient")}
                </div>
                <div className="message-body">{m.content}</div>
                <div className="message-sources">
                  {m.citations?.map((c, j) => (
                    <span className="pill" key={`${c.documentId}-${j}`}>
                      <ShieldCheck size={12} />[{j + 1}] {c.title}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
          {busy && (
            <p className="text-sm text-slate-600" role="status">
              {x("thinking")}
            </p>
          )}
          <div ref={end} />
        </div>
        {error && (
          <p className="chat-error" role="alert">
            {x("error")}
          </p>
        )}
        <form className="chat-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-question">
            {x("chatPlaceholder")}
          </label>
          <textarea
            ref={textarea}
            id="chat-question"
            rows={2}
            maxLength={1000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={x("chatPlaceholder")}
            disabled={busy}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button
            className="send-button"
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={x("send")}
          >
            <ArrowUp size={20} />
          </button>
        </form>
        <p className="chat-footnote">{x("languageNote")}</p>
      </section>
    </div>
  );
}
