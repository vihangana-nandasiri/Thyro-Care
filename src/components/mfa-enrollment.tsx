"use client";

import { useState, type FormEvent } from "react";
import { inputClass, labelClass, buttonClass, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

type Step = "idle" | "password" | "scan" | "done";

export function MfaEnrollment({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const { t } = useT();
  const [step, setStep] = useState<Step>(initiallyEnabled ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/mfa/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("mfa.enrollError"));
      return;
    }
    setQr(data.qr);
    setStep("scan");
  }

  async function onCodeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/mfa/enroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: form.get("code") }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("mfa.verifyError"));
      return;
    }
    setStep("done");
  }

  if (step === "done") {
    return (
      <p className="text-sm text-teal-800">
        {t("mfa.enabled")}
      </p>
    );
  }

  if (step === "scan" && qr) {
    return (
      <form onSubmit={onCodeSubmit} className="space-y-3">
        <ErrorText message={error} />
        <p className="text-sm text-slate-600">
          {t("mfa.scan")}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={t("mfa.qrAlt")} className="h-40 w-40" />
        <div>
          <label className={labelClass} htmlFor="mfa-code">{t("mfa.code")}</label>
          <input className={inputClass} id="mfa-code" name="code" inputMode="numeric" maxLength={6} required />
        </div>
        <button className={buttonClass} type="submit" disabled={submitting}>
          {submitting ? t("mfa.verifying") : t("mfa.confirm")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onPasswordSubmit} className="space-y-3">
      <ErrorText message={error} />
      <p className="text-sm text-slate-600">
        {t("mfa.intro")}
      </p>
      <div>
        <label className={labelClass} htmlFor="mfa-password">{t("mfa.password")}</label>
        <input className={inputClass} id="mfa-password" name="password" type="password" required />
      </div>
      <button className={buttonClass} type="submit" disabled={submitting}>
        {submitting ? t("mfa.starting") : t("mfa.setup")}
      </button>
    </form>
  );
}
