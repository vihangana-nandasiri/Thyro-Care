import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { medicalReports } from "@/db/schema";
import { uploadObject, presignedGetUrl } from "@/lib/storage/s3";
import { NotFoundError, ValidationError } from "@/lib/errors";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export async function uploadReport(
  patientId: string,
  filename: string,
  contentType: string,
  body: Uint8Array,
) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new ValidationError("Only PDF, PNG, or JPEG files are accepted.");
  }
  if (body.byteLength > MAX_SIZE_BYTES) {
    throw new ValidationError("File is larger than the 15MB limit.");
  }
  const objectKey = `reports/${patientId}/${randomUUID()}-${filename}`;
  await uploadObject(objectKey, body, contentType);
  const [report] = await db
    .insert(medicalReports)
    .values({ patientId, objectKey, filename, contentType, sizeBytes: body.byteLength })
    .returning();
  return report;
}

export async function listReports(patientId: string) {
  const rows = await db.query.medicalReports.findMany({
    where: and(eq(medicalReports.patientId, patientId), isNull(medicalReports.deletedAt)),
    orderBy: (r, { desc }) => [desc(r.uploadedAt)],
  });
  return Promise.all(
    rows.map(async (r) => ({ ...r, viewUrl: await presignedGetUrl(r.objectKey) })),
  );
}

export async function softDeleteReport(id: string, patientId: string) {
  const [updated] = await db
    .update(medicalReports)
    .set({ deletedAt: new Date() })
    .where(and(eq(medicalReports.id, id), eq(medicalReports.patientId, patientId)))
    .returning();
  if (!updated) throw new NotFoundError("Report not found.");
  return updated;
}
