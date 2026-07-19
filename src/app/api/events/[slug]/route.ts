import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const result = await EventsController.getBySlug(slug);
  const response = json(result);
  // Solo el read-model publicado puede vivir en CDN. Draft/cancelled podría
  // contener información de un organizador autenticado, así que queda privado.
  if (result.ok && (result.value.event.status === "published" || result.value.event.status === "closed")) {
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  } else {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await EventsController.update(slug, body));
};
