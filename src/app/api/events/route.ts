import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";
import type { EventCategory } from "@/server/events/domain/Event";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

const VALID_CATEGORIES = new Set<string>(["conciertos","fiestas","festivales","comedia","cultura","deportes"]);

export const GET = async (req: NextRequest) => {
  const scope = req.nextUrl.searchParams.get("scope");
  if (scope === "mine") return json(await EventsController.listMine());
  const cat = req.nextUrl.searchParams.get("category");
  const category = cat && VALID_CATEGORIES.has(cat) ? (cat as EventCategory) : null;
  // Búsqueda del header (debounced en cliente): mínimo 2 chars, cap defensivo.
  const rawQ = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const search = rawQ.length >= 2 ? rawQ.slice(0, 60) : null;
  return json(await EventsController.listPublic({ category, search }));
};

export const POST = async (req: NextRequest) => {
  // Body shape se valida en EventsController.create (Zod). Acepta:
  //   title, description?, venue?, venueLayoutUrl?, startsAt, endsAt?, timezone?,
  //   totalCapacity?, overbookPct?, transfers*, ticketTypes[]
  const body = await req.json().catch(() => ({}));
  const result = await EventsController.create(body);
  if (result.ok) {
    serverEvents.eventCreated(await getAuthDistinctId(), {
      event_id: result.value.id,
      category: result.value.category,
    });
  }
  return json(result, 201);
};
