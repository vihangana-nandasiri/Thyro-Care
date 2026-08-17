import { Link } from "react-router";
import { BrandLogo } from "@/components/common";
import { ROUTES } from "@/constants/routes";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function MedicalDisclaimerPage() {
  useDocumentTitle("Medical disclaimer");
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
          Medical disclaimer
        </h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          Placeholder content — requires organizational/legal review before production use.
        </p>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            ThyroCare AI provides supportive educational information for thyroid cancer recovery and
            related care logistics. It is not a substitute for professional medical advice,
            diagnosis, treatment, or emergency services.
          </p>
          <p>
            Always consult a qualified clinician about your health. If you think you may be
            experiencing a medical emergency, call your local emergency number immediately.
          </p>
          <p>
            This draft must be reviewed by clinical and legal stakeholders before it is treated as
            the product&apos;s official medical disclaimer.
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
