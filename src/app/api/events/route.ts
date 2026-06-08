import type { NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { json } from "@/server/_shared/http";
import type { EventCategory } from "@/server/events/domain/Event";

const VALID_CATEGORIES = new Set<string>(["musica","dj_sets","after_office","comedia","cultura","deportes"]);

export const GET = async (req: NextRequest) => {
  const scope = req.nextUrl.searchParams.get("scope");
  if (scope === "mine") return json(await EventsController.listMine());
  const cat = req.nextUrl.searchParams.get("category");
  const category = cat && VALID_CATEGORIES.has(cat) ? (cat as EventCategory) : null;
  return json(await EventsController.listPublic({ category }));
};

export const POST = async (req: NextRequest) => {
  // Body shape se valida en EventsController.create (Zod). Acepta:
  //   title, description?, venue?, venueLayoutUrl?, startsAt, endsAt?, timezone?,
  //   totalCapacity?, overbookPct?, transfers*, ticketTypes[]
  const body = await req.json().catch(() => ({}));
  return json(await EventsController.create(body), 201);
};
