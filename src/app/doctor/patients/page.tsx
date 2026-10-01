import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { listAssignedPatients } from "@/lib/services/accounts";
import { getServerT } from "@/lib/i18n/server";

export default async function DoctorPatientsPage() {
  const session = await getSession();
  const [patients, { t }] = await Promise.all([
    listAssignedPatients(session!.sub),
    getServerT(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("doctor.patients.title")}</h1>
      {patients.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t("doctor.patients.empty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {patients.map((p) => (
            <li key={p.userId} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-800">{p.name}</span>
              <div className="flex gap-3 text-sm">
                <Link className="text-teal-700 hover:underline" href={`/doctor/patients/${p.userId}/medications`}>
                  {t("doctor.patients.medications")}
                </Link>
                <Link className="text-teal-700 hover:underline" href={`/doctor/patients/${p.userId}/symptoms`}>
                  {t("doctor.patients.symptoms")}
                </Link>
                <Link className="text-teal-700 hover:underline" href={`/doctor/patients/${p.userId}/reports`}>
                  {t("doctor.patients.reports")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
