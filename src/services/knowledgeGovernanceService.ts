import { api } from "@/services/api";
import type {
  KnowledgeApprovalResult,
  KnowledgeCompareResponse,
  KnowledgeDocumentDetail,
  KnowledgeDocumentListResponse,
  KnowledgeDraftCreateRequest,
  KnowledgeDraftUpdateRequest,
  KnowledgeListParams,
  KnowledgeNewVersionRequest,
  KnowledgeRestoreRequest,
  KnowledgeRetireRequest,
  KnowledgeReviewDecisionRequest,
  KnowledgeReviewQueueResponse,
  KnowledgeReviewRecord,
  KnowledgeSubmitRequest,
  KnowledgeVersion,
} from "@/types/knowledgeGovernance";
import { toAppError } from "@/utils/apiError";

/**
 * Knowledge governance API client (Phase 12).
 *
 * Never logs request/response bodies, review comments, or submission notes — these
 * may contain sensitive draft clinical content. Never accepts an actor/user id from
 * callers; the backend always derives the acting user from the authenticated session.
 * No client-side auto-retry is performed for mutating calls — conflicts (409) must be
 * surfaced to the user for an explicit reload-and-retry decision.
 */

export async function listKnowledgeDocuments(
  params?: KnowledgeListParams,
): Promise<KnowledgeDocumentListResponse> {
  try {
    const { data } = await api.get<KnowledgeDocumentListResponse>("/governance/knowledge", {
      params,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createKnowledgeDraft(
  payload: KnowledgeDraftCreateRequest,
): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.post<KnowledgeDocumentDetail>("/governance/knowledge", payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getKnowledgeDocument(documentId: string): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.get<KnowledgeDocumentDetail>(`/governance/knowledge/${documentId}`);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function listKnowledgeVersions(documentId: string): Promise<KnowledgeVersion[]> {
  try {
    const { data } = await api.get<KnowledgeVersion[]>(
      `/governance/knowledge/${documentId}/versions`,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getKnowledgeVersion(
  documentId: string,
  versionId: string,
): Promise<KnowledgeVersion> {
  try {
    const { data } = await api.get<KnowledgeVersion>(
      `/governance/knowledge/${documentId}/versions/${versionId}`,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateKnowledgeDraftVersion(
  documentId: string,
  versionId: string,
  payload: KnowledgeDraftUpdateRequest,
): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.patch<KnowledgeDocumentDetail>(
      `/governance/knowledge/${documentId}/versions/${versionId}`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function submitKnowledgeForReview(
  documentId: string,
  versionId: string,
  payload: KnowledgeSubmitRequest,
): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.post<KnowledgeDocumentDetail>(
      `/governance/knowledge/${documentId}/versions/${versionId}/submit`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createKnowledgeNewVersion(
  documentId: string,
  payload: KnowledgeNewVersionRequest,
): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.post<KnowledgeDocumentDetail>(
      `/governance/knowledge/${documentId}/versions/new`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function retireKnowledgeDocument(
  documentId: string,
  payload: KnowledgeRetireRequest,
): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.post<KnowledgeDocumentDetail>(
      `/governance/knowledge/${documentId}/retire`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function restoreKnowledgeDocument(
  documentId: string,
  payload: KnowledgeRestoreRequest,
): Promise<KnowledgeApprovalResult> {
  try {
    const { data } = await api.post<KnowledgeApprovalResult>(
      `/governance/knowledge/${documentId}/restore`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getKnowledgeReviewHistory(
  documentId: string,
): Promise<KnowledgeReviewRecord[]> {
  try {
    const { data } = await api.get<KnowledgeReviewRecord[]>(
      `/governance/knowledge/${documentId}/review-history`,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function compareKnowledgeVersions(
  documentId: string,
  toVersionId: string,
  fromVersionId?: string | null,
): Promise<KnowledgeCompareResponse> {
  try {
    const { data } = await api.get<KnowledgeCompareResponse>(
      `/governance/knowledge/${documentId}/compare`,
      {
        params: {
          to_version_id: toVersionId,
          from_version_id: fromVersionId || undefined,
        },
      },
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function listReviewQueue(params?: {
  page?: number;
  page_size?: number;
}): Promise<KnowledgeReviewQueueResponse> {
  try {
    const { data } = await api.get<KnowledgeReviewQueueResponse>("/governance/review-queue", {
      params,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getReviewQueueItem(
  documentId: string,
  versionId: string,
): Promise<KnowledgeDocumentDetail> {
  try {
    const { data } = await api.get<KnowledgeDocumentDetail>(
      `/governance/review-queue/${documentId}/${versionId}`,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function submitReviewDecision(
  documentId: string,
  versionId: string,
  payload: KnowledgeReviewDecisionRequest,
): Promise<KnowledgeApprovalResult | KnowledgeDocumentDetail> {
  try {
    const { data } = await api.post<KnowledgeApprovalResult | KnowledgeDocumentDetail>(
      `/governance/review-queue/${documentId}/${versionId}/decision`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function retryKnowledgeIngestion(
  documentId: string,
  versionId: string,
  payload: { expected_content_hash: string },
): Promise<KnowledgeApprovalResult> {
  try {
    const { data } = await api.post<KnowledgeApprovalResult>(
      `/governance/knowledge/${documentId}/versions/${versionId}/reingest`,
      payload,
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
