import axios from "axios";
import type { AppError, ApiErrorResponse, FieldValidationError } from "@/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseFields(value: unknown): FieldValidationError[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fields: FieldValidationError[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const field = item.field;
    const message = item.message;
    if (typeof field === "string" && typeof message === "string") {
      fields.push({ field, message });
    }
  }
  return fields.length > 0 ? fields : undefined;
}

/** Map FastAPI-style details[{loc,msg}] into field errors when present. */
function parseDetailsAsFields(value: unknown): FieldValidationError[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fields: FieldValidationError[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const loc = item.loc;
    const msg = item.msg;
    if (!Array.isArray(loc) || typeof msg !== "string") continue;
    const parts = loc.filter((p): p is string => typeof p === "string" && p !== "body");
    const field = parts[parts.length - 1];
    if (field) fields.push({ field, message: msg });
  }
  return fields.length > 0 ? fields : undefined;
}

/**
 * Converts unknown Axios/network errors into a safe application error.
 * Never exposes backend stack traces to the UI.
 */
export function toAppError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    let message = "Something went wrong. Please try again.";
    let code: string | undefined;
    let fields: FieldValidationError[] | undefined;

    if (isRecord(data)) {
      const api = data as Partial<ApiErrorResponse> & { details?: unknown };
      if (typeof api.message === "string" && api.message.trim()) {
        message = api.message;
      }
      if (typeof api.code === "string") code = api.code;
      fields = parseFields(api.fields) ?? parseDetailsAsFields(api.details);
    } else if (error.message === "Network Error") {
      message = "Unable to reach the server. Check your connection and try again.";
    }

    return {
      message,
      code,
      status,
      fields,
      isNetworkError: !error.response,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      message: "Something went wrong. Please try again.",
      isNetworkError: false,
    };
  }

  return {
    message: "Something went wrong. Please try again.",
    isNetworkError: false,
  };
}
