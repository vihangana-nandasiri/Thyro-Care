"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass, buttonClass, secondaryButtonClass, ErrorText } from "@/components/ui";
import { localeForLang } from "@/lib/i18n/config";
import { useT, type I18nKey } from "@/lib/i18n/context";

const statusKeys: Record<string, I18nKey> = {
  draft: "knowledge.status.draft",
  active: "knowledge.status.active",
  retired: "knowledge.status.retired",
  pending_review: "knowledge.status.pending_review",
  approved: "knowledge.status.approved",
  rejected: "knowledge.status.rejected",
  changes_requested: "knowledge.status.changes_requested",
};

const actionKeys: Record<string, I18nKey> = {
  submit: "knowledge.action.submit",
  approve: "knowledge.action.approve",
  reject: "knowledge.action.reject",
  request_changes: "knowledge.action.request_changes",
  retire: "knowledge.action.retire",
  restore: "knowledge.action.restore",
};

export interface VersionData {
  id: string;
  documentId: string;
  versionNo: number;
  title: string;
  topic: string;
  content: string;
  contentHash: string;
  status: string;
  decisionComment: string | null;
}

export interface HistoryEntry {
  id: string;
  action: string;
  comment: string | null;
  createdAt: string;
}

export function KnowledgeVersionEditor({
  version,
  history,
}: {
  version: VersionData;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const { lang, t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function saveDraft(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/knowledge/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        topic: form.get("topic"),
        content: form.get("content"),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("knowledge.editor.saveError"));
      return;
    }
    router.refresh();
  }

  async function submit() {
    setSubmitting(true);
    const endpoint =
      version.status === "changes_requested"
        ? `/api/admin/knowledge/${version.id}/resubmit`
        : `/api/admin/knowledge/${version.id}/submit`;
    const res = await fetch(endpoint, { method: "POST" });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  async function retireVersion() {
    const reason = window.prompt(t("knowledge.editor.retirePrompt"));
    if (!reason) return;
    setSubmitting(true);
    await fetch(`/api/knowledge/${version.id}/retire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setSubmitting(false);
    router.refresh();
  }

  const isEditable = version.status === "draft" || version.status === "changes_requested";

  return (
    <div className="space-y-6">
      {isEditable ? (
        <form onSubmit={saveDraft} className="max-w-lg space-y-4 rounded-lg border border-slate-200 p-4">
          <ErrorText message={error} />
          {version.status === "changes_requested" && version.decisionComment && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("knowledge.editor.reviewerComment")}: {version.decisionComment}
            </p>
          )}
          <div>
            <label className={labelClass} htmlFor="title">{t("knowledge.form.title")}</label>
            <input className={inputClass} id="title" name="title" defaultValue={version.title} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="topic">{t("knowledge.form.topic")}</label>
            <input className={inputClass} id="topic" name="topic" defaultValue={version.topic} required />
          </div>
          <div>
            <label className={labelClass} htmlFor="content">{t("knowledge.form.content")}</label>
            <textarea className={inputClass} id="content" name="content" rows={8} defaultValue={version.content} required />
          </div>
          <div className="flex gap-3">
            <button className={secondaryButtonClass} type="submit" disabled={submitting}>
              {t("knowledge.editor.save")}
            </button>
            <button className={buttonClass} type="button" onClick={submit} disabled={submitting}>
              {version.status === "changes_requested"
                ? t("knowledge.editor.resubmit")
                : t("knowledge.editor.submit")}
            </button>
          </div>
        </form>
      ) : (
        <div className="max-w-lg rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">{version.title}</h2>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {statusKeys[version.status] ? t(statusKeys[version.status]) : version.status.replace("_", " ")}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{version.content}</p>
          {version.decisionComment && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("knowledge.editor.reviewerComment")}: {version.decisionComment}
            </p>
          )}
          {version.status === "approved" && (
            <button className="mt-4 text-sm text-red-600 hover:underline" onClick={retireVersion} disabled={submitting}>
              {t("knowledge.editor.retire")}
            </button>
          )}
        </div>
      )}

      <div className="max-w-lg">
        <h3 className="text-sm font-semibold text-slate-700">{t("knowledge.review.history")}</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {history.map((h) => (
            <li key={h.id}>
              {new Date(h.createdAt).toLocaleString(localeForLang(lang))} —{" "}
              {actionKeys[h.action] ? t(actionKeys[h.action]) : h.action.replace("_", " ")}
              {h.comment ? `: ${h.comment}` : ""}
            </li>
          ))}
          {history.length === 0 && <li>{t("knowledge.review.emptyHistory")}</li>}
        </ul>
      </div>
    </div>
  );
}
