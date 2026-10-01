"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { buttonClass, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

export interface ReportData {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  viewUrl: string;
}

export function ReportUploader({ reports }: { reports: ReportData[] }) {
  const router = useRouter();
  const { t } = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/patient/reports", { method: "POST", body: formData });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? t("reports.error"));
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function onDelete(id: string) {
    await fetch(`/api/patient/reports/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="max-w-lg space-y-3 rounded-lg border border-slate-200 p-4">
        <ErrorText message={error} />
        <p className="text-sm text-slate-600">{t("reports.uploadHint")}</p>
        <input ref={fileInput} type="file" aria-label={t("reports.upload")} accept="application/pdf,image/png,image/jpeg" required />
        <button className={buttonClass} type="submit" disabled={submitting}>
          {submitting ? t("reports.uploading") : t("reports.upload")}
        </button>
      </form>
      <ul className="divide-y divide-slate-100">
        {reports.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-3 text-sm">
            <a href={r.viewUrl} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
              {r.filename}
            </a>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{(r.sizeBytes / 1024).toFixed(0)} KB</span>
              <button onClick={() => onDelete(r.id)} className="text-red-600 hover:underline">
                {t("reports.remove")}
              </button>
            </div>
          </li>
        ))}
        {reports.length === 0 && <p className="text-sm text-slate-500">{t("reports.empty")}</p>}
      </ul>
    </div>
  );
}
