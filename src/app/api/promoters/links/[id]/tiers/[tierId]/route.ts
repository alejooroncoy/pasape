import type { NextRequest } from "next/server";
import { CommissionTiersController } from "@/server/promoters/tiers/controllers/rest/CommissionTiersController";
import { json } from "@/server/_shared/http";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> },
) => {
  const { id, tierId } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await CommissionTiersController.update(id, tierId, body));
};

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> },
) => {
  const { id, tierId } = await params;
  return json(await CommissionTiersController.remove(id, tierId));
};
