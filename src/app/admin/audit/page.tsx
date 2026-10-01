import { redirect } from "next/navigation";
import { listAuditEvents } from "@/lib/services/audit";
import { requireRole } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { localeForLang } from "@/lib/i18n/config";
import { getServerT } from "@/lib/i18n/server";

export default async function AuditPage() {
  // Defense-in-depth: this page is already gated by admin/layout.tsx, but
  // audit data is sensitive enough to check independently rather than
  // relying on one layer.
  try {
    await requireRole("admin");
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/login");
    throw err;
  }
  const [events, { lang, t }] = await Promise.all([listAuditEvents(), getServerT()]);
  const locale = localeForLang(lang);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("admin.audit.title")}</h1>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">{t("admin.audit.when")}</th>
            <th className="py-2">{t("admin.audit.actor")}</th>
            <th className="py-2">{t("admin.audit.action")}</th>
            <th className="py-2">{t("admin.audit.entity")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-slate-100">
              <td className="py-2 text-xs text-slate-500">
                {new Date(e.createdAt).toLocaleString(locale)}
              </td>
              <td className="py-2">{e.actorEmail ?? "—"}</td>
              <td className="py-2">{e.action}</td>
              <td className="py-2 text-xs text-slate-500">
                {e.entityType}:{e.entityId.slice(0, 8)}
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-sm text-slate-500">
                {t("admin.audit.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
