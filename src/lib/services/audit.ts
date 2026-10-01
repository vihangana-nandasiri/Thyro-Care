import { db } from "@/db";
import { auditEvents, patientProfiles, users } from "@/db/schema";
import { and, eq, desc, inArray, or, sql } from "drizzle-orm";
import { NotFoundError } from "@/lib/errors";

export async function listAuditEvents(limit = 100) {
  return db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorEmail: users.email,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorId, users.id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

export const ALERT_STATUSES = ["new", "acknowledged", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

// Covers both true emergencies (chat/toggle detection, or an emergency-level
// symptom check) and urgent-level symptom checks — urgent used to be
// invisible to every alert/dashboard view, only reachable by opening a
// specific patient's symptom history. Severity below keeps them visually
// distinct; this never touches the notes/free-text safety boundary (FR-05.7
// — notes still never drive the safety classification itself).
const ALERT_EVENT = or(
  and(
    eq(auditEvents.action, "record_symptom"),
    sql`${auditEvents.metadata}->>'safetyLevel' in ('emergency', 'urgent')`,
  ),
  eq(auditEvents.action, "chat_emergency_detected"),
  // Recorded only by the patient's explicit "I'm having an emergency"
  // toggle — just opening the emergency page is not itself an alert.
  eq(auditEvents.action, "emergency_triggered"),
);

const SEVERITY_SQL = sql<"urgent" | "emergency">`case
  when ${auditEvents.action} = 'record_symptom' and ${auditEvents.metadata}->>'safetyLevel' = 'urgent' then 'urgent'
  else 'emergency'
end`;

/** Recent alert-worthy events (symptom safety checks, chat safety redirects,
 * the emergency-page toggle), optionally restricted to a doctor's assigned
 * patients. `newOnly` powers the dashboard banner (acknowledged or resolved alerts drop off it); the dedicated
 * alerts section shows the full history. */
export async function listEmergencyAlerts(
  patientIds?: string[],
  opts?: { newOnly?: boolean; limit?: number },
) {
  if (patientIds && patientIds.length === 0) return [];
  const where = and(
    ALERT_EVENT,
    patientIds ? inArray(auditEvents.actorId, patientIds) : undefined,
    opts?.newOnly
      ? sql`coalesce(${auditEvents.metadata}->>'status', 'new') = 'new'`
      : undefined,
  );
  return db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      severity: SEVERITY_SQL,
      createdAt: auditEvents.createdAt,
      patientId: auditEvents.actorId,
      patientName: patientProfiles.name,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .leftJoin(patientProfiles, eq(auditEvents.actorId, patientProfiles.userId))
    .where(where)
    .orderBy(desc(auditEvents.createdAt))
    .limit(opts?.limit ?? 20);
}

/** The alert's own patientId, so a doctor's route can check assignment
 * before allowing a status change. */
export async function getAlertPatientId(id: string): Promise<string | null> {
  const row = await db.query.auditEvents.findFirst({
    where: and(eq(auditEvents.id, id), ALERT_EVENT),
    columns: { actorId: true },
  });
  if (!row) throw new NotFoundError("Alert not found.");
  return row.actorId;
}

/** Merges `status` into the event's existing metadata (preserving fields
 * like lat/lng) rather than overwriting it. */
export async function updateAlertStatus(id: string, status: AlertStatus): Promise<void> {
  const [updated] = await db
    .update(auditEvents)
    .set({ metadata: sql`coalesce(${auditEvents.metadata}, '{}'::jsonb) || ${JSON.stringify({ status })}::jsonb` })
    .where(and(eq(auditEvents.id, id), ALERT_EVENT))
    .returning({ id: auditEvents.id });
  if (!updated) throw new NotFoundError("Alert not found.");
}
