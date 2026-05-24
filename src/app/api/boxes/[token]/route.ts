import type { NextRequest } from "next/server";
import { BoxesController } from "@/server/boxes/controllers/rest/BoxesController";
import { json } from "@/server/_shared/http";

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  return json(await BoxesController.byToken(token));
};
