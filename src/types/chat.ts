/** Chat types aligned with backend Phase 11 schemas. */

export type ChatResponseMode =
  | "grounded_answer"
  | "insufficient_evidence"
  | "safety_redirect"
  | "provider_unavailable"
  | "policy_refusal";

export type ChatMessageRole = "user" | "assistant";

export interface ChatCitation {
  citation_id: string;
  document_id: string;
  title: string;
  source_name: string;
  source_url: string | null;
  document_version: string;
  excerpt: string;
  approved?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  version: number;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  response_mode: ChatResponseMode | null;
  evidence_coverage?: string | null;
  follow_up_suggestions?: string[];
  citations: ChatCitation[];
  safety_notice: string | null;
  created_at: string;
}

export interface ChatSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
}

export interface ChatSessionListResponse {
  items: ChatSession[];
  page: number;
  page_size: number;
  total: number;
}

export interface ChatAssistantResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  response_mode: ChatResponseMode;
  citations: ChatCitation[];
  evidence_coverage?: string | null;
  follow_up_suggestions?: string[];
  safety_notice: string | null;
  safety_check_url: string | null;
  emergency_page_url: string | null;
  disclaimer: string;
}

/** UI bubble adapter for existing ChatBubble design. */
export interface ChatMsg {
  id: string | number;
  from: "ai" | "user";
  text: string;
  time: string;
  response_mode?: ChatResponseMode | null;
  citations?: ChatCitation[];
  evidence_coverage?: string | null;
  follow_up_suggestions?: string[];
  safety_notice?: string | null;
  isStreaming?: boolean;
}

export type ChatFeedbackRating = "up" | "down";

export interface ChatFeedbackRequest {
  rating: ChatFeedbackRating;
  reason_code?: string;
  comment?: string;
}
