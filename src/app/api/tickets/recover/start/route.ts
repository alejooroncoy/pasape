import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { startTicketRecovery } from "@/server/tickets/application/RecoverTickets";

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { identifier?: string } | null;
  return json(await startTicketRecovery({ identifier: body?.identifier ?? "" }));
};
