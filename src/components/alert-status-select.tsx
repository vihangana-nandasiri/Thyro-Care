"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";

type Status = "new" | "acknowledged" | "resolved";

const statusKey: Record<Status, "alerts.statusNew" | "alerts.statusAcknowledged" | "alerts.statusResolved"> = {
  new: "alerts.statusNew",
  acknowledged: "alerts.statusAcknowledged",
  resolved: "alerts.statusResolved",
};

export function AlertStatusSelect({
  initialStatus,
  endpoint,
}: {
  initialStatus: Status;
  endpoint: string;
}) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function onChange(next: Status) {
    const prev = status;
    setStatus(next);
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setStatus(prev);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        value={status}
        disabled={saving}
        onChange={(e) => onChange(e.target.value as Status)}
        aria-label={t("alerts.statusLabel")}
      >
        {(Object.keys(statusKey) as Status[]).map((s) => (
          <option key={s} value={s}>
            {t(statusKey[s])}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{t("alerts.updateError")}</span>}
    </div>
  );
}
