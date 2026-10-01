import { db } from "@/db";
import { auditEvents } from "@/db/schema";

/**
 * `metadata` must stay a small allowlisted object — never raw payloads,
 * chat text, or provider responses (NFR-02).
 */
export async function recordAuditEvent(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditEvents).values({ actorId, action, entityType, entityId, metadata });
}
