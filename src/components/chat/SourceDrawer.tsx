import { ExternalLink, X } from "lucide-react";
import type { ChatCitation } from "@/types/chat";

export function SourceDrawer({
  citations,
  open,
  onClose,
}: {
  citations: ChatCitation[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation">
      <section
        className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Answer sources"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-foreground">Answer sources</h2>
            <p className="text-xs text-muted-foreground">
              Approved educational references used for this answer.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-accent"
            onClick={onClose}
            aria-label="Close sources"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {citations.map((citation) => (
            <article key={citation.citation_id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{citation.title}</h3>
                {citation.approved !== false && (
                  <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                    Approved
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {citation.source_name} · Version {citation.document_version}
              </p>
              {citation.excerpt && (
                <p className="mt-2 text-xs leading-relaxed text-foreground">{citation.excerpt}</p>
              )}
              {citation.source_url && (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  href={citation.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
