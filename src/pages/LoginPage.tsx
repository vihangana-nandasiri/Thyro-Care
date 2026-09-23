import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Phone, ShieldCheck } from "lucide-react";
import { Btn, Input, BrandLogo } from "@/components/common";
import { GoogleSignInButton } from "@/components/auth";
import { BLUE, TEAL } from "@/constants/colors";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";
import { useAuth } from "@/context/AuthContext";
import { requestOtp } from "@/services/authService";
import { useToast } from "@/hooks/useToast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SkipLink } from "@/layouts/Sidebar";
import type { AppError } from "@/types/api";
import type { AuthUser } from "@/types/auth";

function isSafeInternalPath(path: string | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path === ROUTES.LOGIN || path === ROUTES.REGISTER) return false;
  return true;
}

function roleAllowsPath(role: string, path: string): boolean {
  if (role === "admin") {
    return path.startsWith("/admin") || path === ROUTES.PROFILE || path === ROUTES.EMERGENCY;
  }
  if (role === "medical_expert") {
    return (
      path.startsWith("/medical-review") || path === ROUTES.PROFILE || path === ROUTES.EMERGENCY
    );
  }
  // Patients: allow clinical app paths, not governance consoles.
  if (path.startsWith("/admin") || path.startsWith("/medical-review")) return false;
  return true;
}

function roleHomeFor(user: AuthUser): string {
  if (user.role === "admin") return ROUTES.ADMIN_KNOWLEDGE;
  if (user.role === "medical_expert") return ROUTES.MEDICAL_REVIEW;
  return ROUTES.DASHBOARD;
}

export function LoginPage() {
  useDocumentTitle("Login");
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithOtp, googleLogin } = useAuth();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const googleEnabled = Boolean(env.googleClientId);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const redirectAfterAuth = (signedInUser: AuthUser) => {
    const roleHome = roleHomeFor(signedInUser);
    const target =
      isSafeInternalPath(from) && roleAllowsPath(signedInUser.role, from) ? from : roleHome;
    navigate(target, { replace: true });
  };

  const onSendOtp = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await requestOtp(phoneNumber);
      setOtpSent(true);
      setResendIn(result.retry_after_seconds ?? 60);
      success(result.demo_otp ? `Demo OTP: ${result.demo_otp}` : "If registered, your OTP is on its way");
    } catch (err) {
      const appErr = err as AppError;
      const message = appErr?.message || "Enter a valid Sri Lankan phone number.";
      setFormError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onVerifyOtp = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const signedInUser = await loginWithOtp(phoneNumber, otp);
      success("Signed in successfully");
      redirectAfterAuth(signedInUser);
    } catch (err) {
      const appErr = err as AppError;
      const message = appErr?.message || "The OTP is incorrect or expired.";
      setFormError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleCredential = async (credential: string) => {
    if (googleBusy || submitting) return;
    setGoogleBusy(true);
    setFormError(null);
    try {
      const signedInUser = await googleLogin(credential);
      success("Signed in successfully");
      redirectAfterAuth(signedInUser);
    } catch (err) {
      const appErr = err as AppError;
      const message = appErr?.message || "Google Sign-In failed. Please try again.";
      setFormError(message);
      showError(message);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <>
      <SkipLink />
      <div
        className="min-h-screen bg-background grid lg:grid-cols-2"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="flex flex-col justify-center px-6 sm:px-8 py-12 max-w-md mx-auto w-full">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-8">
              <BrandLogo size="md" />
              <span
                className="font-bold text-lg text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ThyroCare AI
              </span>
            </div>
            <h1
              className="text-3xl font-bold text-foreground mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Welcome back
            </h1>
            <p className="text-muted-foreground">Continue your recovery journey</p>
          </div>

          <form
            id="main-content"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (otpSent ? onVerifyOtp() : onSendOtp());
            }}
            noValidate
          >
            <Input
              label="Sri Lankan phone number"
              type="tel"
              placeholder="+94771234567"
              autoComplete="tel"
              icon={<Phone className="w-4 h-4" />}
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={otpSent}
            />
            {otpSent ? (
              <Input
                label="6-digit OTP"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                icon={<ShieldCheck className="w-4 h-4" />}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              />
            ) : null}

            {formError ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <Btn
              className="w-full justify-center"
              size="lg"
              type="submit"
              disabled={submitting || googleBusy}
              aria-busy={submitting}
            >
              {submitting ? "Please wait…" : otpSent ? "Verify & Login" : "Send OTP"}
            </Btn>

            {otpSent ? (
              <button
                type="button"
                disabled={submitting || resendIn > 0}
                onClick={() => void onSendOtp()}
                className="w-full text-sm font-semibold text-primary disabled:text-muted-foreground"
              >
                {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
              </button>
            ) : null}

            {googleEnabled ? (
              <>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted-foreground">
                      or continue with
                    </span>
                  </div>
                </div>

                <GoogleSignInButton
                  disabled={submitting || googleBusy}
                  onCredential={onGoogleCredential}
                  onError={(message) => {
                    setFormError(message);
                    showError(message);
                  }}
                />
              </>
            ) : null}

            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <button
                type="button"
                onClick={() => navigate(ROUTES.REGISTER)}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Create one
              </button>
            </p>
          </form>
        </div>

        <div className="hidden lg:block relative overflow-hidden rounded-l-3xl m-4">
          <img
src="/bps1.jpeg"
            alt="Healthcare and recovery"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, ${BLUE}88 0%, ${TEAL}aa 100%)` }}
          />
          <div className="absolute bottom-12 left-8 right-8 text-white">
            <p
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
             &ldquo;Explore educational guidance and recovery support tools in one place.&rdquo;
            </p>
            <p className="opacity-80 text-sm">
              — Sample message for demonstration only
            </p>
            
          </div>
        </div>
      </div>
    </>
  );
}
