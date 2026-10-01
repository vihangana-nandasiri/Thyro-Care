"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { inputClass, labelClass, buttonClass, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

export default function NewDoctorPage() {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        specialty: form.get("specialty") || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("admin.newDoctor.error"));
      return;
    }
    setResult(data);
  }

  if (result) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">{t("admin.newDoctor.created")}</h1>
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("admin.newDoctor.sharePassword")}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-medium text-slate-700">{t("admin.newDoctor.email")}</dt>
            <dd className="font-mono">{result.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">{t("admin.newDoctor.temporaryPassword")}</dt>
            <dd className="font-mono">{result.tempPassword}</dd>
          </div>
        </dl>
        <Link href="/admin/accounts" className="mt-6 inline-block text-teal-700 hover:underline">
          {t("admin.newDoctor.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold text-slate-900">{t("admin.newDoctor.title")}</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <ErrorText message={error} />
        <div>
          <label className={labelClass} htmlFor="name">{t("admin.newDoctor.fullName")}</label>
          <input className={inputClass} id="name" name="name" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">{t("admin.newDoctor.email")}</label>
          <input className={inputClass} id="email" name="email" type="email" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="specialty">{t("admin.newDoctor.specialty")}</label>
          <input className={inputClass} id="specialty" name="specialty" />
        </div>
        <button className={buttonClass} type="submit" disabled={submitting}>
          {submitting ? t("admin.newDoctor.creating") : t("admin.newDoctor.create")}
        </button>
      </form>
    </div>
  );
}
