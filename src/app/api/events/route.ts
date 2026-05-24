import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const GET = async (req: NextRequest) => {
  const scope = req.nextUrl.searchParams.get("scope");
  if (scope === "mine") return json(await EventsController.listMine());
  return json(await EventsController.listPublic());
};

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await EventsController.create(body), 201);
};
