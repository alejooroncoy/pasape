import type { NextRequest } from "next/server";
import { LegalEntitiesController } from "@/server/identity/organizations/controllers/rest/LegalEntitiesController";
import { json } from "@/server/_shared/http";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await LegalEntitiesController.update(id, body));
};
