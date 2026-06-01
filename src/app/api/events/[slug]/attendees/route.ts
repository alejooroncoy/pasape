import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { err } from "@/server/_shared/result";
import { createSupabaseServerClient } from "@/server/_shared/supabase/server";

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const auth = await getAuthContext();
  if (!auth.ok) return json(err("unauthorized"));
  // q vacío = cargar todos (hasta 60) para la lista web
  const isEmpty = q.length === 0;

  const db = await createSupabaseServerClient();

  // Verificar que el usuario tiene acceso de scan a este evento
  const { data: ev } = await db
    .from("events")
    .select("id, organization_id")
    .eq("slug", slug)
    .maybeSingle<{ id: string; organization_id: string }>();
  if (!ev) return json(err("event_not_found"));

  // Buscar tickets por nombre del holder o DNI (últimos dígitos)
  const isNumeric = /^\d+$/.test(q);

  let query = db
    .from("tickets")
    .select(
      "id, qr_code, status, holder_name, holder_dni_last2, used_at, ticket_type:ticket_types!inner(id, name, event_id)",
    )
    .eq("ticket_type.event_id", ev.id)
    .neq("status", "void")
    .order("used_at", { ascending: false, nullsFirst: false })
    .limit(isEmpty ? 60 : 20);

  if (!isEmpty) {
    if (isNumeric) {
      query = query.ilike("holder_dni_last2", `%${q.slice(-2)}%`);
    } else {
      query = query.ilike("holder_name", `%${q}%`);
    }
  }

  const { data: tickets } = await query;

  const results = (tickets ?? []).map((t) => ({
    ticketId:    t.id,
    qrCode:      t.qr_code,
    status:      t.status as "active" | "used" | "void",
    holderName:  t.holder_name,
    dniLast2:    t.holder_dni_last2,
    usedAt:      t.used_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ticketType:  (t.ticket_type as any)?.name ?? "",
  }));

  return json({ ok: true, value: results });
};
