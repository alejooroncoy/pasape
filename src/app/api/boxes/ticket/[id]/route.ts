import type { NextRequest } from "next/server";
import { BoxesController } from "@/server/boxes/controllers/rest/BoxesController";
import { json } from "@/server/_shared/http";

export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return json(await BoxesController.forTicket(id));
};
