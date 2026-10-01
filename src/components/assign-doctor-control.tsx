"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/context";

export function AssignDoctorControl({
  patientId,
  doctors,
  assignedDoctorIds,
}: {
  patientId: string;
  doctors: { userId: string; name: string }[];
  assignedDoctorIds: string[];
}) {
  const router = useRouter();
  const { t } = useT();
  const [submitting, setSubmitting] = useState(false);

  async function onAssign(e: React.ChangeEvent<HTMLSelectElement>) {
    const doctorId = e.target.value;
    if (!doctorId) return;
    setSubmitting(true);
    await fetch(`/api/admin/patients/${patientId}/assign-doctor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId }),
    });
    setSubmitting(false);
    router.refresh();
  }

  const assignedNames = doctors
    .filter((d) => assignedDoctorIds.includes(d.userId))
    .map((d) => d.name)
    .join(", ");

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">
        {assignedNames || t("admin.accounts.unassigned")}
      </span>
      <select
        aria-label={t("admin.accounts.assignDoctorAria")}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
        disabled={submitting}
        defaultValue=""
        onChange={onAssign}
      >
        <option value="" disabled>{t("admin.accounts.assignDoctor")}</option>
        {doctors.map((d) => (
          <option key={d.userId} value={d.userId} disabled={assignedDoctorIds.includes(d.userId)}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
