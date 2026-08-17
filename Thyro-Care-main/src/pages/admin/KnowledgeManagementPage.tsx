import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, RefreshCw } from "lucide-react";
import { Badge, Btn, Card, EmptyState, ErrorState, LoadingState } from "@/components/common";
import {
  adminKnowledgeDetailPath,
  adminKnowledgeVersionPath,
  medicalKnowledgeVersionPath,
  ROUTES,
} from "@/constants/routes";
import { listKnowledgeDocuments } from "@/services/knowledgeGovernanceService";
import {
  KNOWLEDGE_LANGUAGE_OPTIONS,
  KNOWLEDGE_STATUS_OPTIONS,
  KNOWLEDGE_TOPIC_OPTIONS,
  type KnowledgeDocument,
  type KnowledgeStatus,
} from "@/types/knowledgeGovernance";
import type { AppError } from "@/types/api";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";

const PAGE_SIZE = 20;

function statusBadgeColor(status: string): "blue" | "teal" | "green" | "amber" | "red" | "purple" {
  switch (status) {
    case "approved":
      return "green";
    case "pending_review":
    case "in_review":
      return "amber";
    case "changes_requested":
      return "amber";
    case "rejected":
      return "red";
    case "retired":
    case "archived":
      return "purple";
    default:
      return "blue";
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function KnowledgeManagementPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  useDocumentTitle(isAdmin ? "Knowledge Management" : "Knowledge Library");
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [items, setItems] = useState<KnowledgeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | "">("");
  const [topicFilter, setTopicFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listKnowledgeDocuments({
        status: statusFilter || undefined,
        topic: topicFilter || undefined,
        language: languageFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr?.message || "Knowledge documents could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, topicFilter, languageFilter, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openDocument = (doc: KnowledgeDocument) => {
    if (!doc.current_version_id) {
      showError(
        "This document has no governance version yet. Re-run knowledge seed ingestion or open after a draft is created.",
      );
      return;
    }
    if (isAdmin) {
      if (doc.current_status === "draft" || doc.current_status === "changes_requested") {
        navigate(adminKnowledgeDetailPath(doc.document_id));
        return;
      }
      navigate(adminKnowledgeVersionPath(doc.document_id, doc.current_version_id));
      return;
    }
    navigate(medicalKnowledgeVersionPath(doc.document_id, doc.current_version_id));
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {isAdmin ? "Knowledge Management" : "Knowledge Library"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Draft, submit, and manage patient educational content. Only approved content reaches patients."
              : "Inspect approved, pending, and retired educational content. Restore and retire from version detail."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" type="button" onClick={() => void refresh()}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
          </Btn>
          {isAdmin ? (
            <Btn size="sm" type="button" onClick={() => navigate(ROUTES.ADMIN_KNOWLEDGE_NEW)}>
              <Plus className="w-4 h-4" aria-hidden="true" /> New Draft
            </Btn>
          ) : null}
        </div>
      </div>

      <Card className="mb-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="status-filter" className="block text-sm font-semibold">
              Status
            </label>
            <select
              id="status-filter"
              className="w-full rounded-xl border border-border bg-input-background py-2.5 px-3 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as KnowledgeStatus | "");
              }}
            >
              <option value="">All statuses</option>
              {KNOWLEDGE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="topic-filter" className="block text-sm font-semibold">
              Topic
            </label>
            <select
              id="topic-filter"
              className="w-full rounded-xl border border-border bg-input-background py-2.5 px-3 text-sm"
              value={topicFilter}
              onChange={(e) => {
                setPage(1);
                setTopicFilter(e.target.value);
              }}
            >
              <option value="">All topics</option>
              {KNOWLEDGE_TOPIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="language-filter" className="block text-sm font-semibold">
              Language
            </label>
            <select
              id="language-filter"
              className="w-full rounded-xl border border-border bg-input-background py-2.5 px-3 text-sm"
              value={languageFilter}
              onChange={(e) => {
                setPage(1);
                setLanguageFilter(e.target.value);
              }}
            >
              <option value="">All languages</option>
              {KNOWLEDGE_LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState message="Loading knowledge documents…" />
      ) : error ? (
        <ErrorState
          title="Unable to load knowledge documents"
          message={error}
          onRetry={() => void refresh()}
        />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No knowledge documents found"
            description={
              isAdmin
                ? "Create a new draft, or adjust your filters."
                : "No documents match your filters."
            }
            action={
              isAdmin ? (
                <Btn size="sm" type="button" onClick={() => navigate(ROUTES.ADMIN_KNOWLEDGE_NEW)}>
                  <Plus className="w-4 h-4" aria-hidden="true" /> New Draft
                </Btn>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr
                  key={doc.document_id}
                  className="border-b border-border last:border-0 hover:bg-accent/40 transition"
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {doc.title?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {doc.topic.replaceAll("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.language}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusBadgeColor(doc.current_status)}>
                      {doc.current_status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Btn size="sm" variant="ghost" type="button" onClick={() => openDocument(doc)}>
                      Open
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
            Page {page} of {totalPages} · {total} document{total === 1 ? "" : "s"}
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
