import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyScanAccess } from "@/server/scanning/application/VerifyScanAccess";

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  // Verificar que el usuario tiene acceso de escáner a este evento.
  const access = await verifyScanAccess(slug);
  if (!access.ok) return json(err(access.error));

  const isEmpty = q.length === 0;
  // Detectar si la búsqueda es numérica (DNI) o por nombre
  const isNumeric = /^\d+$/.test(q);
  // Para DNI usamos los últimos 4 dígitos — coincide con lo que mostramos en
  // puerta (··2442). 4 dígitos no identifican a nadie pero discriminan bien.
  const dniQuery = isNumeric ? q.slice(-4) : null;

  const db = supabaseAdmin();

  let query = db
    .from("tickets")
    .select(
      "id, qr_code, status, holder_name, holder_dni_last4, used_at, ticket_type:ticket_types!inner(id, name, event_id)",
    )
    .eq("ticket_type.event_id", access.value.eventId)
    .neq("status", "void")
    .order("used_at", { ascending: false, nullsFirst: false })
    .limit(isEmpty ? 60 : 20);

  if (!isEmpty) {
    if (dniQuery) {
      // Búsqueda exacta por últimos 4 dígitos del DNI.
      query = query.eq("holder_dni_last4", dniQuery);
    } else {
      // Búsqueda por nombre con prefijo → usa índice GIN trigrama tickets_holder_name_trgm
      // ilike con prefijo (q%) es más selectivo que %q% y permite usar el índice
      query = query.ilike("holder_name", `${q}%`);
    }
  }

  const { data: tickets } = await query;

  const results = (tickets ?? []).map((t) => ({
    ticketId:   t.id,
    qrCode:     t.qr_code,
    status:     t.status as "active" | "used" | "void",
    holderName: t.holder_name,
    dniLast4:   t.holder_dni_last4,
    usedAt:     t.used_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ticketType: (t.ticket_type as any)?.name ?? "",
  }));

  return json({ ok: true, value: results });
};
