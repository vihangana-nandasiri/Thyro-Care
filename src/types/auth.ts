/** Shared authentication types aligned with backend enums (lowercase). */

export type UserRole = "patient" | "admin" | "medical_expert";

export type AccountStatus = "active" | "inactive" | "suspended" | "pending";

export type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  email_verified: boolean;
  created_at: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  consent_accepted: boolean;
  disclaimer_accepted: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface GoogleAuthRequest {
  credential: string;
}

export interface MessageResponse {
  success: boolean;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  role: UserRole | null;
  login: (payload: LoginRequest) => Promise<AuthUser>;
  googleLogin: (credential: string) => Promise<AuthUser>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}
