import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { patientProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerT } from "@/lib/i18n/server";
import { CareDashboard } from "@/components/care-dashboard";

export default async function PatientDashboardPage() {
  const session = await getSession();
  const [profile] = await Promise.all([
    db.query.patientProfiles.findFirst({ where: eq(patientProfiles.userId, session!.sub) }),
    getServerT(),
  ]);

  return <CareDashboard role="patient" name={profile?.name} />;
}
