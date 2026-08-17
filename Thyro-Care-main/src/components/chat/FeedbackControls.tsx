import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChatFeedbackRating } from "@/types/chat";

const REASONS = [
  { value: "not_helpful", label: "Not helpful" },
  { value: "inaccurate", label: "Inaccurate or unclear" },
  { value: "missing_sources", label: "Missing sources" },
  { value: "other", label: "Other" },
];

export function FeedbackControls({
  onSubmit,
  onRemove,
}: {
  onSubmit: (rating: ChatFeedbackRating, reasonCode?: string, comment?: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [rating, setRating] = useState<ChatFeedbackRating | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const choose = async (next: ChatFeedbackRating) => {
    if (rating === next) {
      setBusy(true);
      try {
        await onRemove();
        setRating(null);
        setReason("");
        setComment("");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await onSubmit(next);
      setRating(next);
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (!rating) return;
    setBusy(true);
    try {
      await onSubmit(rating, reason || undefined, comment.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void choose("up")}
        aria-label="Helpful answer"
        className={`rounded p-1 hover:bg-accent ${rating === "up" ? "text-primary" : "text-muted-foreground"}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void choose("down")}
        aria-label="Not helpful answer"
        className={`rounded p-1 hover:bg-accent ${rating === "down" ? "text-red-600" : "text-muted-foreground"}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      {rating === "down" && (
        <div className="flex w-full flex-wrap items-center gap-2 pt-1">
          <select
            aria-label="Feedback reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-[11px]"
          >
            <option value="">Reason (optional)</option>
            {REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Feedback comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            placeholder="Comment (optional)"
            className="min-w-32 flex-1 rounded border border-border px-2 py-1 text-[11px]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDetails()}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
