import { notFound } from "next/navigation";
import { getVersion, listReviewHistory } from "@/lib/services/knowledge";
import { NotFoundError } from "@/lib/errors";
import { KnowledgeReviewPanel } from "@/components/knowledge-review-panel";
import { getServerT } from "@/lib/i18n/server";

export default async function ReviewVersionPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;
  let version;
  try {
    version = await getVersion(versionId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const [history, { t }] = await Promise.all([listReviewHistory(versionId), getServerT()]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("knowledge.review.content")}</h1>
      <div className="mt-4">
        <KnowledgeReviewPanel
          version={version}
          history={history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
