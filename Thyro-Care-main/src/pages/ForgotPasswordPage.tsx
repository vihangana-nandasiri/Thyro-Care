import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, ChevronLeft } from "lucide-react";
import { Btn, Input, BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/schemas/authSchemas";
import { forgotPassword } from "@/services/authService";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SkipLink } from "@/layouts/Sidebar";

const GENERIC_SUCCESS =
  "If an account exists for that email, password reset instructions will be sent.";

export function ForgotPasswordPage() {
  useDocumentTitle("Forgot password");
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await forgotPassword({ email: values.email });
    } catch {
      // Always show generic success — never reveal account existence.
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
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
              Forgot password
            </h1>
            <p className="text-muted-foreground">
              Enter your email and we will send reset instructions if an account exists.
            </p>
          </div>

          {submitted ? (
            <div id="main-content" className="space-y-4">
              <p className="text-sm text-foreground" role="status">
                {GENERIC_SUCCESS}
              </p>
              <Link
                to={ROUTES.LOGIN}
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                Return to sign in
              </Link>
            </div>
          ) : (
            <form
              id="main-content"
              className="space-y-4"
              onSubmit={handleSubmit(onSubmit, () => setFocus("email"))}
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
              <Btn
                className="w-full justify-center"
                size="lg"
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </Btn>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
