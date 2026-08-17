import { BLUE, TEAL } from "@/constants/colors";
import { Avatar } from "@/components/common";
import type { ChatFeedbackRating, ChatMsg } from "@/types/chat";
import { Copy, Heart } from "lucide-react";
import { EvidenceCoverageLabel, ResponseModeBadge } from "./ResponseModeBadge";
import { FeedbackControls } from "./FeedbackControls";

export function ChatBubble({
  message,
  userName,
  onOpenSources,
  onFeedback,
  onRemoveFeedback,
}: {
  message: ChatMsg;
  userName: string;
  onOpenSources?: (message: ChatMsg) => void;
  onFeedback?: (
    messageId: string,
    rating: ChatFeedbackRating,
    reasonCode?: string,
    comment?: string,
  ) => Promise<void>;
  onRemoveFeedback?: (messageId: string) => Promise<void>;
}) {
  const m = message;
  const assistantMessageId = typeof m.id === "string" ? m.id : null;
  return (
    <div className={`flex gap-3 ${m.from === "user" ? "flex-row-reverse" : ""}`}>
      {m.from === "ai" ? (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-end"
          style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
        >
          <Heart className="w-4 h-4 text-white" />
        </div>
      ) : (
        <Avatar name={userName} size={8} />
      )}
      <div
        className={`max-w-lg ${m.from === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}
      >
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
            m.from === "ai" ? "bg-muted text-foreground rounded-tl-sm" : "text-white rounded-tr-sm"
          }`}
          style={
            m.from === "user" ? { background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` } : {}
          }
        >
          {m.text}
        </div>
        {m.from === "ai" && <ResponseModeBadge mode={m.response_mode} />}
        {m.from === "ai" && <EvidenceCoverageLabel coverage={m.evidence_coverage} />}
        {m.from === "ai" && m.citations?.length ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-primary hover:underline"
            onClick={() => onOpenSources?.(m)}
          >
            View {m.citations.length} source{m.citations.length === 1 ? "" : "s"}
          </button>
        ) : null}
        {m.from === "ai" && !m.isStreaming && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Copy answer"
              onClick={() => void navigator.clipboard?.writeText(m.text)}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {assistantMessageId && onFeedback && onRemoveFeedback && (
              <FeedbackControls
                onSubmit={(rating, reasonCode, comment) =>
                  onFeedback(assistantMessageId, rating, reasonCode, comment)
                }
                onRemove={() => onRemoveFeedback(assistantMessageId)}
              />
            )}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">{m.time}</span>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
      >
        <Heart className="w-4 h-4 text-white" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <div
          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
