import type { NextRequest } from "next/server";
import { OrgPromotersController } from "@/server/promoters/controllers/rest/OrgPromotersController";
import { json } from "@/server/_shared/http";

export const GET = async () => {
  return json(await OrgPromotersController.list());
};

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await OrgPromotersController.create(body), 201);
};
