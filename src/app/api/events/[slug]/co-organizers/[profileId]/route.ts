import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; profileId: string }> },
) => {
  const { slug, profileId } = await params;
  return json(await EventsController.removeCoOrganizer(slug, profileId));
};
