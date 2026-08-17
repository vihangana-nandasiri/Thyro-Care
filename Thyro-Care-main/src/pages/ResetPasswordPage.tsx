import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
import { Btn, Input, BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/schemas/authSchemas";
import { resetPassword } from "@/services/authService";
import { readAndClearTokenFragment } from "@/utils/authTokenFragment";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SkipLink } from "@/layouts/Sidebar";
import type { AppError } from "@/types/api";

export function ResetPasswordPage() {
  useDocumentTitle("Reset password");
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const value = readAndClearTokenFragment();
    if (!value) {
      setTokenMissing(true);
      return;
    }
    setToken(value);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (submitting || !token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await resetPassword({
        token,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
      });
      setDone(true);
    } catch (err) {
      const appErr = err as AppError;
      setFormError(
        appErr?.message || "Unable to reset password. The link may be invalid or expired.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = () => {
    if (errors.newPassword) setFocus("newPassword");
    else if (errors.confirmPassword) setFocus("confirmPassword");
  };

  return (
    <>
      <SkipLink />
      <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="max-w-md mx-auto px-6 sm:px-8 py-12">
          <button
            type="button"
            onClick={() => navigate(ROUTES.LOGIN)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to sign in
          </button>

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
              Reset password
            </h1>
            <p className="text-muted-foreground">Choose a new password for your account.</p>
          </div>

          {tokenMissing ? (
            <div id="main-content" className="space-y-4">
              <p className="text-sm text-red-600" role="alert">
                This reset link is missing or invalid. Request a new password reset email.
              </p>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                Request a new link
              </Link>
            </div>
          ) : done ? (
            <div id="main-content" className="space-y-4">
              <p className="text-sm text-foreground" role="status">
                Password updated. Sign in with your new password.
              </p>
              <Link
                to={ROUTES.LOGIN}
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form
              id="main-content"
              className="space-y-4"
              onSubmit={handleSubmit(onSubmit, onInvalid)}
              noValidate
            >
              <Input
                label="New password"
                type="password"
                placeholder="At least 10 characters"
                autoComplete="new-password"
                error={errors.newPassword?.message}
                {...register("newPassword")}
              />
              <Input
                label="Confirm new password"
                type="password"
                placeholder="Repeat your password"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
              {formError ? (
                <p className="text-sm text-red-600" role="alert">
                  {formError}
                </p>
              ) : null}
              <Btn
                className="w-full justify-center"
                size="lg"
                type="submit"
                disabled={submitting || !token}
                aria-busy={submitting}
              >
                {submitting ? "Updating…" : "Update password"}
              </Btn>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
