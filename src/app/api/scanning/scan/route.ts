import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { json } from "@/server/_shared/http";

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(await ScanningController.scan(body, { offlineScannedAt: body.offlineScannedAt }));
};
