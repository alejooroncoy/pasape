import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; zoneId: string }> },
) => {
  const { slug, zoneId } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await EventsController.updateZone(slug, zoneId, body));
};

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; zoneId: string }> },
) => {
  const { slug, zoneId } = await params;
  return json(await EventsController.deleteZone(slug, zoneId));
};
