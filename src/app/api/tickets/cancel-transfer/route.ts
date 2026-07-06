import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const result = await TicketsController.cancelTransfer(body);
  if (result.ok) {
    serverEvents.ticketTransferCancelled(await getAuthDistinctId(), { ticket_id: body.ticketId });
  }
  return json(result);
};
