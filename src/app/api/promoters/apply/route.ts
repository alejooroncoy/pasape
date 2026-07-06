import type { NextRequest } from "next/server";
import { PromotersController } from "@/server/promoters/controllers/rest/PromotersController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const result = await PromotersController.apply(body);
  if (result.ok) {
    serverEvents.promoterApplied(await getAuthDistinctId(), { event_id: body.eventId });
  }
  return json(result, 201);
};
