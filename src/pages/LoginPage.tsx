import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Star } from "lucide-react";
import { Btn, Input, BrandLogo } from "@/components/common";
import { GoogleSignInButton } from "@/components/auth";
import { BLUE, TEAL } from "@/constants/colors";
import { ROUTES } from "@/constants/routes";
import { env } from "@/config/env";
import { useAuth } from "@/context/AuthContext";
import { loginSchema, type LoginFormValues } from "@/schemas/authSchemas";
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
  const { login, googleLogin } = useAuth();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const googleEnabled = Boolean(env.googleClientId);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const redirectAfterAuth = (signedInUser: AuthUser) => {
    const roleHome = roleHomeFor(signedInUser);
    const target =
      isSafeInternalPath(from) && roleAllowsPath(signedInUser.role, from) ? from : roleHome;
    navigate(target, { replace: true });
  };

  const onSubmit = async (values: LoginFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const signedInUser = await login({ email: values.email, password: values.password });
      success("Signed in successfully");
      redirectAfterAuth(signedInUser);
    } catch (err) {
      const appErr = err as AppError;
      const message = appErr?.message || "Invalid email or password.";
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

  const onInvalid = () => {
    if (errors.email) setFocus("email");
    else if (errors.password) setFocus("password");
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
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            noValidate
          >
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              icon={<User className="w-4 h-4" />}
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            {formError ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" {...register("remember")} />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Btn
              className="w-full justify-center"
              size="lg"
              type="submit"
              disabled={submitting || googleBusy}
              aria-busy={submitting}
            >
              {submitting ? "Signing in…" : "Sign In"}
            </Btn>

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
            src="https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?w=800&h=900&fit=crop&auto=format"
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
              &ldquo;ThyroCare AI transformed my recovery experience completely.&rdquo;
            </p>
            <p className="opacity-80 text-sm">
              — Sarah M., Thyroid Cancer Survivor, 18 months post-surgery
            </p>
            <div className="flex gap-1 mt-3" aria-label="5 out of 5 stars">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-current text-yellow-300" aria-hidden="true" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
