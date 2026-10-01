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
import { DisclaimerBanner } from "@/components/disclaimer-banner";

export default function RegisterPage() {
  const { lang } = useT();
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [setupToken, setSetupToken] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      phone: form.get("phone"),
      emergencyContactName: form.get("emergencyContactName") || undefined,
      emergencyContactPhone: form.get("emergencyContactPhone") || undefined,
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
      consent: form.get("consent") === "on",
      disclaimerAck: form.get("disclaimerAck") === "on",
    };
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      router.push("/patient/dashboard");
      router.refresh();
    } catch {
      setError(u("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (setupToken) return <MfaSetup challengeToken={setupToken} />;
  return (
    <AuthCard title={u("registerTitle")}>
      <DisclaimerBanner />
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <ErrorText message={error} />
        <div>
          <label className={labelClass} htmlFor="phone">
            {u("phone")}
          </label>
          <input
            className={inputClass}
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            minLength={7}
            maxLength={25}
          />
        </div>
        <details>
          <summary>{u("contactPhone")}</summary>
          <label className={labelClass} htmlFor="emergencyContactName">
            {u("contactName")}
          </label>
          <input
            className={inputClass}
            id="emergencyContactName"
            name="emergencyContactName"
            maxLength={200}
          />
          <label className={labelClass} htmlFor="emergencyContactPhone">
            {u("contactPhone")}
          </label>
          <input
            className={inputClass}
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            maxLength={25}
          />
        </details>
        <div>
          <label className={labelClass} htmlFor="name">
            {u("name")}
          </label>
          <input
            className={inputClass}
            id="name"
            name="name"
            required
            autoComplete="name"
          />
        </div>
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
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="consent" required className="mt-1" />
          {u("consent")}
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="disclaimerAck"
            required
            className="mt-1"
          />
          {u("disclaimer")}
        </label>
        <button className={buttonClass} type="submit" disabled={submitting}>
          {submitting ? u("working") : u("register")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {u("haveAccount")}{" "}
        <Link className="text-teal-700 hover:underline" href="/login">
          {u("signIn")}
        </Link>
      </p>
    </AuthCard>
  );
}
