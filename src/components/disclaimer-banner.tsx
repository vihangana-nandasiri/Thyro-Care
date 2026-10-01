"use client";

import { useT } from "@/lib/i18n/context";

export function DisclaimerBanner() {
  const { t } = useT();

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {t("disclaimer.banner")}
    </div>
  );
}
