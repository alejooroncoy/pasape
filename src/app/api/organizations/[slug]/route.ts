import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { OrganizationsController } from "@/server/identity/organizations/controllers/rest/OrganizationsController";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await OrganizationsController.update(slug, body));
};
