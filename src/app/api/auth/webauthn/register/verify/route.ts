import type { NextRequest } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { json } from "@/server/_shared/http";
import { verifyPasskeyRegistration } from "@/server/identity/webauthn/application/VerifyRegistration";

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!body) return json({ ok: false, error: "invalid_input" } as const);
  return json(await verifyPasskeyRegistration(body));
};
