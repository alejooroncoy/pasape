import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";

// Ingesta de scans offline (auditoría): el portero sube aquí los problemas que
// registró sin red al reconectar. No re-valida; solo persiste en scan_events.
export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const slug = (body as { eventSlug?: string }).eventSlug ?? "";
  return json(await EventsController.recordScanEvent(slug, body));
};
