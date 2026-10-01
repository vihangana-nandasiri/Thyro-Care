import { getSession } from "@/lib/auth/session";
import { listAssignedPatients } from "@/lib/services/accounts";
import { listEmergencyAlerts } from "@/lib/services/audit";
import { AlertList } from "@/components/alert-list";
import { getServerT } from "@/lib/i18n/server";

export default async function DoctorAlertsPage() {
  const session = await getSession();
  const [patients, { t }] = await Promise.all([
    listAssignedPatients(session!.sub),
    getServerT(),
  ]);
  const alerts = await listEmergencyAlerts(patients.map((p) => p.userId), { limit: 100 });
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("alerts.pageTitle")}</h1>
      <AlertList alerts={alerts} statusEndpointBase="/api/doctor/alerts" />
    </div>
  );
}
