import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listReports } from "@/lib/services/reports";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { ForbiddenError } from "@/lib/errors";
import { getServerT } from "@/lib/i18n/server";

export default async function DoctorPatientReportsPage({
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
  const [reports, { t }] = await Promise.all([listReports(patientId), getServerT()]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("doctor.reports.title")}</h1>
      <ul className="mt-4 divide-y divide-slate-100">
        {reports.map((r) => (
          <li key={r.id} className="py-3 text-sm">
            <a href={r.viewUrl} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
              {r.filename}
            </a>
            <span className="ml-2 text-xs text-slate-500">{(r.sizeBytes / 1024).toFixed(0)} KB</span>
          </li>
        ))}
        {reports.length === 0 && (
          <p className="py-4 text-sm text-slate-500">{t("doctor.reports.empty")}</p>
        )}
      </ul>
    </div>
  );
}
