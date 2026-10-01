import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { educationalResources, users } from "@/db/schema";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import type { Lang } from "@/lib/i18n/config";
import type { ResourceInput } from "@/lib/resources/types";
export async function listResources(lang: Lang, admin = false) {
  return db
    .select()
    .from(educationalResources)
    .where(
      admin
        ? eq(educationalResources.language, lang)
        : and(
            eq(educationalResources.status, "approved"),
            isNotNull(educationalResources.approvedBy),
            isNotNull(educationalResources.doctorApprovedBy),
            eq(educationalResources.language, lang),
          ),
    )
    .orderBy(desc(educationalResources.createdAt))
    .limit(100);
}
export async function saveResource(actor: string, input: ResourceInput) {
  const [resource] = await db
    .insert(educationalResources)
    .values({ ...input, createdBy: actor, status: "pending" })
    .returning();
  return resource;
}
export async function decideResource(
  actor: string,
  id: string,
  status: "approved" | "rejected" | "pending",
  version: number,
) {
  const role = await reviewerRole(actor);
  const doctor = role === "doctor";
  const reset = {
    approvedBy: null,
    approvedAt: null,
    doctorApprovedBy: null,
    doctorApprovedAt: null,
  };
  const [resource] = await db
    .update(educationalResources)
    .set({
      ...(status === "approved"
        ? doctor
          ? { doctorApprovedBy: actor, doctorApprovedAt: new Date() }
          : { approvedBy: actor, approvedAt: new Date() }
        : reset),
      status:
        status === "approved"
          ? sql`case when ${doctor ? educationalResources.approvedBy : educationalResources.doctorApprovedBy} is not null then 'approved'::resource_status else 'pending'::resource_status end`
          : status,
      version: sql`${educationalResources.version} + 1`,
    })
    .where(
      and(
        eq(educationalResources.id, id),
        eq(educationalResources.version, version),
      ),
    )
    .returning();
  if (!resource) throw new ConflictError();
  return resource;
}

async function reviewerRole(actor: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, actor) });
  if (
    !user ||
    user.status !== "active" ||
    !["doctor", "admin"].includes(user.role)
  )
    throw new ForbiddenError();
  return user.role;
}

export async function editResource(
  actor: string,
  id: string,
  input: ResourceInput,
  version: number,
) {
  await reviewerRole(actor);
  const [resource] = await db
    .update(educationalResources)
    .set({
      ...input,
      status: "pending",
      approvedBy: null,
      approvedAt: null,
      doctorApprovedBy: null,
      doctorApprovedAt: null,
      version: sql`${educationalResources.version} + 1`,
    })
    .where(
      and(
        eq(educationalResources.id, id),
        eq(educationalResources.version, version),
      ),
    )
    .returning();
  if (!resource) throw new ConflictError();
  return resource;
}

export async function deleteResource(
  actor: string,
  id: string,
  version: number,
) {
  if ((await reviewerRole(actor)) !== "admin") throw new ForbiddenError();
  const removed = await db
    .delete(educationalResources)
    .where(
      and(
        eq(educationalResources.id, id),
        eq(educationalResources.version, version),
      ),
    )
    .returning({ id: educationalResources.id });
  if (!removed.length) throw new ConflictError();
}
