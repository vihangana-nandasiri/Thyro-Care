"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass, buttonClass, ErrorText } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { languageOptions, type Lang } from "@/lib/i18n/config";

export interface ProfileData {
  name: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  dob: string | null;
  treatmentStage: string | null;
  languagePref: Lang;
  version: number;
}

export function ProfileForm({
  profile,
}: {
  profile: ProfileData;
}) {
  const router = useRouter();
  const { t, setLang } = useT();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConflict(false);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const languagePref = form.get("languagePref") as Lang;
    const res = await fetch("/api/patient/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone") || null,
        emergencyContactName: form.get("emergencyContactName") || null,
        emergencyContactPhone: form.get("emergencyContactPhone") || null,
        dob: form.get("dob") || null,
        treatmentStage: form.get("treatmentStage") || null,
        languagePref,
        expectedVersion: profile.version,
      }),
    });
    setSubmitting(false);
    if (res.status === 409) {
      setConflict(true);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? t("profile.error"));
      return;
    }
    // Keep the UI's language toggle in sync with the saved preference.
    setLang(languagePref);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <ErrorText message={error} />
      {conflict && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("profile.conflict")}{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => router.refresh()}
          >
            {t("profile.reload")}
          </button>
        </p>
      )}
      <div>
        <label className={labelClass} htmlFor="name">{t("profile.fieldName")}</label>
        <input className={inputClass} id="name" name="name" defaultValue={profile.name} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="phone">{t("profile.fieldPhone")}</label>
        <input className={inputClass} id="phone" name="phone" defaultValue={profile.phone ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="emergencyContactName">{t("profile.fieldEmergencyName")}</label>
          <input
            className={inputClass}
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={profile.emergencyContactName ?? ""}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="emergencyContactPhone">{t("profile.fieldEmergencyPhone")}</label>
          <input
            className={inputClass}
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            defaultValue={profile.emergencyContactPhone ?? ""}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="dob">{t("profile.fieldDob")}</label>
        <input className={inputClass} id="dob" name="dob" type="date" defaultValue={profile.dob ?? ""} />
      </div>
      <div>
        <label className={labelClass} htmlFor="treatmentStage">{t("profile.fieldTreatmentStage")}</label>
        <input
          className={inputClass}
          id="treatmentStage"
          name="treatmentStage"
          defaultValue={profile.treatmentStage ?? ""}
          placeholder={t("profile.treatmentPlaceholder")}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="languagePref">{t("profile.fieldLanguage")}</label>
        <select
          className={inputClass}
          id="languagePref"
          name="languagePref"
          defaultValue={profile.languagePref}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <button className={buttonClass} type="submit" disabled={submitting}>
        {submitting ? t("profile.saving") : t("profile.save")}
      </button>
    </form>
  );
}
