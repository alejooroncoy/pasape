import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { json } from "@/server/_shared/http";

// El portero cambia su puerta activa. body: { eventSlug, zoneId (null=principal), deviceId? }
export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  return json(
    await ScanningController.setZone(
      body.eventSlug ?? "",
      body.zoneId ?? null,
      body.deviceId ?? undefined,
    ),
  );
};
