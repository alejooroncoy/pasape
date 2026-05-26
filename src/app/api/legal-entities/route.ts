import type { NextRequest } from "next/server";
import { LegalEntitiesController } from "@/server/identity/organizations/controllers/rest/LegalEntitiesController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await LegalEntitiesController.list());

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await LegalEntitiesController.create(body), 201);
};
