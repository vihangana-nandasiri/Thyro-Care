import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listSymptoms } from "@/lib/services/symptoms";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { ForbiddenError } from "@/lib/errors";
import { localeForLang } from "@/lib/i18n/config";
import type { I18nKey } from "@/lib/i18n/context";
import { getServerT } from "@/lib/i18n/server";

const levelStyle: Record<string, string> = {
  emergency: "bg-red-100 text-red-800",
  urgent: "bg-amber-100 text-amber-800",
  monitor: "bg-sky-100 text-sky-800",
  routine: "bg-slate-100 text-slate-600",
};

const levelLabelKey: Record<"emergency" | "urgent" | "monitor" | "routine", I18nKey> = {
  emergency: "symptoms.levelEmergency",
  urgent: "symptoms.levelUrgent",
  monitor: "symptoms.levelMonitor",
  routine: "symptoms.levelRoutine",
};

const severityLabelKey: Record<string, I18nKey> = {
  mild: "symptoms.severityMild",
  moderate: "symptoms.severityModerate",
  severe: "symptoms.severitySevere",
};

export default async function DoctorPatientSymptomsPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const session = await getSession();
  try {
    await assertDoctorAssignedToPatient(session!.sub, patientId);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }
  const [rows, { lang, t }] = await Promise.all([listSymptoms(patientId), getServerT()]);
  const locale = localeForLang(lang);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("doctor.symptoms.title")}</h1>
      <ul className="mt-4 divide-y divide-slate-100">
        {rows.map((s) => (
          <li key={s.id} className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{s.symptomType}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${levelStyle[s.safetyLevel]}`}>
                {t(levelLabelKey[s.safetyLevel])}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {severityLabelKey[s.severity] ? t(severityLabelKey[s.severity]) : s.severity} ·{" "}
              {new Date(s.createdAt).toLocaleString(locale)}
            </p>
            {s.description && <p className="mt-1 text-sm text-slate-600">{s.description}</p>}
          </li>
        ))}
        {rows.length === 0 && (
          <p className="py-4 text-sm text-slate-500">{t("doctor.symptoms.empty")}</p>
        )}
      </ul>
    </div>
  );
}
