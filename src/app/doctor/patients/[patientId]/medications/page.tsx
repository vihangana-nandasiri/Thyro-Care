import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listMedications } from "@/lib/services/medications";
import { assertDoctorAssignedToPatient } from "@/lib/services/accounts";
import { ForbiddenError } from "@/lib/errors";
import { MedicationForm } from "@/components/medication-form";
import { getServerT } from "@/lib/i18n/server";

export default async function DoctorPatientMedicationsPage({
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
  const [meds, { t }] = await Promise.all([
    listMedications(patientId),
    getServerT(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{t("doctor.medications.title")}</h1>
      <ul className="divide-y divide-slate-100">
        {meds.map((m) => (
          <li key={m.id} className="py-2 text-sm">
            <span className="font-medium text-slate-800">{m.name}</span> — {m.dose} {m.unit}, {m.frequency}
            {m.instructions && <p className="text-xs text-slate-500">{m.instructions}</p>}
          </li>
        ))}
        {meds.length === 0 && (
          <p className="text-sm text-slate-500">{t("doctor.medications.empty")}</p>
        )}
      </ul>
      <MedicationForm patientId={patientId} />
    </div>
  );
}
