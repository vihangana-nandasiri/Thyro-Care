import { notFound } from "next/navigation";
import { getVersion, listReviewHistory } from "@/lib/services/knowledge";
import { NotFoundError } from "@/lib/errors";
import { KnowledgeVersionEditor } from "@/components/knowledge-version-editor";

export default async function AdminKnowledgeVersionPage({
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
  const history = await listReviewHistory(versionId);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">
        {version.title} <span className="text-sm font-normal text-slate-500">v{version.versionNo}</span>
      </h1>
      <div className="mt-4">
        <KnowledgeVersionEditor
          version={version}
          history={history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
