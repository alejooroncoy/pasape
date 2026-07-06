import type { NextRequest } from "next/server";
import { EventPromotersController } from "@/server/promoters/controllers/rest/EventPromotersController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  return json(await EventPromotersController.list(slug));
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await EventPromotersController.assign(slug, body);
  if (result.ok) {
    serverEvents.promoterLinkCreated(await getAuthDistinctId(), { event_slug: slug });
  }
  return json(result, 201);
};
