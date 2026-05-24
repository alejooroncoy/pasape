import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await IdentityController.listFollows());
