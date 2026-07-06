import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const result = await TicketsController.claim(body);
  if (result.ok) {
    serverEvents.ticketClaimed(await getAuthDistinctId(), {
      ticket_id: result.value.ticketId,
      event_slug: result.value.eventSlug,
    });
  }
  return json(result);
};
