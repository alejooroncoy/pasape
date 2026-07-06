import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const POST = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const result = await EventsController.publishBySlug(slug);
  if (result.ok) {
    serverEvents.eventPublished(await getAuthDistinctId(), { event_slug: slug });
  }
  return json(result);
};
