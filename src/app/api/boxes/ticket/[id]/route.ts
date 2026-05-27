import type { NextRequest } from "next/server";
import { BoxesController } from "@/server/boxes/controllers/rest/BoxesController";
import { json } from "@/server/_shared/http";

export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const k = new URL(req.url).searchParams.get("k");
  return json(await BoxesController.forTicket(id, k));
};
