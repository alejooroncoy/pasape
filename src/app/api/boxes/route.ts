import type { NextRequest } from "next/server";
import { BoxesController } from "@/server/boxes/controllers/rest/BoxesController";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const k = new URL(req.url).searchParams.get("k");
  return json(await BoxesController.create(body, k), 201);
};
