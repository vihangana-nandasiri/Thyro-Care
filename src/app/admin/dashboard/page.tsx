import { CareDashboard } from "@/components/care-dashboard";
import { EmergencyAlerts } from "@/components/emergency-alerts";
import { listEmergencyAlerts } from "@/lib/services/audit";

export default async function AdminDashboardPage() {
  const alerts = await listEmergencyAlerts(undefined, { newOnly: true });
  return (
    <div>
      <EmergencyAlerts alerts={alerts} seeAllHref="/admin/alerts" />
      <CareDashboard role="admin" />
    </div>
  );
}
