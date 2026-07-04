import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  return json(await EventsController.listCourtesies(slug));
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await EventsController.sendCourtesy(slug, body), 201);
};
