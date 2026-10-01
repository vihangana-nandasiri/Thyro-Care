import Link from "next/link";
import { listPendingReview } from "@/lib/services/knowledge";
import { localeForLang } from "@/lib/i18n/config";
import { getServerT } from "@/lib/i18n/server";

export default async function ReviewQueuePage() {
  const [versions, { lang, t }] = await Promise.all([listPendingReview(), getServerT()]);
  const locale = localeForLang(lang);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("knowledge.review.queue")}</h1>
      <ul className="mt-4 divide-y divide-slate-100">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{v.title}</p>
              <p className="text-xs text-slate-500">
                {v.topic} · {t("knowledge.review.submitted")}{" "}
                {v.submittedAt ? new Date(v.submittedAt).toLocaleString(locale) : ""}
              </p>
            </div>
            <Link className="text-sm text-teal-700 hover:underline" href={`/doctor/review-queue/${v.id}`}>
              {t("knowledge.review.review")}
            </Link>
          </li>
        ))}
        {versions.length === 0 && (
          <p className="py-4 text-sm text-slate-500">{t("knowledge.review.emptyQueue")}</p>
        )}
      </ul>
    </div>
  );
}
