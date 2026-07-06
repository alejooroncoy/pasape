import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyScanAccess } from "@/server/scanning/application/VerifyScanAccess";

const MIN_QUERY_LEN = 2;
const MAX_RESULTS = 20;

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LEN) {
    return json(err("query_too_short"));
  }

  const access = await verifyScanAccess(slug);
  if (!access.ok) return json(err(access.error));

  const isNumeric = /^\d+$/.test(q);
  const dniQuery = isNumeric ? q.slice(-4) : null;

  const db = supabaseAdmin();

  let query = db
    .from("tickets")
    .select(
      "id, status, holder_name, holder_dni_last4, used_at, ticket_type:ticket_types!inner(name, event_id)",
    )
    .eq("ticket_type.event_id", access.value.eventId)
    .neq("status", "void")
    .order("used_at", { ascending: false, nullsFirst: false })
    .limit(MAX_RESULTS);

  if (dniQuery) {
    query = query.eq("holder_dni_last4", dniQuery);
  } else {
    query = query.ilike("holder_name", `${q}%`);
  }

  const { data: tickets } = await query;

  const results = (tickets ?? []).map((t) => ({
    ticketId: t.id,
    status: t.status as "active" | "used" | "void",
    holderName: t.holder_name,
    dniLast4: t.holder_dni_last4,
    usedAt: t.used_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ticketType: (t.ticket_type as any)?.name ?? "",
  }));

  return json({ ok: true, value: results });
};
