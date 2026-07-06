import { NextResponse, type NextRequest } from "next/server";
import { EventsController } from "@/server/events/controllers/rest/EventsController";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const result = await EventsController.exportXlsx(slug);
  if (result.ok) {
    serverEvents.exportDownloaded(await getAuthDistinctId(), { event_slug: slug });
  }
  if (!result.ok) {
    const status = result.error === "unauthenticated" || result.error === "invalid_session"
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
