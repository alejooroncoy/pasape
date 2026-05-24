import type { NextRequest } from "next/server";
import { OrganizationsController } from "@/server/identity/organizations/controllers/rest/OrganizationsController";
import { json } from "@/server/_shared/http";

export const GET = async () => json(await OrganizationsController.list());

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await OrganizationsController.create(body), 201);
};
