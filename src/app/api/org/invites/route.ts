import type { NextRequest } from "next/server";
import { InvitesController } from "@/server/identity/organizations/controllers/rest/InvitesController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await InvitesController.list());

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await InvitesController.create(body), 201);
};
