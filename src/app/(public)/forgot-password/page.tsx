"use client";
import { useT } from "@/lib/i18n/context";
import { interfaceText } from "@/lib/i18n/interface";

import { useState, type FormEvent } from "react";
import {
  AuthCard,
  inputClass,
  labelClass,
  buttonClass,
  ErrorText,
} from "@/components/ui";

export default function ForgotPasswordPage() {
  const { lang } = useT();
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const data = await res.json();
      setSubmitting(false);
      if (!res.ok) {
        setError(data.error ?? u("error"));
        return;
      }
      setMessage("sent");
      setResetLink(data.resetLink ?? null);
    } catch {
      setError(u("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={u("reset")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorText message={error} />
        {message && (
          <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            {u("resetSent")}
          </p>
        )}
        {resetLink && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {u("devLink")}:{" "}
            <a
              className="break-all text-teal-700 hover:underline"
              href={resetLink}
            >
              {resetLink}
            </a>
          </p>
        )}
        <div>
          <label className={labelClass} htmlFor="email">
            {u("email")}
          </label>
          <input
            className={inputClass}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <button className={buttonClass} type="submit" disabled={submitting}>
          {submitting ? u("working") : u("sendLink")}
        </button>
      </form>
    </AuthCard>
  );
}
