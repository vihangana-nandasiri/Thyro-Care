"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";

const REMINDER_CHECK_INTERVAL_MS = 30_000;
const REMINDER_WINDOW_MS = 30 * 60_000;

/** ponytail: WebAudio beep, only fires while this tab is open — no
 * service worker / push notifications. Upgrade path if reminders need to
 * fire in the background: a service worker + the Notification API. */
function playReminderSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    /* Audio unavailable (e.g. autoplay blocked) — reminder is silent. */
  }
}

export interface MedicationWithSchedule {
  medication: {
    id: string;
    name: string;
    dose: string;
    unit: string;
    frequency: string;
    instructions: string | null;
  };
  schedule: { scheduledFor: string; status: "taken" | "missed" | "skipped" | null }[];
}

const statusStyle: Record<string, string> = {
  taken: "bg-teal-600 text-white",
  missed: "bg-red-100 text-red-800 border border-red-300",
  skipped: "bg-slate-100 text-slate-600 border border-slate-300",
};

const markLabelKey = {
  taken: "medications.markTaken",
  missed: "medications.markMissed",
  skipped: "medications.markSkipped",
} as const;

function DoseRow({
  medicationId,
  scheduledFor,
  initialStatus,
}: {
  medicationId: string;
  scheduledFor: string;
  initialStatus: "taken" | "missed" | "skipped" | null;
}) {
  const router = useRouter();
  const { t } = useT();
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [submitting, setSubmitting] = useState(false);

  async function mark(next: "taken" | "missed" | "skipped") {
    setSubmitting(true);
    const res = await fetch(`/api/patient/medications/${medicationId}/doses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor, status: next }),
    });
    setSubmitting(false);
    if (res.ok) {
      setStatus(next);
      router.refresh();
    }
  }

  const when = new Date(scheduledFor).toLocaleString();
  const [isFutureDay] = useState(() => {
    const occ = new Date(scheduledFor);
    const today = new Date();
    const occDay = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return occDay > todayDay;
  });

  const alertedRef = useRef(false);
  useEffect(() => {
    if (isFutureDay || status !== null) return;
    const due = new Date(scheduledFor).getTime();
    const check = () => {
      const elapsed = Date.now() - due;
      if (!alertedRef.current && elapsed >= 0 && elapsed <= REMINDER_WINDOW_MS) {
        alertedRef.current = true;
        playReminderSound();
      }
    };
    check();
    const id = setInterval(check, REMINDER_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isFutureDay, status, scheduledFor]);

  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
      <span className={isFutureDay ? "text-slate-400" : "text-slate-700"}>{when}</span>
      <div className="flex gap-1">
        {(["taken", "missed", "skipped"] as const).map((s) => (
          <button
            key={s}
            disabled={submitting || isFutureDay}
            title={isFutureDay ? t("medications.futureDayDisabled") : undefined}
            onClick={() => mark(s)}
            className={`rounded px-2 py-1 text-xs capitalize disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
              status === s ? statusStyle[s] : "border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t(markLabelKey[s])}
          </button>
        ))}
      </div>
    </li>
  );
}

export function DoseTracker({ medications }: { medications: MedicationWithSchedule[] }) {
  const { t } = useT();
  if (medications.length === 0) {
    return <p className="text-sm text-slate-500">{t("medications.empty")}</p>;
  }

  return (
    <div className="space-y-8">
      {medications.map(({ medication, schedule }) => (
        <div key={medication.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">
                {medication.name} — {medication.dose} {medication.unit}
              </h3>
              <p className="text-xs text-slate-500">{medication.frequency}</p>
              {medication.instructions && (
                <p className="mt-1 text-sm text-slate-600">{medication.instructions}</p>
              )}
            </div>
          </div>
          <ul className="mt-3">
            {schedule.map((occ) => (
              <DoseRow
                key={occ.scheduledFor}
                medicationId={medication.id}
                scheduledFor={occ.scheduledFor}
                initialStatus={occ.status}
              />
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-slate-500">{t("medications.trackingNote")}</p>
    </div>
  );
}
