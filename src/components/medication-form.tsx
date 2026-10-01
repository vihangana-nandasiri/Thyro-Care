"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass, buttonClass, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

export function MedicationForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const timesOfDay = String(form.get("timesOfDay") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await fetch(`/api/doctor/patients/${patientId}/medications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        dose: form.get("dose"),
        unit: form.get("unit"),
        frequency: form.get("frequency"),
        timesOfDay,
        timezone: form.get("timezone") || "Asia/Colombo",
        instructions: form.get("instructions") || undefined,
        startDate: form.get("startDate"),
        endDate: form.get("endDate") || null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? t("doctor.medications.error"));
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4 rounded-lg border border-slate-200 p-4">
      <ErrorText message={error} />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3">
          <label className={labelClass} htmlFor="name">{t("doctor.medications.name")}</label>
          <input className={inputClass} id="name" name="name" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="dose">{t("doctor.medications.dose")}</label>
          <input className={inputClass} id="dose" name="dose" required placeholder="50" />
        </div>
        <div>
          <label className={labelClass} htmlFor="unit">{t("doctor.medications.unit")}</label>
          <input className={inputClass} id="unit" name="unit" required placeholder="mcg" />
        </div>
        <div>
          <label className={labelClass} htmlFor="frequency">{t("doctor.medications.frequency")}</label>
          <input
            className={inputClass}
            id="frequency"
            name="frequency"
            required
            placeholder={t("doctor.medications.frequencyPlaceholder")}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="timesOfDay">{t("doctor.medications.times")}</label>
        <input className={inputClass} id="timesOfDay" name="timesOfDay" required placeholder="08:00" />
      </div>
      <div>
        <label className={labelClass} htmlFor="timezone">{t("doctor.medications.timezone")}</label>
        <input className={inputClass} id="timezone" name="timezone" defaultValue="Asia/Colombo" required />
      </div>
      <div>
        <label className={labelClass} htmlFor="instructions">{t("doctor.medications.instructions")}</label>
        <textarea className={inputClass} id="instructions" name="instructions" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="startDate">{t("doctor.medications.startDate")}</label>
          <input className={inputClass} id="startDate" name="startDate" type="date" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="endDate">{t("doctor.medications.endDate")}</label>
          <input className={inputClass} id="endDate" name="endDate" type="date" />
        </div>
      </div>
      <button className={buttonClass} type="submit" disabled={submitting}>
        {submitting ? t("doctor.medications.adding") : t("doctor.medications.add")}
      </button>
    </form>
  );
}
