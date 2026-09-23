import { Link } from "react-router";
import { BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useLanguage } from "@/context/LanguageContext";

export function TermsPage() {
  useDocumentTitle("Terms of Service");
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
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
          className="text-3xl font-bold text-foreground mb-4"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {t("Terms of Service")}
        </h1>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            By creating an account or using ThyroCare AI, you agree to use the service lawfully,
            keep your credentials secure, and provide accurate information to the best of your
            ability.
          </p>
          <p>
            The service may change, pause, or end features over time. Accounts may be suspended for
            misuse, security risk, or policy violations.
          </p>
          <p>
            This draft is not a complete agreement. Replace it with counsel-approved terms covering
            liability limits, governing law, dispute resolution, and acceptable use.
          </p>
        </div>
        <Link
          to={ROUTES.HOME}
          className="inline-block mt-8 text-sm font-semibold text-primary hover:underline"
        >
          {t("Back to home")}
        </Link>
      </div>
    </div>
  );
}
