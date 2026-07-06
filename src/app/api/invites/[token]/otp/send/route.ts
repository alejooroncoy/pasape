import type { NextRequest } from "next/server";
import { InvitesController } from "@/server/identity/organizations/controllers/rest/InvitesController";
import { json } from "@/server/_shared/http";

export const POST = async (
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params;
  return json(await InvitesController.sendOtp(token));
};
