import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";

interface Alert {
  id: string;
  action: string;
  severity: "urgent" | "emergency";
  createdAt: Date;
  patientId: string | null;
  patientName: string | null;
  metadata: Record<string, unknown> | null;
}

const severityStyle: Record<Alert["severity"], string> = {
  emergency: "bg-red-600 text-white",
  urgent: "bg-amber-500 text-white",
};

export async function EmergencyAlerts({ alerts, seeAllHref }: { alerts: Alert[]; seeAllHref: string }) {
  if (alerts.length === 0) return null;
  const { t } = await getServerT();
  return (
    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-red-900">{t("alerts.emergencyTitle")}</h2>
        <Link href={seeAllHref} className="text-xs font-medium text-red-900 underline">
          {t("alerts.seeAll")}
        </Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-red-800">
        {alerts.map((a) => {
          const lat = typeof a.metadata?.lat === "number" ? a.metadata.lat : null;
          const lng = typeof a.metadata?.lng === "number" ? a.metadata.lng : null;
          return (
            <li key={a.id}>
              <span className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityStyle[a.severity]}`}>
                {t(a.severity === "urgent" ? "alerts.severityUrgent" : "alerts.severityEmergency")}
              </span>{" "}
              {a.patientName ?? t("alerts.unknownPatient")} —{" "}
              {a.action === "chat_emergency_detected"
                ? t("alerts.emergencyChat")
                : a.action === "emergency_triggered"
                  ? t("alerts.emergencyTriggered")
                  : a.severity === "urgent"
                    ? t("alerts.urgentSymptom")
                    : t("alerts.emergencySymptom")}{" "}
              · {new Date(a.createdAt).toLocaleString()}
              {lat != null && lng != null && (
                <>
                  {" · "}
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t("alerts.viewOnMap")}
                  </a>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
