import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { resolveVenueLink } from "@/server/_shared/venue/resolveVenueLink";

const schema = z.object({ url: z.string().min(1).max(1024) });

export const POST = async (req: NextRequest) => {
  const auth = await getAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const result = await resolveVenueLink(parsed.data.url);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });
  }
  return NextResponse.json({ ok: true, value: result.data });
};
