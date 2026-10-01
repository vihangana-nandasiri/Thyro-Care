import Link from "next/link";
import { SymptomForm } from "@/components/symptom-form";
import { getServerT } from "@/lib/i18n/server";

export default async function NewSymptomPage() {
  const { t } = await getServerT();
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{t("symptoms.newTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {t("symptoms.newIntro")}{" "}
        <Link className="text-teal-700 hover:underline" href="/emergency">
          {t("emergency.title")}
        </Link>
      </p>
      <div className="mt-4">
        <SymptomForm />
      </div>
    </div>
  );
}
