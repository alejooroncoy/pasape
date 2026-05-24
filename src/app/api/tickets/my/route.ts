import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await TicketsController.mine());
