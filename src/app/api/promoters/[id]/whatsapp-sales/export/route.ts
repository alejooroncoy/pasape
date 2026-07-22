import { NextResponse, type NextRequest } from "next/server";
import { OrgPromotersController } from "@/server/promoters/controllers/rest/OrgPromotersController";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const result = await OrgPromotersController.exportWhatsAppSales(id);
  if (!result.ok) {
    const status =
      result.error === "unauthenticated" || result.error === "invalid_session"
        ? 401
        : result.error === "forbidden"
          ? 403
          : result.error === "not_found"
            ? 404
            : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  const { buffer, filename } = result.value;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
