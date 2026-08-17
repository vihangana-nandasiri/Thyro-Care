import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Send } from "lucide-react";
import { Badge, Btn, Card, ErrorState, Input, LoadingState, Textarea } from "@/components/common";
import { SafeKnowledgeContent } from "@/components/knowledge";
import {
  KNOWLEDGE_DRAFT_CONFLICT_MESSAGE,
  KNOWLEDGE_FORBIDDEN_MESSAGE,
} from "@/constants/knowledgeMessages";
import { adminKnowledgeDetailPath, adminKnowledgeVersionPath, ROUTES } from "@/constants/routes";
import {
  knowledgeDraftFormSchema,
  knowledgeSubmitFormSchema,
  type KnowledgeDraftFormValues,
  type KnowledgeSubmitFormValues,
} from "@/schemas/knowledgeGovernanceSchemas";
import {
  createKnowledgeDraft,
  getKnowledgeDocument,
  submitKnowledgeForReview,
  updateKnowledgeDraftVersion,
} from "@/services/knowledgeGovernanceService";
import {
  KNOWLEDGE_LANGUAGE_OPTIONS,
  KNOWLEDGE_TOPIC_OPTIONS,
  type KnowledgeDocumentDetail,
  type KnowledgeVersion,
} from "@/types/knowledgeGovernance";
import type { AppError } from "@/types/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/useToast";

const EDITABLE_STATUSES = new Set(["draft", "changes_requested"]);

function defaultCreateValues(): KnowledgeDraftFormValues {
  return {
    slug: "",
    title: "",
    source_name: "",
    source_url: "",
    topic: "general_education",
    language: "english",
    body: "",
    medical_disclaimer: "",
  };
}

function versionToForm(version: KnowledgeVersion, slug: string): KnowledgeDraftFormValues {
  return {
    slug,
    title: version.title,
    source_name: version.source_name,
    source_url: version.source_url ?? "",
    topic: version.topic as KnowledgeDraftFormValues["topic"],
    language: version.language as KnowledgeDraftFormValues["language"],
    body: version.body,
    medical_disclaimer: version.medical_disclaimer ?? "",
  };
}

export function KnowledgeEditorPage() {
  const { documentId } = useParams<{ documentId?: string }>();
  const isCreate = !documentId;
  useDocumentTitle(isCreate ? "New Knowledge Draft" : "Edit Knowledge Draft");
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(!isCreate);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [showSubmitPanel, setShowSubmitPanel] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<KnowledgeDraftFormValues>({
    resolver: zodResolver(knowledgeDraftFormSchema),
    defaultValues: defaultCreateValues(),
  });

  const {
    register: registerSubmit,
    handleSubmit: handleSubmitNote,
    reset: resetSubmitForm,
    formState: { errors: submitErrors },
  } = useForm<KnowledgeSubmitFormValues>({
    resolver: zodResolver(knowledgeSubmitFormSchema),
    defaultValues: { submission_note: "" },
  });

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getKnowledgeDocument(documentId);
      setDetail(result);
      if (result.current_version) {
        reset(versionToForm(result.current_version, result.document.slug));
      } else {
        setLoadError(
          "This document has no editable governance version. Re-run seed ingestion or create a new draft version.",
        );
      }
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
  }, [documentId, reset]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentVersion = detail?.current_version ?? null;
  const editable =
    isCreate || (!!currentVersion && EDITABLE_STATUSES.has(currentVersion.review_status));

  const reloadLatest = async () => {
    setConflict(false);
    await load();
  };

  const onSave = async (values: KnowledgeDraftFormValues) => {
    if (saving) return;
    setSaving(true);
    setConflict(false);
    try {
      if (isCreate) {
        const created = await createKnowledgeDraft({
          slug: values.slug,
          title: values.title,
          source_name: values.source_name,
          source_url: values.source_url || null,
          topic: values.topic,
          language: values.language,
          body: values.body,
          medical_disclaimer: values.medical_disclaimer || "",
        });
        success("Draft created");
        navigate(adminKnowledgeDetailPath(created.document.document_id), { replace: true });
        return;
      }
      if (!documentId || !currentVersion) return;
      const updated = await updateKnowledgeDraftVersion(documentId, currentVersion.version_id, {
        title: values.title,
        source_name: values.source_name,
        source_url: values.source_url || null,
        topic: values.topic,
        language: values.language,
        body: values.body,
        medical_disclaimer: values.medical_disclaimer || "",
        expected_version: currentVersion.version,
      });
      setDetail(updated);
      if (updated.current_version) {
        reset(versionToForm(updated.current_version, updated.document.slug));
      }
      success("Draft saved");
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        setConflict(true);
        showError(KNOWLEDGE_DRAFT_CONFLICT_MESSAGE);
      } else if (appErr?.status === 404) {
        showError("This knowledge document is no longer available.");
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to save this draft.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onSubmitForReview = async (values: KnowledgeSubmitFormValues) => {
    if (!documentId || !currentVersion || submitting) return;
    setSubmitting(true);
    try {
      let versionId = currentVersion.version_id;
      let expectedVersion = currentVersion.version;
      if (isDirty) {
        const draftValues = getValues();
        const saved = await updateKnowledgeDraftVersion(documentId, currentVersion.version_id, {
          title: draftValues.title,
          source_name: draftValues.source_name,
          source_url: draftValues.source_url || null,
          topic: draftValues.topic,
          language: draftValues.language,
          body: draftValues.body,
          medical_disclaimer: draftValues.medical_disclaimer || "",
          expected_version: currentVersion.version,
        });
        setDetail(saved);
        if (!saved.current_version) {
          throw new Error("Draft saved without a current version");
        }
        reset(versionToForm(saved.current_version, saved.document.slug));
        versionId = saved.current_version.version_id;
        expectedVersion = saved.current_version.version;
      }
      const updated = await submitKnowledgeForReview(documentId, versionId, {
        expected_version: expectedVersion,
        submission_note: values.submission_note || null,
      });
      setDetail(updated);
      if (updated.current_version) {
        reset(versionToForm(updated.current_version, updated.document.slug));
      }
      resetSubmitForm({ submission_note: "" });
      setShowSubmitPanel(false);
      success("Submitted for medical review");
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        setConflict(true);
        showError(KNOWLEDGE_DRAFT_CONFLICT_MESSAGE);
      } else if (appErr?.status === 404) {
        showError("This knowledge document is no longer available.");
      } else if (appErr?.status === 403) {
        showError(KNOWLEDGE_FORBIDDEN_MESSAGE);
      } else {
        showError(appErr?.message || "Unable to submit this draft for review.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading knowledge draft…" />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load knowledge draft"
        message={loadError}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Btn
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => navigate(ROUTES.ADMIN_KNOWLEDGE)}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
          </Btn>
          <h2
            className="text-lg font-bold text-foreground truncate"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {isCreate ? "New Knowledge Draft" : "Edit Knowledge Draft"}
          </h2>
        </div>
        {currentVersion ? (
          <div className="flex items-center gap-2">
            <Badge color={editable ? "blue" : "amber"}>
              {currentVersion.review_status.replaceAll("_", " ")}
            </Badge>
            {detail ? (
              <Btn
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  navigate(
                    adminKnowledgeVersionPath(
                      detail.document.document_id,
                      currentVersion.version_id,
                    ),
                  )
                }
              >
                View history
              </Btn>
            ) : null}
          </div>
        ) : null}
      </div>

      {conflict ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {KNOWLEDGE_DRAFT_CONFLICT_MESSAGE}
          <div className="mt-2">
            <Btn size="sm" variant="ghost" type="button" onClick={() => void reloadLatest()}>
              Reload latest version
            </Btn>
          </div>
        </div>
      ) : null}

      {!editable && currentVersion ? (
        <div className="mb-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          This content is <strong>{currentVersion.review_status.replaceAll("_", " ")}</strong> and
          cannot be edited from this page.{" "}
          {detail ? (
            <button
              type="button"
              className="font-semibold text-primary underline underline-offset-2 cursor-pointer"
              onClick={() =>
                navigate(
                  adminKnowledgeVersionPath(detail.document.document_id, currentVersion.version_id),
                )
              }
            >
              View version details and lifecycle actions
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <form className="space-y-3" onSubmit={handleSubmit(onSave)} noValidate>
            <Input
              label="Slug"
              disabled={!isCreate}
              error={errors.slug?.message}
              {...register("slug")}
            />
            {isCreate ? (
              <p className="text-xs text-muted-foreground -mt-1">
                Use a stable, URL-safe identifier (e.g. lowercase words separated by hyphens). The
                slug cannot be changed after creation.
              </p>
            ) : null}
            <Input
              label="Title"
              error={errors.title?.message}
              {...register("title")}
              disabled={!editable}
            />
            <Input
              label="Source name"
              error={errors.source_name?.message}
              {...register("source_name")}
              disabled={!editable}
            />
            <Input
              label="Source URL (optional)"
              error={errors.source_url?.message}
              {...register("source_url")}
              disabled={!editable}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="topic" className="block text-sm font-semibold">
                  Topic
                </label>
                <select
                  id="topic"
                  className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm disabled:opacity-50"
                  disabled={!editable}
                  {...register("topic")}
                >
                  {KNOWLEDGE_TOPIC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="language" className="block text-sm font-semibold">
                  Language
                </label>
                <select
                  id="language"
                  className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm disabled:opacity-50"
                  disabled={!editable}
                  {...register("language")}
                >
                  {KNOWLEDGE_LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Textarea
              label="Body"
              rows={12}
              error={errors.body?.message}
              {...register("body")}
              disabled={!editable}
            />
            <Textarea
              label="Medical disclaimer (optional)"
              rows={3}
              error={errors.medical_disclaimer?.message}
              {...register("medical_disclaimer")}
              disabled={!editable}
            />
            {editable ? (
              <div className="flex gap-2 pt-2 flex-wrap">
                <Btn type="submit" size="sm" disabled={saving || conflict} aria-busy={saving}>
                  {saving ? "Saving…" : "Save draft"}
                </Btn>
                {!isCreate ? (
                  <Btn
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={saving || conflict}
                    onClick={() => setShowSubmitPanel((v) => !v)}
                  >
                    <Send className="w-4 h-4" aria-hidden="true" /> Submit for review
                  </Btn>
                ) : null}
              </div>
            ) : null}
          </form>
        </Card>

        <div className="space-y-4">
          {!isCreate && editable && showSubmitPanel ? (
            <Card>
              <h3
                className="font-bold text-foreground mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Submit for medical review
              </h3>
              <form className="space-y-3" onSubmit={handleSubmitNote(onSubmitForReview)} noValidate>
                <Textarea
                  label="Submission note (optional)"
                  rows={4}
                  error={submitErrors.submission_note?.message}
                  {...registerSubmit("submission_note")}
                />
                <div className="flex gap-2">
                  <Btn type="submit" size="sm" disabled={submitting} aria-busy={submitting}>
                    {submitting ? "Submitting…" : "Confirm submission"}
                  </Btn>
                  <Btn
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setShowSubmitPanel(false)}
                  >
                    Cancel
                  </Btn>
                </div>
              </form>
            </Card>
          ) : null}

          {!editable && currentVersion ? (
            <Card>
              <h3
                className="font-bold text-foreground mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Current content (read-only)
              </h3>
              <SafeKnowledgeContent content={currentVersion.body} />
            </Card>
          ) : null}

          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Governance notice
            </h3>
            <p className="text-sm text-muted-foreground">
              Draft content is never shown to patients. Only medical-expert approved content reaches
              patient-facing retrieval.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
