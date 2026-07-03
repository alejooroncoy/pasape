import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// Canje de código → sesión de portero. Mismo motivo que resolve-code: sin límite
// es fuerza bruta contra el código de puerta que además crea una sesión.
const limiter = createRateLimiter("scanning:join", 15);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  return json(await ScanningController.join(body));
};
