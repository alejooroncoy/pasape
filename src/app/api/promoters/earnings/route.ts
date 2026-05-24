import { PromotersController } from "@/server/promoters/controllers/rest/PromotersController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await PromotersController.earnings());
