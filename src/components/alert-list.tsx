import { getServerT } from "@/lib/i18n/server";
import { AlertStatusSelect } from "./alert-status-select";

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

export async function AlertList({
  alerts,
  statusEndpointBase,
}: {
  alerts: Alert[];
  statusEndpointBase: string;
}) {
  const { t } = await getServerT();
  if (alerts.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">{t("alerts.empty")}</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-slate-100">
      {alerts.map((a) => {
        const lat = typeof a.metadata?.lat === "number" ? a.metadata.lat : null;
        const lng = typeof a.metadata?.lng === "number" ? a.metadata.lng : null;
        const currentStatus =
          (a.metadata?.status as "new" | "acknowledged" | "resolved" | undefined) ?? "new";
        return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-800">
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${severityStyle[a.severity]}`}
                >
                  {t(a.severity === "urgent" ? "alerts.severityUrgent" : "alerts.severityEmergency")}
                </span>
                {a.patientName ?? t("alerts.unknownPatient")}
              </p>
              <p className="text-xs text-slate-500">
                {a.action === "chat_emergency_detected"
                  ? t("alerts.emergencyChat")
                  : a.action === "emergency_triggered"
                    ? t("alerts.emergencyTriggered")
                    : a.severity === "urgent"
                      ? t("alerts.urgentSymptom")
                      : t("alerts.emergencySymptom")}
                {" · "}
                {new Date(a.createdAt).toLocaleString()}
                {lat != null && lng != null && (
                  <>
                    {" · "}
                    <a
                      className="underline"
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("alerts.viewOnMap")}
                    </a>
                  </>
                )}
              </p>
            </div>
            <AlertStatusSelect initialStatus={currentStatus} endpoint={`${statusEndpointBase}/${a.id}`} />
          </li>
        );
      })}
    </ul>
  );
}
