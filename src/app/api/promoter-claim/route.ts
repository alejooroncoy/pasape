import type { NextRequest } from "next/server";
import { PromoterClaimController } from "@/server/promoters/claim/controllers/rest/PromoterClaimController";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await PromoterClaimController.claim(body));
};
