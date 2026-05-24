import type { NextRequest } from "next/server";
import { PromotersController } from "@/server/promoters/controllers/rest/PromotersController";
import { json } from "@/server/_shared/http";

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  return json(await PromotersController.home(slug));
};
