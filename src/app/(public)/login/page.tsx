"use client";
import { useT } from "@/lib/i18n/context";
import { interfaceText } from "@/lib/i18n/interface";
import { MfaSetup } from "@/components/mfa-setup";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AuthCard,
  inputClass,
  labelClass,
  buttonClass,
  ErrorText,
} from "@/components/ui";

const roleHome: Record<string, string> = {
  patient: "/patient/dashboard",
  doctor: "/doctor/dashboard",
  admin: "/admin/dashboard",
};

export default function LoginPage() {
  const { lang } = useT();
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState<string | null>(null);

  async function onPasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      setSubmitting(false);
      if (!res.ok) {
        setError(data.error ?? u("error"));
        return;
      }
      if (data.mfaSetupRequired) {
        setSetupToken(data.challengeToken);
        return;
      }
      if (data.mfaRequired) {
        setChallengeToken(data.challengeToken);
        return;
      }
      router.push(roleHome[data.role] ?? "/dashboard");
      router.refresh();
    } catch {
      setError(u("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onCodeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code: form.get("code") }),
      });
      const data = await res.json();
      setSubmitting(false);
      if (!res.ok) {
        setError(data.error ?? u("error"));
        return;
      }
      router.push(roleHome[data.role] ?? "/dashboard");
      router.refresh();
    } catch {
      setError(u("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (setupToken) return <MfaSetup challengeToken={setupToken} />;
  if (challengeToken) {
    return (
      <AuthCard title={u("mfaTitle")}>
        <form onSubmit={onCodeSubmit} className="space-y-4">
          <ErrorText message={error} />
          <div>
            <label className={labelClass} htmlFor="code">
              {u("code")}
            </label>
            <input
              className={inputClass}
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </div>
          <button className={buttonClass} type="submit" disabled={submitting}>
            {submitting ? u("working") : u("verify")}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={u("loginTitle")}>
      <form onSubmit={onPasswordSubmit} className="space-y-4">
        <ErrorText message={error} />
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
        <div>
          <label className={labelClass} htmlFor="password">
            {u("password")}
          </label>
          <input
            className={inputClass}
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button className={buttonClass} type="submit" disabled={submitting}>
          {submitting ? u("working") : u("signIn")}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link className="text-teal-700 hover:underline" href="/register">
          {u("register")}
        </Link>
        <Link className="text-teal-700 hover:underline" href="/forgot-password">
          {u("forgot")}
        </Link>
      </div>
    </AuthCard>
  );
}
