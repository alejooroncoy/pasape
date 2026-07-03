import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// El código de puerta es de 6 chars sobre ~30 símbolos, único global y permanente.
// Sin límite, este endpoint (que confirma si un código existe + el evento) sería
// un oráculo de fuerza bruta. 15/min por IP: un portero real teclea un código,
// no cientos.
const limiter = createRateLimiter(15);

export const GET = async (req: NextRequest) => {
  if (!limiter.check(req)) return limiter.response();
  const code = req.nextUrl.searchParams.get("code") ?? "";
  return json(await ScanningController.resolveCode(code));
};
