import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

const PRIVATE_PATHS = [
  "/api/",
  "/org/",
  "/profile/",
  "/tickets/",
  "/scan/",
  "/login/",
  "/account/",
  "/promo/",
  "/order/",
  "/favorites/",
  "/recover-tickets/",
  "/preview/",
  "/demo-box/",
  "/demo/",
  "/auth/",
  "/claim/",
  "/invites/",
  "/unlock/",
  "/box/",
  "/apply/",
  "/events/*/buy",
  "/events/*/done",
  "/events/*/processing",
  "/events/*/pay-error",
  "/events/*/sold-out",
];

// Crawlers de IA y buscadores generativos — acceso explícito al contenido público.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "cohere-ai",
  "Bytespider",
  "FacebookBot",
  "meta-externalagent",
] as const;

export default function robots(): MetadataRoute.Robots {
  const aiRules: MetadataRoute.Robots["rules"] = AI_CRAWLERS.map((userAgent) => ({
    userAgent,
    allow: ["/", "/es/", "/en/", "/llms.txt", "/llms-full.txt", "/sitemap.xml"],
    disallow: PRIVATE_PATHS,
  }));

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      ...aiRules,
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
