import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { SCANNER_DEVICE_HEADER } from "@/server/scanning/application/VerifyScanAccess";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// 60 req/min por IP: tráfico interno de porteros admitiendo en puerta, más
// permisivo que endpoints públicos de compra.
const limiter = createRateLimiter("scanning:admit", 60);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  const deviceId = req.headers.get(SCANNER_DEVICE_HEADER) ?? undefined;
  return json(
    await ScanningController.admit(body, {
      offlineScannedAt: body.offlineScannedAt,
      deviceId,
    }),
  );
};
