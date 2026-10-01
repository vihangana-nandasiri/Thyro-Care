import Link from "next/link";
import { listAccounts, listPatientsWithAssignments, listDoctors } from "@/lib/services/accounts";
import { AssignDoctorControl } from "@/components/assign-doctor-control";
import { buttonClass } from "@/components/ui";
import { getServerT } from "@/lib/i18n/server";

export default async function AccountsPage() {
  const [accounts, patients, doctors, { t }] = await Promise.all([
    listAccounts(),
    listPatientsWithAssignments(),
    listDoctors(),
    getServerT(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">{t("admin.accounts.title")}</h1>
          <Link href="/admin/accounts/new-doctor" className={`${buttonClass} w-auto px-4`}>
            {t("admin.accounts.addDoctor")}
          </Link>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">{t("admin.accounts.email")}</th>
              <th className="py-2">{t("admin.accounts.role")}</th>
              <th className="py-2">{t("admin.accounts.status")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="py-2">{a.email}</td>
                <td className="py-2">{t(`role.${a.role}`)}</td>
                <td className="py-2">{t(`userStatus.${a.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {t("admin.accounts.doctorAssignments")}
        </h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">{t("admin.accounts.patient")}</th>
              <th className="py-2">{t("admin.accounts.assignedDoctor")}</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.userId} className="border-b border-slate-100">
                <td className="py-2">{p.name}</td>
                <td className="py-2">
                  <AssignDoctorControl
                    patientId={p.userId}
                    doctors={doctors}
                    assignedDoctorIds={p.doctorIds}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
