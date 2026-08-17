/**
 * Knowledge governance types aligned with backend enums/schemas (Phase 12).
 *
 * Clients never supply actor identity, statuses, or approval timestamps — those are
 * always derived server-side from the authenticated user and workflow transitions.
 */

/** `archived` and `in_review` are legacy statuses retained for backward compatibility. */
export type KnowledgeStatus =
  | "draft"
  | "in_review"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "archived"
  | "retired";

export type KnowledgeReviewDecision =
  | "approve"
  | "request_changes"
  | "reject"
  | "retire"
  | "restore";

export type KnowledgeLanguage = "english" | "sinhala" | "tamil";

export type KnowledgeTopic =
  | "thyroidectomy_recovery"
  | "thyroid_cancer_survivorship"
  | "medication_education"
  | "follow_up_education"
  | "symptom_awareness"
  | "nutrition_education"
  | "emergency_awareness"
  | "general_education"
  | "other";

export const KNOWLEDGE_STATUS_OPTIONS: { value: KnowledgeStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "retired", label: "Retired" },
];

export const KNOWLEDGE_TOPIC_OPTIONS: { value: KnowledgeTopic; label: string }[] = [
  { value: "thyroidectomy_recovery", label: "Thyroidectomy recovery" },
  { value: "thyroid_cancer_survivorship", label: "Thyroid cancer survivorship" },
  { value: "medication_education", label: "Medication education" },
  { value: "follow_up_education", label: "Follow-up education" },
  { value: "symptom_awareness", label: "Symptom awareness" },
  { value: "nutrition_education", label: "Nutrition education" },
  { value: "emergency_awareness", label: "Emergency awareness" },
  { value: "general_education", label: "General education" },
  { value: "other", label: "Other" },
];

export const KNOWLEDGE_LANGUAGE_OPTIONS: { value: KnowledgeLanguage; label: string }[] = [
  { value: "english", label: "English" },
  { value: "sinhala", label: "Sinhala" },
  { value: "tamil", label: "Tamil" },
];

export interface KnowledgeVersion {
  version_id: string;
  version_number: number;
  title: string;
  source_name: string;
  source_url: string | null;
  topic: string;
  language: string;
  body: string;
  medical_disclaimer: string;
  content_hash: string;
  review_status: KnowledgeStatus;
  created_by_user_id: string | null;
  created_at: string;
  submitted_for_review_at: string | null;
  submitted_by_user_id: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
  retired_at: string | null;
  retired_by_user_id: string | null;
  review_summary: string | null;
  supersedes_version_id: string | null;
  version: number;
}

export interface KnowledgeDocument {
  document_id: string;
  slug: string;
  title: string;
  current_version_id: string | null;
  current_version_number?: number | null;
  current_status: KnowledgeStatus;
  topic: string;
  language: string;
  created_by_user_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentDetail {
  document: KnowledgeDocument;
  current_version: KnowledgeVersion | null;
  versions: KnowledgeVersion[];
}

export interface KnowledgeDocumentListResponse {
  items: KnowledgeDocument[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeReviewQueueItem {
  document_id: string;
  version_id: string;
  version_number: number;
  title: string;
  topic: string;
  language: string;
  content_hash: string;
  submitted_for_review_at: string | null;
  submitted_by_user_id: string | null;
}

export interface KnowledgeReviewQueueResponse {
  items: KnowledgeReviewQueueItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeReviewRecord {
  id: string;
  document_id: string;
  version_id: string;
  reviewer_user_id: string;
  reviewer_role: string;
  decision: KnowledgeReviewDecision;
  reviewed_content_hash: string;
  comments: string | null;
  created_at: string;
}

export type IngestionStatus = "completed" | "failed";

export interface KnowledgeApprovalResult {
  document: KnowledgeDocument;
  version: KnowledgeVersion;
  ingestion_status: IngestionStatus | string;
  ingestion_message: string | null;
}

export interface KnowledgeDiffLine {
  op: string;
  from_line: string | null;
  to_line: string | null;
}

export interface KnowledgeCompareResponse {
  document_id: string;
  from_version_id: string | null;
  to_version_id: string;
  lines: KnowledgeDiffLine[];
  truncated: boolean;
}

// ---- Requests -----------------------------------------------------------------------

export interface KnowledgeDraftCreateRequest {
  slug: string;
  title: string;
  source_name: string;
  source_url?: string | null;
  topic: KnowledgeTopic;
  language?: KnowledgeLanguage;
  body: string;
  medical_disclaimer?: string;
}

export interface KnowledgeDraftUpdateRequest {
  title?: string;
  source_name?: string;
  source_url?: string | null;
  topic?: KnowledgeTopic;
  language?: KnowledgeLanguage;
  body?: string;
  medical_disclaimer?: string;
  expected_version: number;
}

export interface KnowledgeSubmitRequest {
  expected_version: number;
  submission_note?: string | null;
}

export interface KnowledgeReviewDecisionRequest {
  decision: KnowledgeReviewDecision;
  expected_version: number;
  expected_content_hash: string;
  comments?: string | null;
}

export interface KnowledgeNewVersionRequest {
  expected_version: number;
  title?: string;
  source_name?: string;
  source_url?: string | null;
  topic?: KnowledgeTopic;
  language?: KnowledgeLanguage;
  body?: string;
  medical_disclaimer?: string;
}

export interface KnowledgeRetireRequest {
  expected_version: number;
  reason: string;
}

export interface KnowledgeRestoreRequest {
  expected_version: number;
  expected_content_hash: string;
}

export interface KnowledgeListParams {
  status?: KnowledgeStatus;
  topic?: string;
  language?: string;
  page?: number;
  page_size?: number;
}
