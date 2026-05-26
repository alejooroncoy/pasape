import type { NextRequest } from "next/server";
import { EventPromotersController } from "@/server/promoters/controllers/rest/EventPromotersController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; linkId: string }> },
) => {
  const { slug, linkId } = await params;
  return json(await EventPromotersController.sales(slug, linkId));
};
