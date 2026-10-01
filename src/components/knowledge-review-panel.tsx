"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, secondaryButtonClass, ErrorText } from "@/components/ui";
import type { VersionData, HistoryEntry } from "@/components/knowledge-version-editor";
import { localeForLang } from "@/lib/i18n/config";
import { useT, type I18nKey } from "@/lib/i18n/context";
import { interfaceText } from "@/lib/i18n/interface";

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

export function KnowledgeReviewPanel({
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
  const [editing,setEditing]=useState(false);
  const [content,setContent]=useState(version.content);
  const u=(key:Parameters<typeof interfaceText>[1])=>interfaceText(lang,key);
  async function saveContent(){setSubmitting(true);setError(null);try{const r=await fetch(`/api/expert/knowledge/${version.id}/content`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content,expectedContentHash:version.contentHash})});if(!r.ok)throw Error();setEditing(false);router.refresh();}catch{setError(u("error"));}finally{setSubmitting(false);}}

  async function decide(action: "approve" | "reject" | "request_changes") {
    setError(null);
    let comment: string | undefined;
    if (action !== "approve") {
      const entered = window.prompt(t("knowledge.review.commentPrompt"));
      if (!entered || !entered.trim()) return;
      comment = entered;
    }
    setSubmitting(true);
    const res = await fetch(`/api/expert/knowledge/${version.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approve" ? { action, expectedContentHash: version.contentHash } : { action, comment },
      ),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("knowledge.review.decisionError"));
      return;
    }
    router.push("/doctor/review-queue");
  }

  async function restoreVersion() {
    setSubmitting(true);
    const res = await fetch(`/api/expert/knowledge/${version.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedContentHash: version.contentHash }),
    });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="max-w-lg rounded-lg border border-slate-200 p-4">
        <ErrorText message={error} />
        <h2 className="font-semibold text-slate-900">{version.title}</h2>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {statusKeys[version.status] ? t(statusKeys[version.status]) : version.status.replace("_", " ")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{version.content}</p>
        {version.status === "pending_review" && (editing ? <div className="mt-4 space-y-3"><label htmlFor="review-content">{t("knowledge.review.content")}</label><textarea id="review-content" className="field w-full" rows={12} maxLength={50000} value={content} onChange={e=>setContent(e.target.value)}/><div className="flex gap-2"><button disabled={submitting||!content.trim()} className="button button-primary" onClick={saveContent}>{u("save")}</button><button disabled={submitting} className="button button-secondary" onClick={()=>setEditing(false)}>{u("cancel")}</button></div></div>:<button className="button button-secondary mt-3" onClick={()=>{setContent(version.content);setEditing(true);}}>{u("edit")}</button>)}

        {version.status === "pending_review" && !editing && (
          <div className="mt-4 flex gap-3">
            <button className={buttonClass} onClick={() => decide("approve")} disabled={submitting}>
              {t("knowledge.review.approve")}
            </button>
            <button className={secondaryButtonClass} onClick={() => decide("request_changes")} disabled={submitting}>
              {t("knowledge.review.requestChanges")}
            </button>
            <button className="text-sm text-red-600 hover:underline" onClick={() => decide("reject")} disabled={submitting}>
              {t("knowledge.review.reject")}
            </button>
          </div>
        )}
        {version.status === "retired" && (
          <button className={`${buttonClass} mt-4 w-auto px-4`} onClick={restoreVersion} disabled={submitting}>
            {t("knowledge.review.restore")}
          </button>
        )}
      </div>
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
