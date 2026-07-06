import type { NextRequest } from "next/server";
import { z } from "zod";
import { InvitesController } from "@/server/identity/organizations/controllers/rest/InvitesController";
import { json, fail } from "@/server/_shared/http";

const bodySchema = z.object({ code: z.string().min(4).max(10) });

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("invalid_code");
  return json(await InvitesController.verifyOtp(token, parsed.data.code));
};
