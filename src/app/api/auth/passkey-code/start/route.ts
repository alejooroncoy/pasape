import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { startEmailUnlock, type EmailUnlockSource } from "@/server/identity/webauthn/application/StartEmailUnlock";

type Body =
  | { source: "order"; orderId?: string; token?: string }
  | { source: "generic"; email?: string };

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.source) return json({ ok: false, error: "invalid_input" } as const);

  const input: EmailUnlockSource =
    body.source === "order"
      ? { source: "order", orderId: body.orderId ?? "", token: body.token ?? "" }
      : { source: "generic", email: body.email ?? "" };

  return json(await startEmailUnlock(input));
};
