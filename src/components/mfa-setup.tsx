"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useT } from "@/lib/i18n/context";
import { interfaceText } from "@/lib/i18n/interface";
import { AuthCard, ErrorText, inputClass, buttonClass } from "./ui";
export function MfaSetup({ challengeToken }: { challengeToken: string }) {
  const { lang } = useT();
  const u = (key: Parameters<typeof interfaceText>[1]) =>
    interfaceText(lang, key);
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function start() {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setQr(data.qr);
      setSecret(data.secret);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const code = new FormData(e.currentTarget).get("code");
    try {
      const r = await fetch("/api/auth/mfa/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      router.push(`/${data.role}/dashboard`);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard title={u("mfaTitle")}>
      <ErrorText message={error ? u("error") : null} />
      <p>{u("mfaHelp")}</p>
      {!qr ? (
        <button className={buttonClass} disabled={busy} onClick={start}>
          {u("setup")}
        </button>
      ) : (
        <>
          <Image unoptimized src={qr} alt="Authenticator QR" width={220} height={220} />
          <details>
            <summary>{u("setup")}</summary>
            <code className="break-all">{secret}</code>
          </details>
          <form onSubmit={confirm}>
            <label htmlFor="setup-code">{u("code")}</label>
            <input
              id="setup-code"
              name="code"
              className={inputClass}
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
            />
            <button className={buttonClass} disabled={busy}>
              {u("verify")}
            </button>
          </form>
        </>
      )}
    </AuthCard>
  );
}
