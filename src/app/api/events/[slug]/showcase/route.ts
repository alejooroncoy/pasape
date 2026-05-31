import { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { EventsController } from "@/server/events/controllers/rest/EventsController";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  return json(await EventsController.getOrgShowcase(slug));
};
