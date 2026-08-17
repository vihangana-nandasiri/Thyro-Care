import { api } from "@/services/api";
import { readCsrfCookie } from "@/services/csrf";
import type {
  AuthUser,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GoogleAuthRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  TokenResponse,
  VerifyEmailRequest,
} from "@/types/auth";
import { toAppError } from "@/utils/apiError";

function csrfHeaders(): Record<string, string> {
  const token = readCsrfCookie();
  return token ? { "X-CSRF-Token": token } : {};
}

export async function register(payload: RegisterRequest): Promise<TokenResponse> {
  try {
    const { data } = await api.post<TokenResponse>("/auth/register", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  try {
    const { data } = await api.post<TokenResponse>("/auth/login", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function googleLogin(payload: GoogleAuthRequest): Promise<TokenResponse> {
  try {
    const { data } = await api.post<TokenResponse>("/auth/google", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function refresh(): Promise<TokenResponse> {
  try {
    const { data } = await api.post<TokenResponse>(
      "/auth/refresh",
      {},
      {
        withCredentials: true,
        headers: csrfHeaders(),
      },
    );
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post(
      "/auth/logout",
      {},
      {
        withCredentials: true,
        headers: csrfHeaders(),
      },
    );
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  try {
    const { data } = await api.get<AuthUser>("/auth/me");
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function forgotPassword(payload: ForgotPasswordRequest): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("/auth/forgot-password", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function resetPassword(payload: ResetPasswordRequest): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("/auth/reset-password", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function verifyEmail(payload: VerifyEmailRequest): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("/auth/verify-email", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function resendVerification(
  payload?: ResendVerificationRequest,
): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("/auth/resend-verification", payload ?? {}, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function changePassword(payload: ChangePasswordRequest): Promise<MessageResponse> {
  try {
    const { data } = await api.post<MessageResponse>("/auth/change-password", payload, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
