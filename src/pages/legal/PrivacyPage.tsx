import { Link } from "react-router";
import { BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function PrivacyPage() {
  useDocumentTitle("Privacy Policy");
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
          Privacy Policy
        </h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          Placeholder content — requires organizational/legal review before production use.
        </p>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            ThyroCare AI may collect account details (such as name and email), health-related
            information you choose to enter, and technical logs needed to operate the service
            securely.
          </p>
          <p>
            We use this information to provide recovery support features, authenticate your account,
            and improve reliability. We do not sell personal data.
          </p>
          <p>
            This draft does not constitute a complete privacy notice. Replace it with
            counsel-approved language covering retention, processors, international transfers, and
            user rights.
          </p>
        </div>
        <Link
          to={ROUTES.HOME}
          className="inline-block mt-8 text-sm font-semibold text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
