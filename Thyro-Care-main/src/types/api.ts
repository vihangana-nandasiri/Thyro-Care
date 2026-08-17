/** Shared API contract types for future backend integration (Phase 4+). */

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  status?: number;
  fields?: FieldValidationError[];
}

export interface FieldValidationError {
  field: string;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Safe client-side error shape — never includes stack traces. */
export interface AppError {
  message: string;
  code?: string;
  status?: number;
  fields?: FieldValidationError[];
  isNetworkError: boolean;
}
