import type { NextRequest } from "next/server";
import { InvitesController } from "@/server/identity/organizations/controllers/rest/InvitesController";
import { json } from "@/server/_shared/http";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const GET = async () => json(await InvitesController.list());

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const result = await InvitesController.create(body);
  if (result.ok) {
    serverEvents.teamMemberInvited(await getAuthDistinctId(), { role: body.role });
  }
  return json(result, 201);
};
