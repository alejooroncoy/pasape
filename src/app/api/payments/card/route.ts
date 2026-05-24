import { z } from "zod";
import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { payWithCard } from "@/server/payments/application/PayWithCard";

const schema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(8).max(200),
  paymentMethodId: z.string().min(2).max(40),
  installments: z.number().int().min(1).max(36),
  issuerId: z.string().nullable().optional(),
});

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(err(parsed.error.issues[0]?.message ?? "invalid_input"));
  }
  const res = await payWithCard(parsed.data);
  return json(res);
};
