import type { NextRequest } from "next/server";
import { InvitesController } from "@/server/identity/organizations/controllers/rest/InvitesController";
import { json } from "@/server/_shared/http";

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return json(await InvitesController.revoke(id));
};
