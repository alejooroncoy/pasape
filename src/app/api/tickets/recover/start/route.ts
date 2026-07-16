import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { startTicketRecovery } from "@/server/tickets/application/RecoverTickets";

// Endpoint público que dispara un envío de correo (Resend) por request. El cap
// interno de RecoverTickets es por EMAIL, así que un atacante con miles de
// correos distintos lo evade y bombardea Resend + víctimas arbitrarias. Este
// rate limit POR IP (Upstash, distribuido) es la primera línea; conviene sumarle
// un techo global de envíos y CAPTCHA a futuro.
const rateLimiter = createRateLimiter("tickets:recover-start", 5, 60_000);

export const POST = async (req: NextRequest) => {
  if (!(await rateLimiter.check(req))) return rateLimiter.response();

  const body = (await req.json().catch(() => null)) as { identifier?: string } | null;
  return json(await startTicketRecovery({ identifier: body?.identifier ?? "" }));
};
