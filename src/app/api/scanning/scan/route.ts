import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { SCANNER_DEVICE_HEADER } from "@/server/scanning/application/VerifyScanAccess";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const deviceId = req.headers.get(SCANNER_DEVICE_HEADER) ?? undefined;
  return json(
    await ScanningController.scan(body, {
      offlineScannedAt: body.offlineScannedAt,
      deviceId,
    }),
  );
};
