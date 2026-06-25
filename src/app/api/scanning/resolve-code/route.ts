import type { NextRequest } from "next/server";
import { ScanningController } from "@/server/scanning/controllers/rest/ScanningController";
import { json } from "@/server/_shared/http";

export const GET = async (req: NextRequest) => {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  return json(await ScanningController.resolveCode(code));
};
