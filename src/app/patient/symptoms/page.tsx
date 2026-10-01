import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listSymptoms } from "@/lib/services/symptoms";
import { buttonClass } from "@/components/ui";
import { getServerT } from "@/lib/i18n/server";
import type { I18nKey } from "@/lib/i18n/context";

const levelStyle: Record<string, string> = {
  emergency: "bg-red-100 text-red-800",
  urgent: "bg-amber-100 text-amber-800",
  monitor: "bg-sky-100 text-sky-800",
  routine: "bg-slate-100 text-slate-600",
};

const levelLabelKey: Record<string, I18nKey> = {
  emergency: "symptoms.levelEmergency",
  urgent: "symptoms.levelUrgent",
  monitor: "symptoms.levelMonitor",
  routine: "symptoms.levelRoutine",
};

export default async function SymptomsPage() {
  const session = await getSession();
  const { t } = await getServerT();
  const rows = await listSymptoms(session!.sub);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{t("symptoms.title")}</h1>
        <Link href="/patient/symptoms/new" className={`${buttonClass} w-auto px-4`}>
          {t("symptoms.record")}
        </Link>
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {rows.map((s) => (
          <li key={s.id} className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{s.symptomType}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${levelStyle[s.safetyLevel]}`}>
                {t(levelLabelKey[s.safetyLevel])}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {s.severity} · {new Date(s.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
        {rows.length === 0 && <p className="py-4 text-sm text-slate-500">{t("symptoms.empty")}</p>}
      </ul>
    </div>
  );
}
