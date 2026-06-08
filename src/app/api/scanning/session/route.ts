import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { json } from "@/server/_shared/http";

export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("event") ?? "";
  const deviceId = url.searchParams.get("device") ?? undefined;
  return json(await ScanningController.sessionStatus(slug, deviceId));
};
