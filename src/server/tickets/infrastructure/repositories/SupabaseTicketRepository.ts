import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  BuyInput,
  BuyOutput,
  TicketRepository,
} from "@/server/tickets/ports/TicketRepository";
import type { Order, Ticket, WalletTicket } from "@/server/tickets/domain/Ticket";
import { createPreference } from "@/server/payments/application/CreatePreference";
import crypto from "node:crypto";

const generateQr = () =>
  crypto.randomBytes(24).toString("base64url");

type OrderRow = {
  id: string;
  buyer_id: string | null;
  event_id: string;
  promoter_link_id: string | null;
  status: Order["status"];
  total_cents: number;
  currency: string;
  created_at: string;
};

type TicketRow = {
  id: string;
  order_id: string;
  ticket_type_id: string;
  holder_name: string | null;
  holder_dni_last2: string | null;
  qr_code: string;
  status: Ticket["status"];
  used_at: string | null;
  current_holder: string;
  transfer_count: number;
  created_at: string;
  box_label: string | null;
  box_host_ticket_id: string | null;
};

const toOrder = (r: OrderRow): Order => ({
  id: r.id,
  buyerId: r.buyer_id,
  eventId: r.event_id,
  promoterLinkId: r.promoter_link_id,
  status: r.status,
  totalCents: r.total_cents,
  currency: r.currency,
  createdAt: r.created_at,
});

const toTicket = (r: TicketRow): Ticket => ({
  id: r.id,
  orderId: r.order_id,
  ticketTypeId: r.ticket_type_id,
  holderName: r.holder_name,
  holderDniLast2: r.holder_dni_last2,
  qrCode: r.qr_code,
  status: r.status,
  usedAt: r.used_at,
  currentHolder: r.current_holder,
  transferCount: r.transfer_count,
  createdAt: r.created_at,
  boxLabel: r.box_label,
  boxHostTicketId: r.box_host_ticket_id,
});

export const supabaseTicketRepository: TicketRepository = {
  async buy(input: BuyInput): Promise<Result<BuyOutput>> {
    const db = supabaseAdmin();

    if (!input.buyerId && !input.guest) return err("buyer_required");

    // Why: bloquear compras a eventos no publicados (draft/closed/cancelled).
    // Sin esto, cualquiera con el slug podría comprar a un evento que el
    // organizador aún no lanzó. Cerrado/cancelado también bloqueado.
    const { data: evStatus } = await db
      .from("events")
      .select("status, ends_at")
      .eq("id", input.eventId)
      .maybeSingle<{ status: string; ends_at: string | null }>();
    if (!evStatus) return err("event_not_found");
    if (evStatus.status !== "published") return err("event_not_published");
    if (evStatus.ends_at && new Date(evStatus.ends_at) < new Date()) return err("event_sales_closed");

    const ttIds = input.items.map((i) => i.ticketTypeId);
    const { data: tts, error: ttErr } = await db
      .from("ticket_types")
      .select("id, price_cents, capacity, sold, currency, event_id, kind, box_label")
      .in("id", ttIds);
    if (ttErr || !tts) return err(ttErr?.message ?? "ticket_types_lookup_failed");
    if (tts.some((t) => t.event_id !== input.eventId)) return err("event_mismatch");

    let total = 0;
    for (const item of input.items) {
      const tt = tts.find((t) => t.id === item.ticketTypeId);
      if (!tt) return err("ticket_type_missing");
      if (tt.sold + item.qty > tt.capacity) return err("sold_out");
      total += tt.price_cents * item.qty;
    }

    let promoterLinkId: string | null = null;
    let promoterId: string | null = null;
    if (input.promoCode) {
      const { data: link } = await db
        .from("promoter_links")
        .select("id, promoter_id")
        .eq("code", input.promoCode)
        .eq("event_id", input.eventId)
        .eq("active", true)
        .maybeSingle<{ id: string; promoter_id: string }>();
      promoterLinkId = link?.id ?? null;
      promoterId = link?.promoter_id ?? null;
    }

    // Why: si el comprador es guest, resolvemos (o creamos) un profile usando
    // email o phone como ancla (email tiene prioridad). Reusamos el profile
    // existente si ya hubo compras previas con ese identificador.
    let effectiveBuyerId: string | null = input.buyerId ?? null;
    if (!effectiveBuyerId && input.guest) {
      const emailNorm = input.guest.email?.trim().toLowerCase() ?? null;
      const phoneNorm = input.guest.phone?.replace(/\D/g, "") || null;
      if (!emailNorm && !phoneNorm) return err("guest_contact_required");

      let existingId: string | null = null;
      if (emailNorm) {
        const { data } = await db
          .from("profiles")
          .select("id")
          .ilike("email", emailNorm)
          .maybeSingle<{ id: string }>();
        existingId = data?.id ?? null;
      }
      if (!existingId && phoneNorm) {
        const { data } = await db
          .from("profiles")
          .select("id")
          .eq("phone", phoneNorm)
          .maybeSingle<{ id: string }>();
        existingId = data?.id ?? null;
      }

      if (existingId) {
        effectiveBuyerId = existingId;
      } else {
        // Why: profiles.id es FK a auth.users(id), no podemos insertar profile
        // directo. Creamos un auth user (el trigger handle_new_user inserta
        // la row de profile auto). Si el guest solo dio phone, sintetizamos
        // un email para satisfacer el requirement de createUser de Supabase.
        const synthEmail = emailNorm ?? `guest+${phoneNorm}@pasape.app`;
        const { data: authUser, error: authErr } = await db.auth.admin.createUser({
          email: synthEmail,
          phone: phoneNorm ?? undefined,
          email_confirm: true,
          phone_confirm: !!phoneNorm,
          user_metadata: { full_name: input.guest.fullName },
        });
        if (authErr || !authUser?.user) {
          return err(authErr?.message ?? "guest_profile_create_failed");
        }
        // El trigger creó (id, email, full_name) pero no copia phone — lo
        // actualizamos acá. DNI vive en orders.guest_dni (no en profiles).
        await db
          .from("profiles")
          .update({
            phone: phoneNorm,
            initial_role: "buyer",
          })
          .eq("id", authUser.user.id);
        effectiveBuyerId = authUser.user.id;
      }
    }
    if (!effectiveBuyerId) return err("buyer_required");

    // Why: el promotor no puede inflar su propio ranking comprando con su
    // propio código (sea como user logueado o como guest con su email).
    if (promoterId && promoterId === effectiveBuyerId) {
      return err("self_purchase_blocked");
    }

    const { data: orderRow, error: orderErr } = await db
      .from("orders")
      .insert({
        buyer_id: effectiveBuyerId,
        event_id: input.eventId,
        promoter_link_id: promoterLinkId,
        // F10: la order arranca pending; el webhook MP la marca paid/failed.
        // Tradeoff: los tickets se insertan con status='active' porque el
        // check constraint del schema actual no permite 'pending_payment'.
        // Reservamos capacity con `sold` tentativo; si el webhook reporta
        // failed/cancelled, se hace rollback (tickets -> void, sold -=).
        status: "pending",
        total_cents: total,
        currency: tts[0]?.currency ?? "PEN",
        guest_email: input.guest?.email ?? null,
        guest_phone: input.guest?.phone ?? null,
        guest_name: input.guest?.fullName ?? null,
        guest_dni: input.guest?.dni ?? null,
      })
      .select("*")
      .single<OrderRow>();
    if (orderErr || !orderRow) return err(orderErr?.message ?? "order_create_failed");

    const ticketsToInsert = input.items.flatMap((item) => {
      const tt = tts.find((t) => t.id === item.ticketTypeId);
      // Why: para boxes solo generamos 1 ticket (el "host") sin importar qty.
      // Los amigos del box crean su ticket al aceptar el invite link y heredan
      // box_label + box_host_ticket_id apuntando a este ticket host.
      const isBox = !!tt?.box_label;
      const slots = isBox ? 1 : item.qty;
      return Array.from({ length: slots }).map(() => ({
        order_id: orderRow.id,
        ticket_type_id: item.ticketTypeId,
        holder_name: item.holderName ?? input.guest?.fullName ?? null,
        holder_email: input.guest?.email ?? null,
        holder_phone: input.guest?.phone ?? null,
        qr_code: generateQr(),
        current_holder: effectiveBuyerId,
        box_label: tt?.box_label ?? null,
        box_host_ticket_id: null,
      }));
    });

    const { data: tkRows, error: tkErr } = await db
      .from("tickets")
      .insert(ticketsToInsert)
      .select("*");
    if (tkErr || !tkRows) return err(tkErr?.message ?? "tickets_create_failed");

    for (const item of input.items) {
      const tt = tts.find((t) => t.id === item.ticketTypeId);
      if (!tt) continue;
      await db
        .from("ticket_types")
        .update({ sold: tt.sold + item.qty })
        .eq("id", item.ticketTypeId);
    }

    // Why: la recalc de hitos vive en HandleWebhook ahora — al momento de
    // crear la order, su status es 'pending', así que sumarla acá no aporta.

    // Lookup event slug/title for the MP preference back URLs.
    const { data: ev } = await db
      .from("events")
      .select("slug, title")
      .eq("id", input.eventId)
      .single<{ slug: string; title: string }>();
    const { data: ttsForPref } = await db
      .from("ticket_types")
      .select("id, name")
      .in("id", ttIds);
    const nameById = new Map<string, string>(
      (ttsForPref ?? []).map((t) => [t.id, t.name]),
    );

    const prefResult = await createPreference({
      orderId: orderRow.id,
      eventSlug: ev?.slug ?? "",
      eventTitle: ev?.title ?? "",
      payerEmail: input.payerEmail ?? input.guest?.email ?? null,
      items: input.items.map((it) => {
        const tt = tts.find((t) => t.id === it.ticketTypeId);
        return {
          id: it.ticketTypeId,
          title: nameById.get(it.ticketTypeId) ?? "Entrada",
          quantity: it.qty,
          unitPriceCents: tt?.price_cents ?? 0,
          currency: tt?.currency ?? "PEN",
        };
      }),
    });

    if (!prefResult.ok) {
      // Si no se pudo crear preferencia, marcamos la order failed para no
      // dejar capacity reservada indefinidamente.
      await db.from("orders").update({ status: "failed" }).eq("id", orderRow.id);
      await db.from("tickets").update({ status: "void" }).eq("order_id", orderRow.id);
      for (const item of input.items) {
        const tt = tts.find((t) => t.id === item.ticketTypeId);
        if (!tt) continue;
        await db
          .from("ticket_types")
          .update({ sold: Math.max(0, tt.sold) })
          .eq("id", item.ticketTypeId);
      }
      return err(prefResult.error);
    }

    return ok({
      order: toOrder(orderRow),
      tickets: (tkRows as TicketRow[]).map(toTicket),
      preference: { id: prefResult.value.preferenceId, initPoint: prefResult.value.initPoint },
    });
  },

  async listMine(buyerId: string): Promise<WalletTicket[]> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("tickets")
      .select(
        "*, ticket_type:ticket_types!inner(id,name,kind,event_id,event:events!inner(id,slug,title,starts_at,venue,timezone))",
      )
      .eq("current_holder", buyerId)
      .order("created_at", { ascending: false });
    if (!data) return [];
    type Joined = TicketRow & {
      ticket_type: {
        id: string;
        name: string;
        kind: string;
        event_id: string;
        event: {
          id: string;
          slug: string;
          title: string;
          starts_at: string;
          venue: string | null;
          timezone: string;
        };
      };
    };
    return (data as unknown as Joined[]).map((row) => ({
      ...toTicket(row),
      event: {
        id: row.ticket_type.event.id,
        slug: row.ticket_type.event.slug,
        title: row.ticket_type.event.title,
        startsAt: row.ticket_type.event.starts_at,
        venue: row.ticket_type.event.venue,
        timezone: row.ticket_type.event.timezone,
      },
      ticketType: {
        id: row.ticket_type.id,
        name: row.ticket_type.name,
        kind: row.ticket_type.kind,
      },
    }));
  },

  async getById(ticketId, buyerId) {
    const all = await supabaseTicketRepository.listMine(buyerId);
    return all.find((t) => t.id === ticketId) ?? null;
  },

  async transfer(input): Promise<Result<Ticket>> {
    if (!input.toProfile) return err("recipient_required");
    const db = supabaseAdmin();
    const { data: existing, error: getErr } = await db
      .from("tickets")
      .select(
        "*, ticket_type:ticket_types!inner(event:events!inner(starts_at, transfers_enabled, transfer_deadline_hours, transfer_max_count))",
      )
      .eq("id", input.ticketId)
      .single();
    if (getErr || !existing) return err("ticket_not_found");

    type Joined = TicketRow & {
      ticket_type: {
        event: {
          starts_at: string;
          transfers_enabled: boolean;
          transfer_deadline_hours: number | null;
          transfer_max_count: number;
        };
      };
    };
    const joined = existing as unknown as Joined;

    if (joined.current_holder !== input.fromProfile) return err("not_owner");
    if (joined.status !== "active") return err("ticket_not_active");

    const ev = joined.ticket_type.event;
    // Why: el organizador puede deshabilitar transferencias por evento.
    if (!ev.transfers_enabled) return err("transfers_disabled");

    // Why: cooldown anti-fraude. Cerca del evento, las transferencias son
    // vector de reventa/laundering. El organizador define la ventana.
    if (ev.transfer_deadline_hours != null) {
      const hoursUntilStart = (new Date(ev.starts_at).getTime() - Date.now()) / 3_600_000;
      if (hoursUntilStart < ev.transfer_deadline_hours) {
        return err("transfer_window_closed");
      }
    }

    if (joined.transfer_count >= ev.transfer_max_count) {
      return err("transfer_limit_reached");
    }

    const { data: updated, error: upErr } = await db
      .from("tickets")
      .update({ current_holder: input.toProfile, transfer_count: joined.transfer_count + 1 })
      .eq("id", input.ticketId)
      .select("*")
      .single<TicketRow>();
    if (upErr || !updated) return err(upErr?.message ?? "transfer_failed");

    await db.from("ticket_transfers").insert({
      ticket_id: input.ticketId,
      from_profile: input.fromProfile,
      to_profile: input.toProfile,
      to_contact: input.toContact,
      status: "completed",
    });
    return ok(toTicket(updated));
  },

  async markUsedByQr(qrCode, scannerId) {
    const db = supabaseAdmin();

    // Si el código viene en formato rotante (ticketId.window.code), lo
    // resolvemos al qr_code estático del ticket validando HMAC + ventana
    // temporal + anti-replay del window. Si es legacy (token plano), va
    // directo al lookup por qr_code.
    const resolved = await resolveScanInput(qrCode);
    if (!resolved.ok) {
      // No registramos scan_event acá porque no tenemos ticket_id ni event_id.
      return err(resolved.error);
    }
    const effectiveQrCode = resolved.value.qrCode;

    const { data: updatedRow, error: upErr } = await db
      .from("tickets")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("qr_code", effectiveQrCode)
      .eq("status", "active")
      .select("*, ticket_type:ticket_types!inner(event_id, name)")
      .maybeSingle();

    if (upErr) return err(upErr.message);

    if (updatedRow) {
      type Joined = TicketRow & { ticket_type: { event_id: string; name: string } };
      const joined = updatedRow as unknown as Joined;
      await db.from("scan_events").insert({
        ticket_id: joined.id,
        event_id: joined.ticket_type.event_id,
        scanned_by: scannerId,
        result: "valid",
        raw_token: qrCode,
      });

      // Why: el portero debe ver inmediatamente "BOX A · invitado por José ·
      // 3/8 dentro" para validar contra capacity del box. Buscamos host name
      // y conteo de validados sólo si el ticket pertenece a un box.
      let boxHostName: string | null = null;
      let boxFilled: number | null = null;
      let boxCapacity: number | null = null;
      if (joined.box_label) {
        const hostTicketId = joined.box_host_ticket_id ?? joined.id;
        const { data: host } = await db
          .from("tickets")
          .select("holder_name, current_holder, profile:profiles!tickets_current_holder_fkey(full_name)")
          .eq("id", hostTicketId)
          .maybeSingle();
        type HostRow = {
          holder_name: string | null;
          current_holder: string;
          profile: { full_name: string | null } | null;
        };
        const h = host as unknown as HostRow | null;
        boxHostName = h?.holder_name ?? h?.profile?.full_name ?? null;

        const { data: peers } = await db
          .from("tickets")
          .select("id, status")
          .or(`id.eq.${hostTicketId},box_host_ticket_id.eq.${hostTicketId}`);
        type PeerRow = { id: string; status: Ticket["status"] };
        const ps = (peers as PeerRow[] | null) ?? [];
        boxFilled = ps.filter((p) => p.status === "used").length;
        // capacity del box = capacity del ticket_type
        const { data: type } = await db
          .from("ticket_types")
          .select("capacity")
          .eq("id", joined.ticket_type_id)
          .maybeSingle<{ capacity: number }>();
        boxCapacity = type?.capacity ?? null;
      }

      return ok({
        ticket: toTicket(joined),
        eventId: joined.ticket_type.event_id,
        holderName: joined.holder_name,
        holderDniLast2: joined.holder_dni_last2,
        ticketTypeName: joined.ticket_type.name,
        boxLabel: joined.box_label,
        boxHostName,
        boxFilled,
        boxCapacity,
      });
    }

    const { data: existing } = await db
      .from("tickets")
      .select("id, status, ticket_type:ticket_types!inner(event_id)")
      .eq("qr_code", effectiveQrCode)
      .maybeSingle();

    if (!existing) return err("invalid");

    type ExistingRow = { id: string; status: Ticket["status"]; ticket_type: { event_id: string } };
    const ex = existing as unknown as ExistingRow;
    const result = ex.status === "used" ? "already_used" : "invalid";
    await db.from("scan_events").insert({
      ticket_id: ex.id,
      event_id: ex.ticket_type.event_id,
      scanned_by: scannerId,
      result,
      raw_token: qrCode,
    });
    return err(result);
  },
};

// Resuelve un input de escaneo a un qr_code estático.
// Soporta tres formas:
//   1) `ticketId.window.code` → valida HMAC + window + anti-replay
//   2) JWT (qr_code legacy estilo TOTP firmado por evento) — pass-through
//   3) base64url plano (qr_code estático actual)              — pass-through
async function resolveScanInput(
  raw: string,
): Promise<Result<{ qrCode: string }>> {
  // Heurística: si tiene exactamente 2 puntos y la primera parte parece uuid,
  // lo tratamos como rotante.
  const parts = raw.split(".");
  if (parts.length === 3 && /^[0-9a-f-]{36}$/i.test(parts[0]!)) {
    const { parseRotatingPayload, verifyRotatingCode } = await import(
      "@/server/tickets/domain/RotatingQr"
    );
    const parsed = parseRotatingPayload(raw);
    if (!parsed) return err("invalid_payload");
    const db = supabaseAdmin();
    const { data: row } = await db
      .from("tickets")
      .select("id, qr_code, rotation_secret, last_used_window, status")
      .eq("id", parsed.ticketId)
      .maybeSingle<{
        id: string;
        qr_code: string;
        rotation_secret: string;
        last_used_window: number | null;
        status: string;
      }>();
    if (!row) return err("invalid");
    // Anti-replay: si ya se aceptó este mismo window, rechazar.
    if (row.last_used_window != null && row.last_used_window === parsed.windowIdx) {
      return err("code_replay");
    }
    const hex = row.rotation_secret.startsWith("\\x")
      ? row.rotation_secret.slice(2)
      : row.rotation_secret;
    const secret = Buffer.from(hex, "hex");
    const verification = verifyRotatingCode(
      secret,
      parsed.ticketId,
      parsed.windowIdx,
      parsed.code,
    );
    if (!verification.valid) return err("invalid_code");
    // Marcar window aceptado para anti-replay (best-effort, no bloqueante).
    await db
      .from("tickets")
      .update({ last_used_window: verification.window })
      .eq("id", row.id);
    return ok({ qrCode: row.qr_code });
  }
  // Legacy: token plano.
  return ok({ qrCode: raw });
}
