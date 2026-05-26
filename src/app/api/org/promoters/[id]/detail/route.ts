import type { NextRequest } from "next/server";
import { OrgPromotersController } from "@/server/promoters/controllers/rest/OrgPromotersController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await OrgPromotersController.detail(id));
};
