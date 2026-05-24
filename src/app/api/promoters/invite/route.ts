import type { NextRequest } from "next/server";
import { PromotersController } from "@/server/promoters/controllers/rest/PromotersController";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await PromotersController.generate(body), 201);
};
