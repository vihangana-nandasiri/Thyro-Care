import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getOwnProfile } from "@/lib/services/profile";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ProfileForm } from "@/components/profile-form";
import { MfaEnrollment } from "@/components/mfa-enrollment";
import { getServerT } from "@/lib/i18n/server";

export default async function ProfilePage() {
  const session = await getSession();
  const [profile, user, { t }] = await Promise.all([
    getOwnProfile(session!.sub),
    db.query.users.findFirst({ where: eq(users.id, session!.sub) }),
    getServerT(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("profile.title")}</h1>
        <div className="mt-4">
          <ProfileForm profile={profile} />
        </div>
      </div>
      <div className="max-w-lg border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("profile.security")}</h2>
        <div className="mt-3">
          <MfaEnrollment initiallyEnabled={user?.mfaEnabled ?? false} />
        </div>
      </div>
    </div>
  );
}
