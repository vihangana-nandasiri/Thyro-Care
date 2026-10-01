import { z } from "zod";
export const resourceKinds = ["article", "news", "video"] as const;
export type ResourceKind = (typeof resourceKinds)[number];
export function publicUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.)/i.test(
        u.hostname,
      ) &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}
export const resourceInput = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().max(2048).refine(publicUrl),
  description: z.string().max(1200).default(""),
  imageUrl: z.string().max(2048).refine(publicUrl).nullable().default(null),
  kind: z.enum(resourceKinds),
  language: z.enum(["en", "si", "ta"]),
});
export type ResourceInput = z.infer<typeof resourceInput>;
export type ResourceItem = ResourceInput & {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approvedBy: string | null;
  doctorApprovedBy: string | null;
  version: number;
};
