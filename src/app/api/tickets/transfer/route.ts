import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const result = await TicketsController.transfer(body);
  if (result.ok) {
    serverEvents.ticketTransferStarted(await getAuthDistinctId(), { ticket_id: body.ticketId });
  }
  return json(result);
};
