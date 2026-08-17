import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { BrandLogo, Btn } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { verifyEmail } from "@/services/authService";
import { readAndClearTokenFragment } from "@/utils/authTokenFragment";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SkipLink } from "@/layouts/Sidebar";
import type { AppError } from "@/types/api";

type Status = "working" | "success" | "error" | "missing";

export function VerifyEmailPage() {
  useDocumentTitle("Verify email");
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const token = readAndClearTokenFragment();
    if (!token) {
      setStatus("missing");
      setMessage("This verification link is missing or invalid.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await verifyEmail({ token });
        if (cancelled) return;
        setStatus("success");
        setMessage(result.message || "Your email has been verified.");
      } catch (err) {
        if (cancelled) return;
        const appErr = err as AppError;
        setStatus("error");
        setMessage(
          appErr?.message || "Unable to verify email. The link may be invalid or expired.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
              Email verification
            </h1>
          </div>

          <div id="main-content" className="space-y-4">
            <p
              className={`text-sm ${status === "error" || status === "missing" ? "text-red-600" : "text-foreground"}`}
              role={status === "error" || status === "missing" ? "alert" : "status"}
            >
              {message}
            </p>
            {(status === "success" || status === "error" || status === "missing") && (
              <div className="flex flex-wrap gap-3">
                <Btn type="button" size="sm" onClick={() => navigate(ROUTES.LOGIN)}>
                  Sign in
                </Btn>
                {status !== "success" ? (
                  <Link
                    to={ROUTES.LOGIN}
                    className="text-sm font-semibold text-primary hover:underline self-center"
                  >
                    Request a new verification from your profile after signing in
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
