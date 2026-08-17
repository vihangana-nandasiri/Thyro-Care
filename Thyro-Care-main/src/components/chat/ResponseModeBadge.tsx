import type { ChatResponseMode } from "@/types/chat";

const LABELS: Record<ChatResponseMode, string> = {
  grounded_answer: "Approved-source answer",
  insufficient_evidence: "Limited evidence available",
  safety_redirect: "Safety guidance",
  provider_unavailable: "Provider temporarily unavailable",
  policy_refusal: "Unable to help with that",
};

export function ResponseModeBadge({ mode }: { mode?: ChatResponseMode | null }) {
  if (!mode) return null;
  return (
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
      {LABELS[mode]}
    </span>
  );
}

export function EvidenceCoverageLabel({ coverage }: { coverage?: string | null }) {
  if (!coverage) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      Evidence coverage: {coverage.replaceAll("_", " ")}
    </span>
  );
}
