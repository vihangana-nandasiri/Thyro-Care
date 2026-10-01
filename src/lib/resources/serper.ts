import { z } from "zod";
import type { Lang } from "@/lib/i18n/config";
import { publicUrl, type ResourceKind, type ResourceInput } from "./types";

export function isSerperEnabled() {
  return !!process.env.SERPER_API_KEY;
}
const hit = z
  .object({
    title: z.string().optional(),
    link: z.string().optional(),
    snippet: z.string().optional(),
    imageUrl: z.string().optional(),
    thumbnail: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    image: z.string().optional(),
  })
  .passthrough();
const resultSchema = z.object({
  organic: z.array(hit).optional(),
  news: z.array(hit).optional(),
  videos: z.array(hit).optional(),
  images: z.array(hit).optional(),
});
export async function serperSearch(
  endpoint: "search" | "news" | "videos" | "images",
  query: string,
  lang: Lang,
) {
  if (!isSerperEnabled()) return null;
  const response = await fetch(`https://google.serper.dev/${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query.slice(0, 300),
      gl: "lk",
      hl: lang,
      num: 9,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Search provider unavailable");
  return resultSchema.parse(await response.json());
}
export async function discoverResources(
  query: string,
  kind: ResourceKind,
  lang: Lang,
): Promise<ResourceInput[]> {
  const data = await serperSearch(
    kind === "article" ? "search" : kind === "video" ? "videos" : "news",
    `${query} thyroid health patient education`,
    lang,
  );
  if (!data) return [];
  const items =
    kind === "article"
      ? data.organic
      : kind === "video"
        ? data.videos
        : data.news;
  return (items ?? [])
    .filter((r) => r.title && r.link && publicUrl(r.link))
    .map((r) => {
      const image = r.imageUrl ?? r.thumbnail ?? r.image;
      return {
        title: r.title!.slice(0, 300),
        url: r.link!,
        description: (r.snippet ?? "").slice(0, 1200),
        imageUrl: image && publicUrl(image) ? image : null,
        kind,
        language: lang,
      };
    });
}
