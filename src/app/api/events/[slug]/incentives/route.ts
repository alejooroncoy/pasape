import type { NextRequest } from "next/server";
import { IncentivesController } from "@/server/promoters/incentives/controllers/rest/IncentivesController";
import { json } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  return json(await IncentivesController.list(slug));
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await IncentivesController.create(slug, body), 201);
};
