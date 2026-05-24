import type { NextRequest } from "next/server";
import { CommissionTiersController } from "@/server/promoters/tiers/controllers/rest/CommissionTiersController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await CommissionTiersController.list(id));
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await CommissionTiersController.create(id, body), 201);
};
