"use client";
import { useT } from "@/lib/i18n/context";
import { interfaceText } from "@/lib/i18n/interface";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AuthCard,
  inputClass,
  labelClass,
  buttonClass,
  ErrorText,
} from "@/components/ui";

function ResetPasswordForm() {
  const { lang } = useT();
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;
    if (newPassword !== confirmPassword) {
      setError(u("mismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      setSubmitting(false);
      if (!res.ok) {
        setError(data.error ?? u("error"));
        return;
      }
      router.push("/login");
    } catch {
      setError(u("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-700">{u("missingToken")}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorText message={error} />
      <div>
        <label className={labelClass} htmlFor="newPassword">
          {u("newPassword")}
        </label>
        <input
          className={inputClass}
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="confirmPassword">
          {u("confirm")}
        </label>
        <input
          className={inputClass}
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <button className={buttonClass} type="submit" disabled={submitting}>
        {submitting ? u("working") : u("savePassword")}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { lang } = useT();
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  return (
    <AuthCard title={u("savePassword")}>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
