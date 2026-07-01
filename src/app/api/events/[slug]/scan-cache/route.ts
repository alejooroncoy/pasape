import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const since = new URL(req.url).searchParams.get("since");
  return json(await EventsController.getScanCache(slug, since));
};
