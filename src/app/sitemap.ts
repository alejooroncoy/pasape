import type { MetadataRoute } from "next";
import { SITEMAP_STATIC_PATHS } from "@/lib/seo/pages";
import { listPublishedEvents } from "@/server/events/application/ListPublishedEvents";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { SITE_URL, SUPPORTED_LOCALES, localePath } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [];

  for (const locale of SUPPORTED_LOCALES) {
    for (const path of SITEMAP_STATIC_PATHS) {
      pages.push({
        url: new URL(localePath(locale, path), SITE_URL).toString(),
        lastModified: now,
        changeFrequency: path === "/" ? "daily" : "weekly",
        priority: path === "/" ? 1 : path.startsWith("/eventos") ? 0.85 : 0.7,
      });
    }
  }

  const events = await listPublishedEvents({ repo }, { limit: 500 });
  for (const ev of events) {
    for (const locale of SUPPORTED_LOCALES) {
      pages.push({
        url: new URL(localePath(locale, `/events/${ev.slug}`), SITE_URL).toString(),
        lastModified: ev.createdAt ? new Date(ev.createdAt) : now,
        changeFrequency: ev.status === "published" ? "daily" : "weekly",
        priority: 0.9,
      });
    }
  }

  return pages;
}
