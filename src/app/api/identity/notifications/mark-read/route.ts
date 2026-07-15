import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";

export const POST = async () => json(await IdentityController.markTicketNotificationsRead());
