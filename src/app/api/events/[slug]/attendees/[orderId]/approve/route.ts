import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const POST = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> },
) => {
  const { slug, orderId } = await params;
  return json(await EventsController.approveRegistration(slug, orderId));
};
