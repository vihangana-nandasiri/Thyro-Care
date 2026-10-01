"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";

export function EmergencyActions() {
  const { t } = useT();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function toggle() {
    const next = !active;
    setActive(next);
    if (!next) return;

    setStatus("sending");
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* Location denied/unavailable — still send the alert without it. */
    }
    try {
      const res = await fetch("/api/patient/emergency/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <a
        href="tel:1990"
        className="button button-primary block w-full text-center text-lg"
      >
        {t("emergency.call")}
      </a>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3">
        <span className="text-sm font-medium text-red-900">{t("emergency.toggleLabel")}</span>
        <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
          <input
            type="checkbox"
            checked={active}
            disabled={status === "sending"}
            onChange={toggle}
            aria-label={t("emergency.toggleLabel")}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-red-600 peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-red-400 peer-focus-visible:ring-offset-2"
          />
          <span
            aria-hidden
            className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
          />
        </span>
      </label>
      {status === "sending" && <p className="text-xs text-slate-500">{t("emergency.sending")}</p>}
      {status === "sent" && <p className="text-xs text-teal-700">{t("emergency.sent")}</p>}
      {status === "error" && <p className="text-xs text-red-700">{t("emergency.sendError")}</p>}
    </div>
  );
}
