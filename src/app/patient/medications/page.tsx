import { getSession } from "@/lib/auth/session";
import { listMedications, generateScheduleWithStatus } from "@/lib/services/medications";
import {
  DoseTracker,
  type MedicationWithSchedule,
} from "@/components/dose-tracker";
import { getServerT } from "@/lib/i18n/server";

const RANGE_DAYS_PAST = 14;
const RANGE_DAYS_FUTURE = 7;

export default async function PatientMedicationsPage() {
  const session = await getSession();
  const { t } = await getServerT();
  const meds = await listMedications(session!.sub);
  const now = new Date();
  const rangeStart = new Date(now.getTime() - RANGE_DAYS_PAST * 86_400_000);
  const rangeEnd = new Date(now.getTime() + RANGE_DAYS_FUTURE * 86_400_000);

  const medications: MedicationWithSchedule[] = await Promise.all(
    meds.map(async (m) => ({
      medication: m,
      schedule: (await generateScheduleWithStatus(m, rangeStart, rangeEnd)).map((o) => ({
        scheduledFor: o.scheduledFor.toISOString(),
        status: o.status,
      })),
    })),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">
        {t("medications.title")}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{t("medications.subtitle")}</p>
      <div className="mt-4">
        <DoseTracker medications={medications} />
      </div>
    </div>
  );
}
