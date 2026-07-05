import type { NextRequest } from "next/server";
import { OrgPromotersController } from "@/server/promoters/controllers/rest/OrgPromotersController";
import { json } from "@/server/_shared/http";

// Regla base de comisión de la MARCA (para todos los promotores y eventos).
export const GET = async () => {
  return json(await OrgPromotersController.getScheme());
};

export const PATCH = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await OrgPromotersController.updateScheme(body));
};
