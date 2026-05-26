import type { NextRequest } from "next/server";
import { OrgPromotersController } from "@/server/promoters/controllers/rest/OrgPromotersController";
import { json } from "@/server/_shared/http";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await OrgPromotersController.update(id, body));
};

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await OrgPromotersController.remove(id));
};
