import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await TicketsController.transfer(body));
};
