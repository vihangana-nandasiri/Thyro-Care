import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, RotateCcw, XCircle } from "lucide-react";
import { Badge, Btn, Card, ErrorState, Input, LoadingState, Textarea } from "@/components/common";
import { SafeKnowledgeContent } from "@/components/knowledge";
import {
  KNOWLEDGE_APPROVAL_CONFIRMATION_TEXT,
  KNOWLEDGE_FORBIDDEN_MESSAGE,
  KNOWLEDGE_HASH_CONFLICT_MESSAGE,
  KNOWLEDGE_INGESTION_FAILED_MESSAGE,
  KNOWLEDGE_REVIEW_CONFLICT_MESSAGE,
} from "@/constants/knowledgeMessages";
import { ROUTES } from "@/constants/routes";
import {
  knowledgeApproveFormSchema,
  knowledgeRejectFormSchema,
  knowledgeRequestChangesFormSchema,
  type KnowledgeApproveFormValues,
  type KnowledgeRejectFormValues,
  type KnowledgeRequestChangesFormValues,
} from "@/schemas/knowledgeGovernanceSchemas";
import {
  compareKnowledgeVersions,
  getReviewQueueItem,
  submitReviewDecision,
} from "@/services/knowledgeGovernanceService";
import type {
  KnowledgeApprovalResult,
  KnowledgeCompareResponse,
  KnowledgeDocumentDetail,
} from "@/types/knowledgeGovernance";
import type { AppError } from "@/types/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";

type DecisionPanel = "approve" | "request_changes" | "reject" | null;

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

function isConflictResult(
  result: KnowledgeApprovalResult | KnowledgeDocumentDetail,
): result is KnowledgeApprovalResult {
  return (result as KnowledgeApprovalResult).ingestion_status !== undefined;
}

export function MedicalReviewDetailPage() {
  const { documentId, versionId } = useParams<{ documentId: string; versionId: string }>();
  useDocumentTitle("Review Knowledge Content");
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [compare, setCompare] = useState<KnowledgeCompareResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [panel, setPanel] = useState<DecisionPanel>(null);
  const [busy, setBusy] = useState(false);

  const approveForm = useForm<KnowledgeApproveFormValues>({
    resolver: zodResolver(knowledgeApproveFormSchema),
    defaultValues: { confirmationText: "", comments: "" },
  });
  const requestChangesForm = useForm<KnowledgeRequestChangesFormValues>({
    resolver: zodResolver(knowledgeRequestChangesFormSchema),
    defaultValues: { comments: "" },
  });
  const rejectForm = useForm<KnowledgeRejectFormValues>({
    resolver: zodResolver(knowledgeRejectFormSchema),
    defaultValues: { comments: "" },
  });

  const load = useCallback(async () => {
    if (!documentId || !versionId) return;
    setLoading(true);
    setLoadError(null);
    setCompareError(null);
    try {
      const result = await getReviewQueueItem(documentId, versionId);
      setDetail(result);
      const version = result.current_version;
      if (version?.supersedes_version_id) {
        try {
          const diff = await compareKnowledgeVersions(
            documentId,
            version.version_id,
            version.supersedes_version_id,
          );
          setCompare(diff);
        } catch (err) {
          const appErr = err as AppError;
          setCompareError(appErr?.message || "Comparison could not be loaded.");
        }
      } else {
        setCompare(null);
      }
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 404) {
        setLoadError("This review item is no longer available.");
      } else if (appErr?.status === 403) {
        setLoadError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        setLoadError(appErr?.message || "This review item could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState message="Loading review item…" />;
  if (loadError || !detail || !documentId || !versionId) {
    return (
      <ErrorState
        title="Unable to load review item"
        message={loadError || "This review item could not be loaded."}
        onRetry={() => void load()}
      />
    );
  }

  const version = detail.current_version;
  if (!version) {
    return (
      <ErrorState
        title="Version not found"
        message="This document version is no longer available."
        onRetry={() => void load()}
      />
    );
  }

  const stillPending = version.review_status === "pending_review";

  const handleConflict = async (appErr: AppError) => {
    const msg = (appErr?.message || "").toLowerCase();
    if (msg.includes("hash")) {
      showError(KNOWLEDGE_HASH_CONFLICT_MESSAGE);
    } else {
      showError(KNOWLEDGE_REVIEW_CONFLICT_MESSAGE);
    }
    setPanel(null);
    await load();
  };

  const onApprove = async (values: KnowledgeApproveFormValues) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await submitReviewDecision(documentId, versionId, {
        decision: "approve",
        expected_version: version.version,
        expected_content_hash: version.content_hash,
        comments: values.comments || null,
      });
      if (isConflictResult(result) && result.ingestion_status === "failed") {
        success("Content approved");
        showError(KNOWLEDGE_INGESTION_FAILED_MESSAGE);
      } else {
        success("Content approved and published");
      }
      navigate(ROUTES.MEDICAL_REVIEW, { replace: true });
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        await handleConflict(appErr);
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to approve this content.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onRequestChanges = async (values: KnowledgeRequestChangesFormValues) => {
    if (busy) return;
    setBusy(true);
    try {
      await submitReviewDecision(documentId, versionId, {
        decision: "request_changes",
        expected_version: version.version,
        expected_content_hash: version.content_hash,
        comments: values.comments,
      });
      success("Changes requested");
      navigate(ROUTES.MEDICAL_REVIEW, { replace: true });
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        await handleConflict(appErr);
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to request changes for this content.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onReject = async (values: KnowledgeRejectFormValues) => {
    if (busy) return;
    setBusy(true);
    try {
      await submitReviewDecision(documentId, versionId, {
        decision: "reject",
        expected_version: version.version,
        expected_content_hash: version.content_hash,
        comments: values.comments,
      });
      success("Content rejected");
      navigate(ROUTES.MEDICAL_REVIEW, { replace: true });
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        await handleConflict(appErr);
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to reject this content.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Btn
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => navigate(ROUTES.MEDICAL_REVIEW)}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to queue
          </Btn>
          <h2
            className="text-lg font-bold text-foreground truncate"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {version.title}
          </h2>
        </div>
        <Badge color={stillPending ? "amber" : "blue"}>
          {version.review_status.replaceAll("_", " ")}
        </Badge>
      </div>

      {!stillPending ? (
        <div className="mb-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          This item is no longer pending review — its status changed to{" "}
          <strong>{version.review_status.replaceAll("_", " ")}</strong>. Reload the queue to see
          current items.
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Card>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge color="blue">{version.topic.replaceAll("_", " ")}</Badge>
              <Badge color="teal">{version.language}</Badge>
              <span className="text-xs text-muted-foreground">v{version.version_number}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {version.source_name}
              {version.source_url ? (
                <>
                  {" · "}
                  <a
                    href={version.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Source link
                  </a>
                </>
              ) : null}
              {" · "}
              Submitted {formatDate(version.submitted_for_review_at)}
            </p>
            <SafeKnowledgeContent content={version.body} />
            {version.medical_disclaimer ? (
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Medical disclaimer
                </p>
                <SafeKnowledgeContent content={version.medical_disclaimer} />
              </div>
            ) : null}
          </Card>

          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Compare with previously approved version
            </h3>
            {compareError ? (
              <p className="text-sm text-muted-foreground">{compareError}</p>
            ) : !version.supersedes_version_id ? (
              <p className="text-sm text-muted-foreground">
                There is no previous approved version to compare — this is the first submitted
                version of this document.
              </p>
            ) : compare ? (
              <div className="rounded-xl border border-border overflow-hidden font-mono text-xs">
                {compare.lines.length === 0 ? (
                  <p className="p-3 text-muted-foreground">No differences detected.</p>
                ) : (
                  compare.lines.map((line, i) => (
                    <div
                      key={i}
                      className={`px-3 py-1 whitespace-pre-wrap break-words ${
                        line.op === "insert"
                          ? "bg-green-50 text-green-800"
                          : line.op === "delete"
                            ? "bg-red-50 text-red-800"
                            : "text-muted-foreground"
                      }`}
                    >
                      {line.op === "insert" ? "+ " : line.op === "delete" ? "- " : "  "}
                      {line.op === "delete" ? line.from_line : line.to_line}
                    </div>
                  ))
                )}
                {compare.truncated ? (
                  <p className="p-3 text-xs text-amber-700 border-t border-border">
                    Comparison truncated for very long content.
                  </p>
                ) : null}
              </div>
            ) : (
              <LoadingState message="Loading comparison…" />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {stillPending ? (
            <Card>
              <h3
                className="font-bold text-foreground mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Review decision
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                No AI or automated approval recommendations are provided. Every decision requires
                your independent clinical judgment.
              </p>
              <div className="space-y-2">
                <Btn
                  size="sm"
                  className="w-full justify-center"
                  type="button"
                  disabled={busy}
                  onClick={() => setPanel(panel === "approve" ? null : "approve")}
                >
                  <Check className="w-4 h-4" aria-hidden="true" /> Approve
                </Btn>
                <Btn
                  size="sm"
                  variant="secondary"
                  className="w-full justify-center"
                  type="button"
                  disabled={busy}
                  onClick={() => setPanel(panel === "request_changes" ? null : "request_changes")}
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" /> Request changes
                </Btn>
                <Btn
                  size="sm"
                  variant="danger"
                  className="w-full justify-center"
                  type="button"
                  disabled={busy}
                  onClick={() => setPanel(panel === "reject" ? null : "reject")}
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" /> Reject
                </Btn>
              </div>

              {panel === "approve" ? (
                <form
                  className="mt-4 space-y-3 border-t border-border pt-4"
                  onSubmit={approveForm.handleSubmit(onApprove)}
                  noValidate
                >
                  <p className="text-xs text-muted-foreground">
                    Type the confirmation statement exactly as shown to approve:
                  </p>
                  <p className="text-xs font-semibold text-foreground bg-muted/50 rounded-lg p-2">
                    {KNOWLEDGE_APPROVAL_CONFIRMATION_TEXT}
                  </p>
                  <Input
                    label="Confirmation statement"
                    error={approveForm.formState.errors.confirmationText?.message}
                    {...approveForm.register("confirmationText")}
                  />
                  <Textarea
                    label="Review summary (optional)"
                    rows={3}
                    error={approveForm.formState.errors.comments?.message}
                    {...approveForm.register("comments")}
                  />
                  <div className="flex gap-2">
                    <Btn type="submit" size="sm" disabled={busy} aria-busy={busy}>
                      {busy ? "Approving…" : "Confirm approve"}
                    </Btn>
                    <Btn
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setPanel(null)}
                    >
                      Cancel
                    </Btn>
                  </div>
                </form>
              ) : null}

              {panel === "request_changes" ? (
                <form
                  className="mt-4 space-y-3 border-t border-border pt-4"
                  onSubmit={requestChangesForm.handleSubmit(onRequestChanges)}
                  noValidate
                >
                  <Textarea
                    label="Comments (required)"
                    rows={4}
                    error={requestChangesForm.formState.errors.comments?.message}
                    {...requestChangesForm.register("comments")}
                  />
                  <div className="flex gap-2">
                    <Btn
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {busy ? "Submitting…" : "Confirm request changes"}
                    </Btn>
                    <Btn
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setPanel(null)}
                    >
                      Cancel
                    </Btn>
                  </div>
                </form>
              ) : null}

              {panel === "reject" ? (
                <form
                  className="mt-4 space-y-3 border-t border-border pt-4"
                  onSubmit={rejectForm.handleSubmit(onReject)}
                  noValidate
                >
                  <Textarea
                    label="Comments (required)"
                    rows={4}
                    error={rejectForm.formState.errors.comments?.message}
                    {...rejectForm.register("comments")}
                  />
                  <div className="flex gap-2">
                    <Btn type="submit" size="sm" variant="danger" disabled={busy} aria-busy={busy}>
                      {busy ? "Submitting…" : "Confirm reject"}
                    </Btn>
                    <Btn
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setPanel(null)}
                    >
                      Cancel
                    </Btn>
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Technical details
            </h3>
            <dl className="text-xs space-y-2">
              <div>
                <dt className="text-muted-foreground">Document ID</dt>
                <dd className="font-mono break-all text-foreground">
                  {detail.document.document_id}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Version ID</dt>
                <dd className="font-mono break-all text-foreground">{version.version_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Content hash</dt>
                <dd className="font-mono break-all text-foreground">{version.content_hash}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
