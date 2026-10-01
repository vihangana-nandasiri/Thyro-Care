import { listEmergencyAlerts } from "@/lib/services/audit";
import { AlertList } from "@/components/alert-list";
import { getServerT } from "@/lib/i18n/server";

export default async function AdminAlertsPage() {
  const [alerts, { t }] = await Promise.all([
    listEmergencyAlerts(undefined, { limit: 100 }),
    getServerT(),
  ]);
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("alerts.pageTitle")}</h1>
      <AlertList alerts={alerts} statusEndpointBase="/api/admin/alerts" />
    </div>
  );
}
