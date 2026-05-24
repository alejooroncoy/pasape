import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { verifyTicketRecovery } from "@/server/tickets/application/RecoverTickets";

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as {
    identifier?: string;
    code?: string;
  } | null;
  return json(
    await verifyTicketRecovery({
      identifier: body?.identifier ?? "",
      code: body?.code ?? "",
    }),
  );
};
