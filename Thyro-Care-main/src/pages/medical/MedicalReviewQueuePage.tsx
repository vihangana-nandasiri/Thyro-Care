import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { RefreshCw } from "lucide-react";
import { Badge, Btn, Card, EmptyState, ErrorState, LoadingState } from "@/components/common";
import { medicalReviewDetailPath } from "@/constants/routes";
import { listReviewQueue } from "@/services/knowledgeGovernanceService";
import type { KnowledgeReviewQueueItem } from "@/types/knowledgeGovernance";
import type { AppError } from "@/types/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function MedicalReviewQueuePage() {
  useDocumentTitle("Medical Review Queue");
  const navigate = useNavigate();
  const [items, setItems] = useState<KnowledgeReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReviewQueue({ page, page_size: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr?.message || "The review queue could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Medical Review Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            Content submitted by administrators for medical-expert review. No automated or
            AI-generated approval recommendations are provided — every decision requires human
            judgment.
          </p>
        </div>
        <Btn size="sm" variant="ghost" type="button" onClick={() => void refresh()}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
        </Btn>
      </div>

      {loading ? (
        <LoadingState message="Loading review queue…" />
      ) : error ? (
        <ErrorState
          title="Unable to load review queue"
          message={error}
          onRetry={() => void refresh()}
        />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No content is pending review"
            description="Submitted drafts requiring medical-expert review will appear here."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.document_id}-${item.version_id}`}
                  className="border-b border-border last:border-0 hover:bg-accent/40 transition"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {item.title}
                    <div className="text-xs text-muted-foreground font-normal">
                      v{item.version_number}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Badge color="blue">{item.topic.replaceAll("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.language}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(item.submitted_for_review_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Btn
                      size="sm"
                      type="button"
                      onClick={() =>
                        navigate(medicalReviewDetailPath(item.document_id, item.version_id))
                      }
                    >
                      Review
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!loading && !error && items.length > 0 ? (
        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} item{total === 1 ? "" : "s"} pending
          </p>
          <div className="flex gap-2">
            <Btn
              size="sm"
              variant="ghost"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Btn>
          </div>
        </div>
      ) : null}
    </>
  );
}
