import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await TicketsController.carouselScope(id));
};
