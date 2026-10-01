import Link from "next/link";
import { listDocuments, listDraftsAndPending } from "@/lib/services/knowledge";
import { NewDraftForm } from "@/components/new-draft-form";
import { getServerT } from "@/lib/i18n/server";

const statusStyle: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-teal-100 text-teal-800",
  retired: "bg-red-100 text-red-700",
  pending_review: "bg-amber-100 text-amber-800",
  changes_requested: "bg-orange-100 text-orange-800",
};

export default async function AdminKnowledgePage() {
  const [documents, inProgress, { t }] = await Promise.all([
    listDocuments(),
    listDraftsAndPending(),
    getServerT(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("admin.knowledge.title")}</h1>
        <ul className="mt-4 divide-y divide-slate-100">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-800">{d.slug}</span>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusStyle[d.status]}`}>
                  {t(`knowledge.status.${d.status}`)}
                </span>
                {d.currentVersionId && (
                  <Link
                    className="text-sm text-teal-700 hover:underline"
                    href={`/admin/knowledge/${d.currentVersionId}`}
                  >
                    {t("admin.knowledge.view")}
                  </Link>
                )}
              </div>
            </li>
          ))}
          {documents.length === 0 && (
            <p className="py-4 text-sm text-slate-500">{t("admin.knowledge.empty")}</p>
          )}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("admin.knowledge.inProgress")}</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {inProgress.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-800">{v.title} (v{v.versionNo})</span>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusStyle[v.status]}`}>
                  {t(`knowledge.status.${v.status}`)}
                </span>
                <Link className="text-sm text-teal-700 hover:underline" href={`/admin/knowledge/${v.id}`}>
                  {t("admin.knowledge.edit")}
                </Link>
              </div>
            </li>
          ))}
          {inProgress.length === 0 && (
            <p className="py-4 text-sm text-slate-500">
              {t("admin.knowledge.nothingInProgress")}
            </p>
          )}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("admin.knowledge.newDraft")}</h2>
        <div className="mt-3">
          <NewDraftForm />
        </div>
      </div>
    </div>
  );
}
