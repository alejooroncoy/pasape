import type { NextRequest } from "next/server";
import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await IdentityController.completeOnboarding(body));
};
