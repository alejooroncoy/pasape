import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await EventsController.createTicketType(slug, body);
  if (result.ok) {
    serverEvents.ticketTypeCreated(await getAuthDistinctId(), { event_slug: slug, kind: body.kind });
  }
  return json(result, 201);
};
