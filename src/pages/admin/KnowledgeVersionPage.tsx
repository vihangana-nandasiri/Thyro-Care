import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Archive, FilePlus, RotateCcw } from "lucide-react";
import { Badge, Btn, Card, ErrorState, LoadingState, Textarea } from "@/components/common";
import { SafeKnowledgeContent } from "@/components/knowledge";
import {
  adminKnowledgeDetailPath,
  adminKnowledgeVersionPath,
  medicalKnowledgeVersionPath,
  ROUTES,
} from "@/constants/routes";
import {
  knowledgeRetireFormSchema,
  type KnowledgeRetireFormValues,
} from "@/schemas/knowledgeGovernanceSchemas";
import {
  createKnowledgeNewVersion,
  getKnowledgeDocument,
  getKnowledgeReviewHistory,
  restoreKnowledgeDocument,
  retireKnowledgeDocument,
  retryKnowledgeIngestion,
} from "@/services/knowledgeGovernanceService";
import {
  KNOWLEDGE_DRAFT_CONFLICT_MESSAGE,
  KNOWLEDGE_FORBIDDEN_MESSAGE,
  KNOWLEDGE_INGESTION_FAILED_MESSAGE,
} from "@/constants/knowledgeMessages";
import type {
  KnowledgeDocumentDetail,
  KnowledgeReviewRecord,
  KnowledgeVersion,
} from "@/types/knowledgeGovernance";
import type { AppError } from "@/types/api";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";

function statusBadgeColor(status: string): "blue" | "teal" | "green" | "amber" | "red" | "purple" {
  switch (status) {
    case "approved":
      return "green";
    case "pending_review":
    case "in_review":
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

export function KnowledgeVersionPage() {
  const { documentId, versionId } = useParams<{ documentId: string; versionId: string }>();
  useDocumentTitle("Knowledge Version Detail");
  const navigate = useNavigate();
  const { role } = useAuth();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [history, setHistory] = useState<KnowledgeReviewRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [showRetirePanel, setShowRetirePanel] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KnowledgeRetireFormValues>({
    resolver: zodResolver(knowledgeRetireFormSchema),
    defaultValues: { reason: "" },
  });

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [docDetail, reviewHistory] = await Promise.all([
        getKnowledgeDocument(documentId),
        getKnowledgeReviewHistory(documentId),
      ]);
      setDetail(docDetail);
      setHistory(reviewHistory);
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 404) {
        setLoadError("This knowledge document is no longer available.");
      } else if (appErr?.status === 403) {
        setLoadError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        setLoadError(appErr?.message || "This knowledge document could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState message="Loading version detail…" />;
  if (loadError || !detail || !documentId) {
    return (
      <ErrorState
        title="Unable to load version detail"
        message={loadError || "This knowledge document could not be loaded."}
        onRetry={() => void load()}
      />
    );
  }

  const version: KnowledgeVersion | null =
    detail.versions.find((v) => v.version_id === versionId) ?? detail.current_version;

  if (!version) {
    return (
      <ErrorState
        title="Version not found"
        message="This document version is no longer available."
        onRetry={() => void load()}
      />
    );
  }

  const isCurrent = detail.document.current_version_id === version.version_id;
  const canRetire = isCurrent && detail.document.current_status === "approved";
  const canCreateNewVersion =
    isCurrent && detail.document.current_status === "approved" && role === "admin";
  const canRestore =
    isCurrent && detail.document.current_status === "retired" && role === "medical_expert";
  const canRetryIngest =
    isCurrent &&
    detail.document.current_status === "approved" &&
    version.review_status === "approved";
  const libraryHome = role === "medical_expert" ? ROUTES.MEDICAL_KNOWLEDGE : ROUTES.ADMIN_KNOWLEDGE;
  const versionPathFor = (docId: string, verId: string) =>
    role === "medical_expert"
      ? medicalKnowledgeVersionPath(docId, verId)
      : adminKnowledgeVersionPath(docId, verId);

  const versionHistory = [...detail.versions].sort((a, b) => b.version_number - a.version_number);
  const versionReviewRecords = history.filter((r) => r.version_id === version.version_id);

  const onRetire = async (values: KnowledgeRetireFormValues) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await retireKnowledgeDocument(documentId, {
        expected_version: detail.document.version,
        reason: values.reason,
      });
      setDetail(updated);
      setShowRetirePanel(false);
      reset({ reason: "" });
      success("Content retired");
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        showError(KNOWLEDGE_DRAFT_CONFLICT_MESSAGE);
        await load();
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to retire this content.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onCreateNewVersion = async () => {
    if (busy) return;
    if (!window.confirm("Create a new draft version from this approved content?")) return;
    setBusy(true);
    try {
      const updated = await createKnowledgeNewVersion(documentId, {
        expected_version: detail.document.version,
      });
      success("New draft version created");
      navigate(adminKnowledgeDetailPath(updated.document.document_id));
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        showError(KNOWLEDGE_DRAFT_CONFLICT_MESSAGE);
        await load();
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to create a new version.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (busy || !detail.current_version) return;
    if (!window.confirm("Restore this retired content back to approved status?")) return;
    setBusy(true);
    try {
      const result = await restoreKnowledgeDocument(documentId, {
        expected_version: detail.document.version,
        expected_content_hash: detail.current_version.content_hash,
      });
      if (result.ingestion_status === "failed") {
        showError(KNOWLEDGE_INGESTION_FAILED_MESSAGE);
      } else {
        success("Content restored");
      }
      await load();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        showError(KNOWLEDGE_DRAFT_CONFLICT_MESSAGE);
        await load();
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to restore this content.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onRetryIngest = async () => {
    if (busy || !version) return;
    setBusy(true);
    try {
      const result = await retryKnowledgeIngestion(documentId, version.version_id, {
        expected_content_hash: version.content_hash,
      });
      if (result.ingestion_status === "failed") {
        showError(KNOWLEDGE_INGESTION_FAILED_MESSAGE);
      } else {
        success("Publication/ingestion completed");
      }
      await load();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        showError(KNOWLEDGE_DRAFT_CONFLICT_MESSAGE);
        await load();
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to retry ingestion.");
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
            onClick={() =>
              navigate(role === "admin" ? adminKnowledgeDetailPath(documentId) : libraryHome)
            }
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
          </Btn>
          <h2
            className="text-lg font-bold text-foreground truncate"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {detail.document.slug} · v{version.version_number}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={statusBadgeColor(version.review_status)}>
            {version.review_status.replaceAll("_", " ")}
          </Badge>
          {isCurrent ? <Badge color="teal">Current</Badge> : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Card>
            <h3
              className="font-bold text-foreground mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {version.title}
            </h3>
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
              Version history
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="py-2 pr-3">Version</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {versionHistory.map((v) => (
                    <tr key={v.version_id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-semibold text-foreground">
                        v{v.version_number}
                        {v.version_id === detail.document.current_version_id ? " (current)" : ""}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge color={statusBadgeColor(v.review_status)}>
                          {v.review_status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {formatDate(v.created_at)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Btn
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => navigate(versionPathFor(documentId, v.version_id))}
                        >
                          View
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Review history for this version
            </h3>
            {versionReviewRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No review decisions have been recorded for this version yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {versionReviewRecords.map((r) => (
                  <li key={r.id} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={statusBadgeColor(r.decision)}>
                        {r.decision.replaceAll("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.reviewer_role.replaceAll("_", " ")} · {formatDate(r.created_at)}
                      </span>
                    </div>
                    {r.comments ? (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {r.comments}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
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
              <div>
                <dt className="text-muted-foreground">Optimistic lock (version)</dt>
                <dd className="text-foreground">{version.version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Document lock (version)</dt>
                <dd className="text-foreground">{detail.document.version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="text-foreground">{formatDate(version.submitted_for_review_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Approved</dt>
                <dd className="text-foreground">{formatDate(version.approved_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Retired</dt>
                <dd className="text-foreground">{formatDate(version.retired_at)}</dd>
              </div>
            </dl>
          </Card>

          {canCreateNewVersion || canRetire || canRestore || canRetryIngest ? (
            <Card>
              <h3
                className="font-bold text-foreground mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Lifecycle actions
              </h3>
              <div className="space-y-2">
                {canCreateNewVersion ? (
                  <Btn
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="w-full justify-center"
                    disabled={busy}
                    onClick={() => void onCreateNewVersion()}
                  >
                    <FilePlus className="w-4 h-4" aria-hidden="true" /> Create new draft version
                  </Btn>
                ) : null}
                {canRetryIngest ? (
                  <Btn
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="w-full justify-center"
                    disabled={busy}
                    onClick={() => void onRetryIngest()}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" /> Retry publication
                  </Btn>
                ) : null}
                {canRetire ? (
                  <Btn
                    size="sm"
                    variant="danger"
                    type="button"
                    className="w-full justify-center"
                    disabled={busy}
                    onClick={() => setShowRetirePanel((v) => !v)}
                  >
                    <Archive className="w-4 h-4" aria-hidden="true" /> Retire content
                  </Btn>
                ) : null}
                {canRestore ? (
                  <Btn
                    size="sm"
                    variant="secondary"
                    type="button"
                    className="w-full justify-center"
                    disabled={busy}
                    onClick={() => void onRestore()}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" /> Restore content
                  </Btn>
                ) : null}
              </div>

              {showRetirePanel ? (
                <form className="mt-4 space-y-3" onSubmit={handleSubmit(onRetire)} noValidate>
                  <Textarea
                    label="Retirement reason"
                    rows={3}
                    error={errors.reason?.message}
                    {...register("reason")}
                  />
                  <div className="flex gap-2">
                    <Btn type="submit" size="sm" variant="danger" disabled={busy} aria-busy={busy}>
                      Confirm retire
                    </Btn>
                    <Btn
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setShowRetirePanel(false)}
                    >
                      Cancel
                    </Btn>
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          {detail.document.current_status === "draft" ||
          detail.document.current_status === "changes_requested" ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                This document&apos;s current version is still editable.{" "}
                <button
                  type="button"
                  className="font-semibold text-primary underline underline-offset-2 cursor-pointer"
                  onClick={() => navigate(adminKnowledgeDetailPath(documentId))}
                >
                  Open the editor
                </button>
                .
              </p>
            </Card>
          ) : null}

          <Card>
            <Btn
              size="sm"
              variant="ghost"
              type="button"
              className="w-full justify-center"
              onClick={() => navigate(libraryHome)}
            >
              Back to Knowledge Management
            </Btn>
          </Card>
        </div>
      </div>
    </>
  );
}
