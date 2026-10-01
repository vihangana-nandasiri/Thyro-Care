"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SAFETY_QUESTIONS } from "@/lib/safety/rules";
import {
  inputClass,
  labelClass,
  buttonClass,
  ErrorText,
} from "@/components/ui";
import { useT, type I18nKey } from "@/lib/i18n/context";
import { interfaceText, type InterfaceKey } from "@/lib/i18n/interface";
import {
  Activity,
  Heart,
  Thermometer,
  Zap,
  Wind,
  CircleUser,
  Waves,
  Smile,
} from "lucide-react";
const choices: { key: InterfaceKey; icon: typeof Activity }[] = [
  { key: "digestive", icon: Waves },
  { key: "mood", icon: Smile },
  { key: "temperature", icon: Thermometer },
  { key: "swelling", icon: CircleUser },
  { key: "fatigue", icon: Zap },
  { key: "dizziness", icon: Wind },
  { key: "neckPain", icon: Activity },
  { key: "palpitations", icon: Heart },
];

const questionLabelKey: Record<string, I18nKey> = {
  severeBreathingDifficulty: "symptoms.q.severeBreathingDifficulty",
  suddenNeckSwelling: "symptoms.q.suddenNeckSwelling",
  severeUncontrolledBleeding: "symptoms.q.severeUncontrolledBleeding",
  chestPainOrPalpitations: "symptoms.q.chestPainOrPalpitations",
  severeMuscleCrampsOrTingling: "symptoms.q.severeMuscleCrampsOrTingling",
  moderateSwallowingDifficulty: "symptoms.q.moderateSwallowingDifficulty",
  feverOver38: "symptoms.q.feverOver38",
  persistentHoarsenessOrVoiceChange:
    "symptoms.q.persistentHoarsenessOrVoiceChange",
  woundRednessOrDischarge: "symptoms.q.woundRednessOrDischarge",
};

export function SymptomForm() {
  const router = useRouter();
  const { t, lang } = useT();
  const u = (key: InterfaceKey) => interfaceText(lang, key);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InterfaceKey | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"routine" | "monitor" | "urgent" | null>(
    null,
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const safetyAnswers: Record<string, boolean | string> = {};
    for (const q of SAFETY_QUESTIONS) {
      safetyAnswers[q.key] = form.get(q.key) === "on";
    }
    const notes = form.get("notes");
    if (notes) safetyAnswers.notes = String(notes);

    const res = await fetch("/api/patient/symptoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symptomType: selected ? u(selected) : custom,
        severity: form.get("severity"),
        description: form.get("description") || undefined,
        safetyAnswers,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? t("symptoms.error"));
      return;
    }
    if (data.symptom.safetyLevel === "emergency") {
      router.push("/emergency");
      return;
    }
    setResult(data.symptom.safetyLevel);
    router.refresh();
  }

  if (result) {
    return (
      <div
        className={`max-w-lg rounded-lg border p-4 text-sm ${
          result === "urgent"
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : result === "monitor"
              ? "border-sky-300 bg-sky-50 text-sky-900"
              : "border-slate-200 bg-slate-50 text-slate-700"
        }`}
      >
        {result === "urgent" && (
          <p className="font-medium">{t("symptoms.resultUrgent")}</p>
        )}
        {result === "monitor" && <p>{t("symptoms.resultMonitor")}</p>}
        {result === "routine" && <p>{t("symptoms.resultRoutine")}</p>}
        <button
          className="mt-3 text-teal-700 underline"
          onClick={() => {
            setResult(null);
            router.push("/patient/symptoms");
          }}
        >
          {t("symptoms.backToList")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-4 rounded-lg border border-slate-200 p-4"
    >
      <ErrorText message={error} />
      <fieldset>
        <legend className={labelClass}>{u("chooseSymptom")}</legend>
        <input
          className={inputClass}
          type="search"
          aria-label={u("searchSymptoms")}
          placeholder={u("searchSymptoms")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="symptom-options">
          {choices
            .filter(
              (c) =>
                u(c.key)
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()) ||
                interfaceText("en", c.key)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((c) => (
              <button
                type="button"
                className="symptom-choice"
                key={c.key}
                aria-pressed={selected === c.key}
                onClick={() => {
                  setSelected(selected === c.key ? null : c.key);
                  setCustom("");
                }}
              >
                <c.icon size={24} />
                {u(c.key)}
              </button>
            ))}
        </div>
      </fieldset>
      <div>
        <label className={labelClass} htmlFor="symptomType">
          {selected ? u("selected") : u("other")}
        </label>
        <input
          className={inputClass}
          id="symptomType"
          name="symptomType"
          required
          value={selected ? u(selected) : custom}
          onChange={(e) => {
            setSelected(null);
            setCustom(e.target.value);
          }}
          placeholder={t("symptoms.placeholder")}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="severity">
          {t("symptoms.fieldSeverity")}
        </label>
        <select
          className={inputClass}
          id="severity"
          name="severity"
          required
          defaultValue="mild"
        >
          <option value="mild">{t("symptoms.severityMild")}</option>
          <option value="moderate">{t("symptoms.severityModerate")}</option>
          <option value="severe">{t("symptoms.severitySevere")}</option>
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="description">
          {t("symptoms.fieldDescription")}
        </label>
        <textarea
          className={inputClass}
          id="description"
          name="description"
          rows={2}
        />
      </div>
      <fieldset className="space-y-2 border-t border-slate-200 pt-3">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          {t("symptoms.safetyLegend")}
        </legend>
        {SAFETY_QUESTIONS.map((q) => (
          <label
            key={q.key}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <input type="checkbox" name={q.key} className="mt-1" />
            {t(questionLabelKey[q.key])}
          </label>
        ))}
      </fieldset>
      <div>
        <label className={labelClass} htmlFor="notes">
          {t("symptoms.fieldNotes")}
        </label>
        <textarea className={inputClass} id="notes" name="notes" rows={2} />
      </div>
      <button className={buttonClass} type="submit" disabled={submitting}>
        {submitting ? t("symptoms.submitting") : t("symptoms.submit")}
      </button>
    </form>
  );
}
