import type { NextRequest } from "next/server";
import { EventPromotersController } from "@/server/promoters/controllers/rest/EventPromotersController";
import { json } from "@/server/_shared/http";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; linkId: string }> },
) => {
  const { slug, linkId } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await EventPromotersController.updateCommission(slug, linkId, body));
};

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; linkId: string }> },
) => {
  const { slug, linkId } = await params;
  return json(await EventPromotersController.remove(slug, linkId));
};
