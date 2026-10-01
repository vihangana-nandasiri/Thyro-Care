"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass, buttonClass, ErrorText } from "@/components/ui";
import { languageOptions } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/context";

export function NewDraftForm() {
  const router = useRouter();
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        topic: form.get("topic"),
        language: form.get("language"),
        content: form.get("content"),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("knowledge.form.createError"));
      return;
    }
    router.push(`/admin/knowledge/${data.version.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4 rounded-lg border border-slate-200 p-4">
      <ErrorText message={error} />
      <div>
        <label className={labelClass} htmlFor="title">{t("knowledge.form.title")}</label>
        <input className={inputClass} id="title" name="title" required />
      </div>
      <div>
        <label className={labelClass} htmlFor="topic">{t("knowledge.form.topic")}</label>
        <input
          className={inputClass}
          id="topic"
          name="topic"
          required
          placeholder={t("knowledge.form.topicPlaceholder")}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="language">{t("knowledge.form.language")}</label>
        <select className={inputClass} id="language" name="language" defaultValue="en">
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="content">{t("knowledge.form.content")}</label>
        <textarea className={inputClass} id="content" name="content" rows={6} required />
      </div>
      <button className={buttonClass} type="submit" disabled={submitting}>
        {submitting ? t("knowledge.form.creating") : t("knowledge.form.create")}
      </button>
    </form>
  );
}
