import type { NextRequest } from "next/server";
import { BoxesController } from "@/server/boxes/controllers/rest/BoxesController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// Token corto en el link de invite — sin límite es enumeración / spam de joins.
const limiter = createRateLimiter("boxes:join", 15);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  return json(await BoxesController.join(body));
};
