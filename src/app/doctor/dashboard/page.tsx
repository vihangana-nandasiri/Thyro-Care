import { CareDashboard } from "@/components/care-dashboard";
import { EmergencyAlerts } from "@/components/emergency-alerts";
import { getSession } from "@/lib/auth/session";
import { listAssignedPatients } from "@/lib/services/accounts";
import { listEmergencyAlerts } from "@/lib/services/audit";

export default async function DoctorDashboardPage() {
  const session = await getSession();
  const patients = await listAssignedPatients(session!.sub);
  const alerts = await listEmergencyAlerts(patients.map((p) => p.userId), { newOnly: true });
  return (
    <div>
      <EmergencyAlerts alerts={alerts} seeAllHref="/doctor/alerts" />
      <CareDashboard role="doctor" />
    </div>
  );
}
