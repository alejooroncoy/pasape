import type { NextRequest } from "next/server";
import { PromotersController } from "@/server/promoters/controllers/rest/PromotersController";
import { json } from "@/server/_shared/http";

export const GET = async (req: NextRequest) => {
  const slug = req.nextUrl.searchParams.get("eventSlug");
  if (!slug) return json({ ok: false, error: "missing_event_slug" });
  return json(await PromotersController.pending(slug));
};

export const PATCH = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await PromotersController.decide(body));
};
