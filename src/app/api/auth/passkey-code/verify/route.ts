import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import {
  verifyEmailUnlock,
  type VerifyEmailUnlockInput,
} from "@/server/identity/webauthn/application/VerifyEmailUnlock";

type Body =
  | { source: "order"; orderId?: string; token?: string; code?: string }
  | { source: "generic"; email?: string; code?: string };

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.source) return json({ ok: false, error: "invalid_input" } as const);

  const input: VerifyEmailUnlockInput =
    body.source === "order"
      ? { source: "order", orderId: body.orderId ?? "", token: body.token ?? "", code: body.code ?? "" }
      : { source: "generic", email: body.email ?? "", code: body.code ?? "" };

  return json(await verifyEmailUnlock(input));
};
