import type { NextRequest } from "next/server";
import { EventPromotersController } from "@/server/promoters/controllers/rest/EventPromotersController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  return json(await EventPromotersController.getScheme(slug));
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await EventPromotersController.updateScheme(slug, body));
};
