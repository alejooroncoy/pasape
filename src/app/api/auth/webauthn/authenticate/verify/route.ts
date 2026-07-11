import type { NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { json } from "@/server/_shared/http";
import { verifyPasskeyAuthentication } from "@/server/identity/webauthn/application/VerifyAuthentication";

type Body = { attemptId?: string; response?: AuthenticationResponseJSON };

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.attemptId || !body.response) return json({ ok: false, error: "invalid_input" } as const);
  return json(await verifyPasskeyAuthentication({ attemptId: body.attemptId, response: body.response }));
};
