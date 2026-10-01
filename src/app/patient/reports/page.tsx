import { getSession } from "@/lib/auth/session";
import { listReports } from "@/lib/services/reports";
import { ReportUploader } from "@/components/report-uploader";
import { getServerT } from "@/lib/i18n/server";

export default async function ReportsPage() {
  const session = await getSession();
  const { t } = await getServerT();
  const reports = await listReports(session!.sub);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("reports.title")}</h1>
      <div className="mt-4">
        <ReportUploader
          reports={reports.map((r) => ({ ...r, uploadedAt: r.uploadedAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
