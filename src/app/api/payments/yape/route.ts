import { z } from "zod";
import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { payWithYape } from "@/server/payments/application/PayWithYape";

const schema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(8).max(200),
  phoneNumber: z.string().regex(/^\d{9}$/),
});

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(err(parsed.error.issues[0]?.message ?? "invalid_input"));
  }
  const res = await payWithYape(parsed.data);
  return json(res);
};
