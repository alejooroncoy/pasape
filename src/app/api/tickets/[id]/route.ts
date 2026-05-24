import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await TicketsController.one(id));
};
