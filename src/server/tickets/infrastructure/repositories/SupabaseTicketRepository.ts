import { after } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  BuyInput,
  BuyOutput,
  ScannerRef,
  TicketRepository,
} from "@/server/tickets/ports/TicketRepository";
import type { Order, Ticket, WalletTicket } from "@/server/tickets/domain/Ticket";
import type { EventCategory, EventStatus, Promo } from "@/server/events/domain/Event";
import { activePricing, applyPromos, type PromoLineInput } from "@/lib/events/pricing";
import { resolveOrderFee } from "@/lib/tickets/serviceFee";
import { createPreference } from "@/server/payments/application/CreatePreference";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";
import { supabaseCommissionTierRepository } from "@/server/promoters/tiers/infrastructure/repositories/SupabaseCommissionTierRepository";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";
import { encryptDni, dniLast4, normalizeDni } from "@/server/_shared/crypto/dni";
import crypto from "node:crypto";
import * as Sentry from "@sentry/nextjs";

const generateQr = () =>
  crypto.randomBytes(24).toString("base64url");

type OrderRow = {
  id: string;
  buyer_id: string | null;
  event_id: string;
  promoter_link_id: string | null;
  status: Order["status"];
  total_cents: number;
  service_fee_cents: number;
  currency: string;
  created_at: string;
};

type TicketRow = {
  id: string;
  order_id: string;
  ticket_type_id: string;
  holder_name: string | null;
  holder_dni_last2: string | null;
  holder_dni_last4: string | null;
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
  serviceFeeCents: r.service_fee_cents,
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

type TransferableEvent = {
  starts_at: string;
  title: string;
  transfers_enabled: boolean;
  transfer_deadline_hours: number | null;
  transfer_max_count: number;
};

// Carga el ticket y valida que se pueda transferir AHORA (dueño correcto,
// activo, evento con transferencias habilitadas, dentro de la ventana y bajo el
// límite). Compartido por transfer() y createPendingTransfer().
const loadTransferable = async (
  db: ReturnType<typeof supabaseAdmin>,
  ticketId: string,
  fromProfile: string,
): Promise<Result<{ row: TicketRow; event: TransferableEvent }>> => {
  const { data: existing, error } = await db
    .from("tickets")
    .select(
      "*, ticket_type:ticket_types!inner(event:events!inner(starts_at, title, transfers_enabled, transfer_deadline_hours, transfer_max_count))",
    )
    .eq("id", ticketId)
    .single();
  if (error || !existing) return err("ticket_not_found");
  const joined = existing as unknown as TicketRow & {
    ticket_type: { event: TransferableEvent };
  };
  if (joined.current_holder !== fromProfile) return err("not_owner");
  if (joined.status !== "active") return err("ticket_not_active");
  const ev = joined.ticket_type.event;
  if (!ev.transfers_enabled) return err("transfers_disabled");
  if (ev.transfer_deadline_hours != null) {
    const hoursUntilStart = (new Date(ev.starts_at).getTime() - Date.now()) / 3_600_000;
    if (hoursUntilStart < ev.transfer_deadline_hours) return err("transfer_window_closed");
  }
  if (joined.transfer_count >= ev.transfer_max_count) return err("transfer_limit_reached");
  return ok({ row: joined, event: ev });
};

export const supabaseTicketRepository: TicketRepository = {
  async buy(input: BuyInput): Promise<Result<BuyOutput>> {
    const db = supabaseAdmin();

    if (!input.buyerId && !input.guest) return err("buyer_required");

    // Why: bloquear compras a eventos no publicados (draft/closed/cancelled).
    // Sin esto, cualquiera con el slug podría comprar a un evento que el
    // organizador aún no lanzó. Cerrado/cancelado también bloqueado.
    const { data: evStatus } = await db
      .from("events")
      .select("status, ends_at, fee_mode")
      .eq("id", input.eventId)
      .maybeSingle<{ status: string; ends_at: string | null; fee_mode: "buyer_pays_extra" | "included_in_price" }>();
    if (!evStatus) return err("event_not_found");
    if (evStatus.status !== "published") return err("event_not_published");
    if (evStatus.ends_at && new Date(evStatus.ends_at) < new Date()) return err("event_sales_closed");

    const ttIds = input.items.map((i) => i.ticketTypeId);
    const { data: tts, error: ttErr } = await db
      .from("ticket_types")
      .select(
        "id, price_cents, capacity, sold, currency, event_id, kind, box_label, sale_ends_at, presale_price_cents, presale_qty, presale_ends_at, is_free, free_until_at",
      )
      .in("id", ttIds);
    if (ttErr || !tts) return err(ttErr?.message ?? "ticket_types_lookup_failed");
    if (tts.some((t) => t.event_id !== input.eventId)) return err("event_mismatch");

    // Promos activas del evento (2x1 / 3x2), aplicadas al total server-side.
    const { data: promoRows } = await db
      .from("ticket_promos")
      .select("id, event_id, ticket_type_id, kind, ends_at")
      .eq("event_id", input.eventId);
    const now = new Date();
    const promos: Promo[] = (promoRows ?? []).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      ticketTypeId: r.ticket_type_id,
      kind: r.kind as Promo["kind"],
      endsAt: r.ends_at,
      isActive: r.ends_at == null || new Date(r.ends_at) > now,
    }));

    // Why: el precio NO se confía del cliente. Se resuelve el precio activo
    // (preventa vigente o normal) y luego se aplican las promos.
    const priceItems: PromoLineInput[] = [];
    for (const item of input.items) {
      const tt = tts.find((t) => t.id === item.ticketTypeId);
      if (!tt) return err("ticket_type_missing");
      if (tt.sale_ends_at && new Date(tt.sale_ends_at) < new Date()) return err("ticket_type_sales_closed");
      // Respeta el aforo de la entrada (no sobrevende el espacio). Se libera solo
      // al anular el ticket (el trigger recalcula sold).
      if (tt.sold + item.qty > tt.capacity) return err("sold_out");
      // El precio sale del ticket-type. Una entrada gratis es simplemente un tipo
      // a precio 0 → el flujo normal la cobra a 0, sin caso especial.
      const isPresaleActive =
        tt.presale_price_cents != null &&
        (tt.presale_qty == null || tt.sold < tt.presale_qty) &&
        (tt.presale_ends_at == null || now < new Date(tt.presale_ends_at));
      const isFreeActive =
        tt.is_free && (tt.free_until_at == null || now < new Date(tt.free_until_at));
      const ap = activePricing({
        priceCents: tt.price_cents,
        presalePriceCents: tt.presale_price_cents,
        presaleQty: tt.presale_qty,
        presaleEndsAt: tt.presale_ends_at,
        sold: tt.sold,
        isPresaleActive,
        isFreeActive,
        freeUntilAt: tt.free_until_at,
      });
      priceItems.push({ ticketTypeId: tt.id, qty: item.qty, unitPriceCents: ap.priceCents });
    }
    const promoResult = applyPromos(priceItems, promos);
    const subtotal = promoResult.totalCents;
    // Comisión de Pasape (por tramos, ver serviceFee.ts) — no se cobra en
    // órdenes gratis. Se calcula acá (server, fuente de verdad). Por debajo
    // de S/15 de subtotal el fee SIEMPRE se cobra pero nunca se muestra
    // aparte (protege a Pasape y evita un desglose que asuste al comprador
    // en montos chicos); desde S/15 se respeta `fee_mode` tal cual lo
    // eligió el organizador. `service_fee_cents` en la orden siempre guarda
    // cuánto es, sin importar si se mostró o no — lo usa la liquidación
    // manual al organizador para saber cuánto descontarle.
    const { chargedFeeCents: serviceFeeCents, showFeeLine } = resolveOrderFee(
      subtotal,
      evStatus.fee_mode,
      promoResult.lines,
    );
    const total = subtotal + serviceFeeCents;
    // Subtotal real por tipo (con promos) → para repartir entre los tickets de
    // cada línea y persistir tickets.price_cents (recaudado por tipo exacto).
    // El fee NO se reparte acá: es un cargo de plataforma, no revenue de un
    // ticket_type puntual.
    const subtotalByType = new Map<string, number>();
    for (const l of promoResult.lines) subtotalByType.set(l.ticketTypeId, l.subtotalCents);

    let promoterLinkId: string | null = null;
    let promoterId: string | null = null;
    if (input.promoCode) {
      const { data: link } = await db
        .from("promoter_links")
        .select("id, promoter_id, quota")
        .eq("code", input.promoCode)
        .eq("event_id", input.eventId)
        .eq("active", true)
        .maybeSingle<{ id: string; promoter_id: string; quota: number | null }>();

      if (link) {
        // Cupo efectivo: propio del promotor o, si no tiene, el default del
        // evento (herencia link → evento). null = sin tope; -1 = personalizado
        // a "sin tope" (no hereda el default del evento).
        let effectiveQuota: number | null;
        if (link.quota === -1) {
          effectiveQuota = null;
        } else if (link.quota != null) {
          effectiveQuota = link.quota;
        } else {
          const { data: ev } = await db
            .from("events")
            .select("promoter_default_quota")
            .eq("id", input.eventId)
            .maybeSingle<{ promoter_default_quota: number | null }>();
          effectiveQuota = ev?.promoter_default_quota ?? null;
        }
        // Verificar cuota si está seteada (cuenta tickets activos/usados de este link).
        if (effectiveQuota != null) {
          const { data: paidOrders } = await db
            .from("orders")
            .select("id")
            .eq("promoter_link_id", link.id)
            .eq("status", "paid")
            .returns<Array<{ id: string }>>();
          const orderIds = (paidOrders ?? []).map((o) => o.id);
          const usedCount =
            orderIds.length === 0
              ? 0
              : (
                  await db
                    .from("tickets")
                    .select("id", { count: "exact", head: true })
                    .in("order_id", orderIds)
                    .in("status", ["active", "used"])
                ).count ?? 0;
          if (usedCount >= effectiveQuota) {
            return err("promoter_quota_exceeded");
          }
        }
        promoterLinkId = link.id;
        promoterId = link.promoter_id;
      }
    }

    // Why: el profile de un guest es un PLACEHOLDER desechable — solo existe
    // para satisfacer `orders.buyer_id`/`tickets.current_holder` (NOT NULL).
    // La identidad real del comprador vive en `orders.guest_email/guest_phone`
    // (fuente de verdad para notificaciones y el endpoint de status), y se
    // resuelve a una cuenta real recién cuando la persona hace login y
    // reclama su compra en /order (ver `claimOrder`, que reasigna
    // `current_holder`/`buyer_id` a la cuenta logueada). Por eso NO hace
    // falta "adivinar" si ya existe un profile para este email/phone — cada
    // checkout crea uno nuevo, con un email sintético garantizado único
    // (nunca colisiona, sin importar cuántas compras sin reclamar tenga la
    // misma persona). Evita la clase de bug entera de intentar deduplicar
    // por email/phone (ninguno es UNIQUE en profiles; ver historial de este
    // archivo si hace falta el contexto de por qué existía esa lógica).
    let effectiveBuyerId: string | null = input.buyerId ?? null;
    if (!effectiveBuyerId && input.guest) {
      const emailNorm = input.guest.email?.trim().toLowerCase() ?? null;
      const phoneNorm = input.guest.phone?.replace(/\D/g, "") || null;
      if (!emailNorm && !phoneNorm) return err("guest_contact_required");

      // Why: profiles.id es FK a auth.users(id), no podemos insertar profile
      // directo. Creamos un auth user (el trigger handle_new_user inserta la
      // row de profile auto) con un email SIEMPRE sintético y único —
      // aunque el guest haya dado su email real, ese real vive en
      // `orders.guest_email` (fuente de verdad para delivery), no acá.
      const synthEmail = `guest+${crypto.randomUUID()}@pasape.app`;
      const { data: authUser, error: authErr } = await db.auth.admin.createUser({
        email: synthEmail,
        email_confirm: true,
        user_metadata: { full_name: input.guest.fullName },
      });
      if (authErr || !authUser?.user) {
        // Punto ciego real detectado en QA: si esto falla, el comprador se
        // queda sin poder pagar y antes no quedaba ningún rastro del porqué.
        Sentry.captureException(new Error(authErr?.message ?? "guest_profile_create_failed"), {
          tags: { area: "tickets-buy", stage: "guest-profile-create" },
        });
        return err(authErr?.message ?? "guest_profile_create_failed");
      }
      // El trigger creó (id, email, full_name) pero no copia phone — lo
      // actualizamos acá solo como referencia; nada hace lookup por él.
      // DNI vive en orders.guest_dni (no en profiles).
      await db
        .from("profiles")
        .update({
          phone: phoneNorm,
          initial_role: "buyer",
        })
        .eq("id", authUser.user.id);
      effectiveBuyerId = authUser.user.id;
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
        service_fee_cents: serviceFeeCents,
        currency: tts[0]?.currency ?? "PEN",
        guest_email: input.guest?.email ?? null,
        guest_phone: input.guest?.phone ?? null,
        guest_name: input.guest?.fullName ?? null,
        guest_dni: input.guest?.dni ?? null,
      })
      .select("*")
      .single<OrderRow>();
    if (orderErr || !orderRow) return err(orderErr?.message ?? "order_create_failed");

    // Datos de identidad del que compra: guest o logueado (buyer). Mismo shape;
    // la diferencia es que buyer no crea auth user — ya existe sesión.
    const attendee = input.guest ?? input.buyer ?? null;

    // Persistencia para autorrelleno: la primera compra guarda DNI (kyc) y
    // teléfono (profile); las siguientes el checkout los pre-llena desde /me.
    if (attendee) {
      const phoneNorm = attendee.phone?.replace(/\D/g, "") || null;
      if (phoneNorm) {
        await db.from("profiles").update({ phone: phoneNorm }).eq("id", effectiveBuyerId);
      }
      if (attendee.dni && attendee.dni.length >= 6) {
        await db.from("kyc_documents").upsert(
          {
            profile_id: effectiveBuyerId,
            doc_kind: "dni",
            doc_number: attendee.dni,
            last2: attendee.dni.slice(-2),
          },
          { onConflict: "profile_id,doc_kind" },
        );
      }
    }

    // Nombre del comprador como fallback para entradas nominativas: si el
    // checkout no capturó un holderName por entrada ni datos de guest/buyer,
    // el ticket hereda el nombre del perfil del comprador.
    const { data: buyerProfile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", effectiveBuyerId)
      .single<{ full_name: string | null }>();
    const buyerFullName = buyerProfile?.full_name ?? null;

    const ticketsToInsert = input.items.flatMap((item) => {
      const tt = tts.find((t) => t.id === item.ticketTypeId);
      // Why: para boxes solo generamos 1 ticket (el "host") sin importar qty.
      // Los amigos del box crean su ticket al aceptar el invite link y heredan
      // box_label + box_host_ticket_id apuntando a este ticket host.
      const isBox = !!tt?.box_label;
      const slots = isBox ? 1 : item.qty;
      // Repartir el subtotal de la línea entre los tickets generados. Para box,
      // el único ticket (host) lleva el subtotal completo del box. Para entradas
      // normales, subtotal/qty por ticket con el resto en el primero — así la
      // suma de price_cents iguala el subtotal exacto (sin drift por redondeo).
      const lineSubtotal = subtotalByType.get(item.ticketTypeId) ?? 0;
      const base = Math.floor(lineSubtotal / slots);
      const remainder = lineSubtotal - base * slots;
      return Array.from({ length: slots }).map((_, i) => ({
        order_id: orderRow.id,
        ticket_type_id: item.ticketTypeId,
        price_cents: base + (i === 0 ? remainder : 0),
        holder_name: item.holderName ?? attendee?.fullName ?? buyerFullName,
        holder_email: attendee?.email ?? null,
        holder_phone: attendee?.phone ?? null,
        // El portero busca por últimos dígitos del DNI — sin esto las
        // entradas de compradores logueados eran inubicables por DNI. last2
        // (deprecado) se mantiene en sync; last4 viaja al offline y enc cifrado
        // (completo) sirve a la lista/Excel del organizador.
        holder_dni_last2: attendee?.dni ? attendee.dni.slice(-2) : null,
        holder_dni_enc: encryptDni(attendee?.dni),
        holder_dni_last4: dniLast4(attendee?.dni),
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
    if (tkErr || !tkRows) {
      // Why: el check de arriba (`tt.sold + item.qty > tt.capacity`) es
      // lectura-luego-escritura sin lock — solo una validación temprana de
      // UX. El backstop atómico real es el constraint
      // ticket_types_sold_le_capacity (ver migración
      // 20260702180000_ticket_type_sold_capacity_check.sql): el trigger
      // tickets_sync_sold recalcula `sold` con un UPDATE que toma row-lock,
      // así que compras concurrentes del último cupo se serializan y la
      // segunda choca contra el constraint (23514) en vez de sobrevender.
      // La orden queda huérfana en 'pending' y expira sola (30min, ver
      // expire_stale_pending_orders).
      if (tkErr?.code === "23514") return err("sold_out");
      return err(tkErr?.message ?? "tickets_create_failed");
    }

    // ticket_types.sold lo mantiene el trigger tickets_sync_sold a partir de los
    // tickets reales — no se toca a mano (antes se desfasaba).

    // Órdenes gratuitas: marcar paid inmediatamente, despachar QR, recalc hitos.
    if (total === 0) {
      await db
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", orderRow.id);

      after(() =>
        dispatchTicketDelivery({ db }, orderRow.id).catch((e) => {
          console.error("[buy:free] dispatchTicketDelivery failed:", (e as Error).message);
          Sentry.captureException(e, {
            tags: { area: "ticket-delivery" },
            extra: { orderId: orderRow.id, stage: "buy:free" },
          });
        }),
      );
      // Box gratis (invitación/cortesía): su grupo también nace al "pagar".
      after(() =>
        supabaseBoxRepository.ensureForOrder(orderRow.id).catch((e) => {
          console.error("[buy:free] ensureForOrder failed:", (e as Error).message);
        }),
      );

      if (promoterLinkId) {
        const { count: paidCount } = await db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("promoter_link_id", promoterLinkId)
          .eq("status", "paid");
        await supabaseCommissionTierRepository.recalcUnlocksForLink(
          promoterLinkId,
          paidCount ?? 0,
        );
      }

      return ok({
        order: { ...toOrder(orderRow), status: "paid" as const },
        tickets: (tkRows as TicketRow[]).map(toTicket),
        preference: { id: "", initPoint: "" },
      });
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
      items: [
        ...input.items.map((it) => {
          const tt = tts.find((t) => t.id === it.ticketTypeId);
          return {
            id: it.ticketTypeId,
            title: nameById.get(it.ticketTypeId) ?? "Entrada",
            quantity: it.qty,
            unitPriceCents: tt?.price_cents ?? 0,
            currency: tt?.currency ?? "PEN",
          };
        }),
        // La suma de items debe igualar lo cobrado (total_cents) cuando se
        // muestra la línea. Cuando el fee está oculto (showFeeLine=false),
        // no se agrega item — MP no exige que items sume exacto
        // (es informativo/antifraude, ver research previo).
        ...(showFeeLine
          ? [
              {
                id: "service_fee",
                title: "Servicio Pasape",
                quantity: 1,
                unitPriceCents: serviceFeeCents,
                currency: tts[0]?.currency ?? "PEN",
              },
            ]
          : []),
      ],
    });

    if (!prefResult.ok) {
      // Si no se pudo crear preferencia, marcamos la order failed para no
      // dejar capacity reservada indefinidamente.
      await db.from("orders").update({ status: "failed" }).eq("id", orderRow.id);
      // Anular tickets libera el stock: el trigger recalcula ticket_types.sold.
      await db.from("tickets").update({ status: "void" }).eq("order_id", orderRow.id);
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
    // Solo entradas que existen para el usuario: active (válida) + used (historial
    // de asistencia). Excluye void/refunded — son ventas que nunca cuajaron
    // (carrito expirado, pago fallido) o se reembolsaron; no deben aparecer ni
    // contar en la cuenta. El resto de cálculos (sold, revenue, asistentes) ya
    // los excluye en sus views/queries.
    // Filtro por orden PAGADA: los tickets se insertan `active` aunque la orden
    // siga `pending` (el check constraint del schema no permite 'pending_payment'),
    // así que una compra reservada-pero-nunca-pagada dejaría tickets activos. El
    // wallet solo debe mostrar lo realmente pagado. Las órdenes gratis (total 0) se
    // marcan `paid` al instante en BuyTickets, así que sí aparecen.
    const { data } = await db
      .from("tickets")
      .select(
        "*, order:orders!inner(status), ticket_type:ticket_types!inner(id,name,kind,event_id,event:events!inner(id,slug,title,starts_at,venue,timezone,status,cover_url,category))",
      )
      .eq("current_holder", buyerId)
      .eq("order.status", "paid")
      .in("status", ["active", "used"])
      .order("created_at", { ascending: false });
    if (!data) return [];
    // Un box es UNA entrada en el wallet. El host, además de su propio ticket,
    // sostiene los QR de acompañantes sin celular (current_holder = host,
    // box_host_ticket_id → su ticket host). Esos no son entradas aparte: se
    // gestionan dentro del panel del box. Los ocultamos de la lista cuando el
    // host también posee el ticket host referenciado. El miembro que se unió por
    // link no posee al host, así que su box sí aparece (es su entrada).
    const rawRows = data as unknown as TicketRow[];
    const ownedIds = new Set(rawRows.map((r) => r.id));
    const rows = rawRows.filter(
      (r) => !(r.box_host_ticket_id && ownedIds.has(r.box_host_ticket_id)),
    );
    // Transferencias pendientes de estos tickets: el emisor las ve como
    // "enviada · esperando reclamo" mientras el receptor no abre su link.
    const ids = rows.map((r) => r.id);
    const { data: pend } = ids.length
      ? await db
          .from("ticket_transfers")
          .select("ticket_id, to_contact")
          .eq("status", "pending")
          .in("ticket_id", ids)
      : { data: [] as { ticket_id: string; to_contact: string | null }[] };
    const pendMap = new Map(
      (pend ?? []).map((p) => [p.ticket_id, p.to_contact]),
    );
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
          status: EventStatus;
          cover_url: string | null;
          category: EventCategory | null;
        };
      };
    };
    return (rows as unknown as Joined[]).map((row) => ({
      ...toTicket(row),
      event: {
        id: row.ticket_type.event.id,
        slug: row.ticket_type.event.slug,
        title: row.ticket_type.event.title,
        startsAt: row.ticket_type.event.starts_at,
        venue: row.ticket_type.event.venue,
        timezone: row.ticket_type.event.timezone,
        status: row.ticket_type.event.status,
        coverUrl: row.ticket_type.event.cover_url,
        category: row.ticket_type.event.category,
      },
      ticketType: {
        id: row.ticket_type.id,
        name: row.ticket_type.name,
        kind: row.ticket_type.kind,
      },
      pendingTransferTo: pendMap.get(row.id) ?? null,
    }));
  },

  async getById(ticketId, buyerId) {
    const db = supabaseAdmin();
    // A diferencia de listMine, NO colapsamos el box: si el usuario es dueño del
    // ticket (current_holder), puede abrir su detalle/QR aunque sea un QR de
    // acompañante que sostiene dentro de su box. La pertenencia ya la garantiza
    // current_holder = buyerId.
    // Solo órdenes pagadas: igual que listMine, un ticket de orden `pending`
    // (reserva nunca pagada) no debe abrirse ni mostrar un QR que ya no escana.
    const { data } = await db
      .from("tickets")
      .select(
        "*, order:orders!inner(status), ticket_type:ticket_types!inner(id,name,kind,event_id,event:events!inner(id,slug,title,starts_at,venue,timezone,status,cover_url,category))",
      )
      .eq("id", ticketId)
      .eq("current_holder", buyerId)
      .eq("order.status", "paid")
      .maybeSingle();
    if (!data) return null;
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
          status: EventStatus;
          cover_url: string | null;
          category: EventCategory | null;
        };
      };
    };
    const row = data as unknown as Joined;
    const { data: pend } = await db
      .from("ticket_transfers")
      .select("to_contact")
      .eq("status", "pending")
      .eq("ticket_id", ticketId)
      .maybeSingle();
    return {
      ...toTicket(row),
      event: {
        id: row.ticket_type.event.id,
        slug: row.ticket_type.event.slug,
        title: row.ticket_type.event.title,
        startsAt: row.ticket_type.event.starts_at,
        venue: row.ticket_type.event.venue,
        timezone: row.ticket_type.event.timezone,
        status: row.ticket_type.event.status,
        coverUrl: row.ticket_type.event.cover_url,
        category: row.ticket_type.event.category,
      },
      ticketType: {
        id: row.ticket_type.id,
        name: row.ticket_type.name,
        kind: row.ticket_type.kind,
      },
      pendingTransferTo: (pend as { to_contact: string | null } | null)?.to_contact ?? null,
    };
  },

  async setHolder(input): Promise<Result<Ticket>> {
    const db = supabaseAdmin();
    // Guarda dueño + estado: solo el dueño actual puede nombrar, y solo si la
    // entrada sigue active (no tiene sentido nombrar una usada/anulada).
    // El DNI solo se toca si vino en el input (undefined = preservar el guardado).
    // Recibe el DNI completo: se cifra (enc) para la lista/Excel del organizador,
    // se derivan last4 (offline del portero) y last2 (deprecado, en sync).
    const patch: {
      holder_name: string | null;
      holder_dni_last2?: string | null;
      holder_dni_last4?: string | null;
      holder_dni_enc?: string | null;
    } = {
      holder_name: input.holderName,
    };
    if (input.dni !== undefined) {
      patch.holder_dni_enc = encryptDni(input.dni);
      patch.holder_dni_last4 = dniLast4(input.dni);
      patch.holder_dni_last2 = input.dni ? normalizeDni(input.dni).slice(-2) : null;
    }
    const { data: updated, error: upErr } = await db
      .from("tickets")
      .update(patch)
      .eq("id", input.ticketId)
      .eq("current_holder", input.ownerId)
      .eq("status", "active")
      .select("*")
      .single<TicketRow>();
    if (upErr || !updated) return err(upErr?.message ?? "set_holder_failed");
    return ok(toTicket(updated));
  },

  async transfer(input): Promise<Result<Ticket>> {
    if (!input.toProfile) return err("recipient_required");
    const db = supabaseAdmin();
    const loaded = await loadTransferable(db, input.ticketId, input.fromProfile);
    if (!loaded.ok) return loaded;

    const { data: updated, error: upErr } = await db
      .from("tickets")
      .update({ current_holder: input.toProfile, transfer_count: loaded.value.row.transfer_count + 1 })
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

  async createPendingTransfer(input): Promise<Result<{ event: { title: string; startsAt: string } }>> {
    const db = supabaseAdmin();
    const loaded = await loadTransferable(db, input.ticketId, input.fromProfile);
    if (!loaded.ok) return loaded;

    // Reenviar o cambiar de destinatario: cancela el pending anterior antes de
    // crear el nuevo (el índice único exige a lo sumo uno pendiente por ticket).
    await db
      .from("ticket_transfers")
      .update({ status: "cancelled" })
      .eq("ticket_id", input.ticketId)
      .eq("status", "pending");

    const { error: insErr } = await db.from("ticket_transfers").insert({
      ticket_id: input.ticketId,
      from_profile: input.fromProfile,
      to_profile: null,
      to_contact: input.toContact,
      pending_token: input.token,
      expires_at: input.expiresAt,
      status: "pending",
    });
    if (insErr) return err(insErr.message);
    return ok({ event: { title: loaded.value.event.title, startsAt: loaded.value.event.starts_at } });
  },

  async claimTransfer(input): Promise<Result<{ ticket: Ticket; eventSlug: string }>> {
    const db = supabaseAdmin();
    const { data: pendingRow } = await db
      .from("ticket_transfers")
      .select("id, ticket_id, from_profile, expires_at")
      .eq("pending_token", input.token)
      .eq("status", "pending")
      .maybeSingle<{ id: string; ticket_id: string; from_profile: string; expires_at: string | null }>();
    if (!pendingRow) return err("claim_not_found");
    if (pendingRow.expires_at && new Date(pendingRow.expires_at) < new Date()) {
      return err("claim_expired");
    }
    // El emisor no puede reclamar su propio envío.
    if (pendingRow.from_profile === input.toProfile) return err("cannot_claim_own");

    // El ticket debe seguir activo y aún en manos del emisor.
    const { data: tk } = await db
      .from("tickets")
      .select("*, ticket_type:ticket_types!inner(event:events!inner(slug))")
      .eq("id", pendingRow.ticket_id)
      .single();
    if (!tk) return err("ticket_not_found");
    const joined = tk as unknown as TicketRow & { ticket_type: { event: { slug: string } } };
    if (joined.status !== "active") return err("ticket_not_active");
    if (joined.current_holder !== pendingRow.from_profile) return err("claim_no_longer_valid");

    // Al reclamar capturamos la identidad de quien entra (holder real): nombre +
    // DNI. El DNI completo se cifra (enc) para la lista/Excel; last4 viaja al
    // offline; last2 (deprecado) se mantiene en sync. Si no vienen, se preservan.
    const claimPatch: {
      current_holder: string;
      transfer_count: number;
      holder_name?: string | null;
      holder_dni_enc?: string | null;
      holder_dni_last4?: string | null;
      holder_dni_last2?: string | null;
    } = {
      current_holder: input.toProfile,
      transfer_count: joined.transfer_count + 1,
    };
    if (input.fullName !== undefined && input.fullName !== null) {
      claimPatch.holder_name = input.fullName;
    }
    if (input.dni !== undefined && input.dni) {
      claimPatch.holder_dni_enc = encryptDni(input.dni);
      claimPatch.holder_dni_last4 = dniLast4(input.dni);
      claimPatch.holder_dni_last2 = normalizeDni(input.dni).slice(-2);
    }

    const { data: updated, error: upErr } = await db
      .from("tickets")
      .update(claimPatch)
      .eq("id", pendingRow.ticket_id)
      .select("*")
      .single<TicketRow>();
    if (upErr || !updated) return err(upErr?.message ?? "claim_failed");

    await db
      .from("ticket_transfers")
      .update({ status: "completed", to_profile: input.toProfile })
      .eq("id", pendingRow.id);

    return ok({ ticket: toTicket(updated), eventSlug: joined.ticket_type.event.slug });
  },

  async claimOrder(input): Promise<Result<{ ticketsClaimed: number; eventSlug: string; firstTicketId: string | null }>> {
    const db = supabaseAdmin();
    const { data: order } = await db
      .from("orders")
      .select("id, status, buyer_id, guest_email, paid_at, event_id, claimed_at")
      .eq("id", input.orderId)
      .maybeSingle<{
        id: string;
        status: string;
        buyer_id: string | null;
        guest_email: string | null;
        paid_at: string | null;
        event_id: string;
        claimed_at: string | null;
      }>();
    if (!order) return err("order_not_found");
    if (order.status === "pending") return err("order_not_paid"); // carrera con webhook: la UI reintenta
    if (order.status !== "paid") return err("order_not_claimable");

    // Slug del evento para el deep-link de éxito.
    const { data: ev } = await db
      .from("events")
      .select("slug")
      .eq("id", order.event_id)
      .maybeSingle<{ slug: string }>();
    const eventSlug = ev?.slug ?? "";

    const guest = order.buyer_id;

    // Idempotencia: la orden ya es tuya (doble pestaña, o Supabase enlazó tu
    // Google al profile-guest) → no-op exitoso, devolvemos tus entradas activas.
    if (guest && guest === input.toProfile) {
      const { data: mine } = await db
        .from("tickets")
        .select("id")
        .eq("order_id", order.id)
        .eq("current_holder", input.toProfile)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      const ids = (mine ?? []).map((t) => (t as { id: string }).id);
      return ok({ ticketsClaimed: ids.length, eventSlug, firstTicketId: ids[0] ?? null });
    }

    // Guard single-use: `claimed_at` es la fuente de verdad de "ya reclamada".
    // Si otra cuenta ya la desbloqueó (y no eres tú, cubierto arriba) → bloqueado.
    if (order.claimed_at) return err("order_already_claimed");

    // Solo se reclama una compra de INVITADO (guest_email presente). Evita que el
    // link desbloquee la compra de alguien que sí compró logueado.
    if (!order.guest_email || !guest) return err("order_not_claimable");

    // Ventana de 72h post-pago para desbloquear (decisión de producto).
    const CLAIM_WINDOW_MS = 72 * 60 * 60 * 1000;
    if (order.paid_at && Date.now() - new Date(order.paid_at).getTime() > CLAIM_WINDOW_MS) {
      return err("order_claim_expired");
    }

    // Reasignación atómica: la condición `current_holder = guest` hace que una
    // segunda ejecución concurrente matchee 0 filas. NO toca transfer_count.
    const { data: updated, error: upErr } = await db
      .from("tickets")
      .update({ current_holder: input.toProfile })
      .eq("order_id", order.id)
      .eq("current_holder", guest)
      .eq("status", "active")
      .select("id");
    if (upErr) return err(upErr.message);
    const updatedIds = (updated ?? []).map((t) => (t as { id: string }).id);

    // Mueve la titularidad de la orden + audita el desbloqueo (quién/cuándo).
    await db
      .from("orders")
      .update({
        buyer_id: input.toProfile,
        claimed_at: new Date().toISOString(),
        claimed_by: input.toProfile,
      })
      .eq("id", order.id);

    return ok({
      ticketsClaimed: updatedIds.length,
      eventSlug,
      firstTicketId: updatedIds[0] ?? null,
    });
  },

  async cancelPendingTransfer(input): Promise<Result<{ ok: true }>> {
    const db = supabaseAdmin();
    // Solo el emisor original puede cancelar su envío pendiente.
    const { data: pendingRow } = await db
      .from("ticket_transfers")
      .select("id")
      .eq("ticket_id", input.ticketId)
      .eq("from_profile", input.fromProfile)
      .eq("status", "pending")
      .maybeSingle<{ id: string }>();
    if (!pendingRow) return err("no_pending_transfer");
    const { error } = await db
      .from("ticket_transfers")
      .update({ status: "cancelled" })
      .eq("id", pendingRow.id);
    if (error) return err(error.message);
    return ok({ ok: true });
  },

  async markUsedByQr(qrCode, scanner, opts = {}) {
    const { usedAt, zoneId, expectedEventId } = opts;
    const db = supabaseAdmin();
    // Solo QR firmado ECDSA (cert~window~sig). Offline (usedAt presente) omite
    // la frescura del window: ya se verificó en la puerta al escanear (pero la
    // firma sigue verificándose, ver resolveScanInput).
    const resolved = await resolveScanInput(qrCode, { offline: !!usedAt });
    if (!resolved.ok) {
      // No registramos scan_event acá porque no tenemos ticket_id ni event_id.
      return err(resolved.error);
    }
    // El ticket resuelto DEBE pertenecer al evento de la sesión del portero.
    // Sin esto, un portero del evento A podría quemar/admitir tickets del
    // evento B presentándole un QR (genuino o forjado) de otro evento.
    if (expectedEventId && resolved.value.eventId !== expectedEventId) {
      return err("wrong_event");
    }
    // Puerta del portero: si está en una puerta custom y la entrada no le
    // corresponde, no la marca (la principal valida todas).
    if (zoneId && !(await isAllowedInZone(db, resolved.value.qrCode, zoneId))) {
      return err("wrong_zone");
    }
    return markByQrCode(db, resolved.value.qrCode, scanner, usedAt, qrCode);
  },

  async getCarouselScope(ticketId, viewerId) {
    const db = supabaseAdmin();

    // Cargamos el ticket para saber si pertenece a un box y su evento.
    const { data: tk } = await db
      .from("tickets")
      .select("id, box_label, box_host_ticket_id, current_holder, status, created_at, ticket_type:ticket_types!inner(event_id)")
      .eq("id", ticketId)
      .eq("current_holder", viewerId)
      .maybeSingle();
    if (!tk) return err("not_found");

    type TkRow = {
      id: string;
      box_label: string | null;
      box_host_ticket_id: string | null;
      current_holder: string;
      status: string;
      created_at: string;
      ticket_type: { event_id: string };
    };
    const ticket = tk as unknown as TkRow;
    const eventId = ticket.ticket_type.event_id;
    const isBoxTicket = !!ticket.box_label;

    if (isBoxTicket) {
      // El host del box es el que no tiene box_host_ticket_id (es su propio ticket host).
      // El hostTicketId puede ser el propio (si es el host) o el referenciado (si es acompañante).
      const hostTicketId = ticket.box_host_ticket_id ?? ticket.id;

      // Determinamos quién es el dueño del box: el current_holder del ticket host.
      const { data: hostTk } = await db
        .from("tickets")
        .select("current_holder")
        .eq("id", hostTicketId)
        .maybeSingle<{ current_holder: string }>();
      if (!hostTk) return err("box_host_not_found");
      const ownerId = hostTk.current_holder;

      // QR individuales que el host maneja: el ticket host (siempre) + acompañantes
      // cuyo current_holder sigue siendo el dueño del box (heldByHost).
      const { data: peers } = await db
        .from("tickets")
        .select("id, box_host_ticket_id, current_holder, created_at")
        .or(`id.eq.${hostTicketId},box_host_ticket_id.eq.${hostTicketId}`)
        .eq("current_holder", ownerId)
        .order("created_at", { ascending: true });

      type PeerRow = { id: string; box_host_ticket_id: string | null; current_holder: string; created_at: string };
      const ps = ((peers as unknown as PeerRow[] | null) ?? []);
      // Host primero, luego acompañantes por createdAt (orden estable).
      const sorted = [
        ...ps.filter((p) => p.box_host_ticket_id === null),
        ...ps.filter((p) => p.box_host_ticket_id !== null).sort((a, b) =>
          a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
        ),
      ];
      const ids = sorted.map((p) => p.id);
      const currentIndex = ids.indexOf(ticketId);

      // eventTicketCount: cuántas entradas del evento posee el viewer (event-scoped,
      // excluye tickets de box), para el link "Ver todas" (no confundir con el carrusel del box).
      const { count: eventCount } = await db
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("current_holder", viewerId)
        .eq("ticket_type.event_id" as never, eventId)
        .in("status", ["active", "used"])
        .is("box_label", null);
      // La query anterior con join implícito puede no funcionar directo; usamos select con join explícito.
      // Rehacemos con join explícito:
      const { data: eventTks } = await db
        .from("tickets")
        .select("id, ticket_type:ticket_types!inner(event_id)")
        .eq("current_holder", viewerId)
        .in("status", ["active", "used"])
        .is("box_label", null)
        .eq("ticket_types.event_id" as never, eventId);
      // Supabase no soporta filtrar por columna del join con .eq("join.col").
      // Filtramos manualmente el resultado:
      type EvTk = { id: string; ticket_type: { event_id: string } };
      const eventTicketCount = ((eventTks as unknown as EvTk[] | null) ?? [])
        .filter((r) => r.ticket_type.event_id === eventId).length;

      return ok({ ids, currentIndex, eventTicketCount });
    }

    // No es box: entradas activas del mismo evento que posee el viewer,
    // EXCLUYENDO tickets de box (box_label != null), más la actual aunque no esté active.
    const { data: evTks } = await db
      .from("tickets")
      .select("id, status, created_at, box_label, ticket_type:ticket_types!inner(event_id)")
      .eq("current_holder", viewerId)
      .in("status", ["active", "used"])
      .is("box_label", null);

    type EvTkRow = { id: string; status: string; created_at: string; box_label: string | null; ticket_type: { event_id: string } };
    const allOwned = ((evTks as unknown as EvTkRow[] | null) ?? [])
      .filter((r) => r.ticket_type.event_id === eventId);

    const eventTicketCount = allOwned.length;

    // Scope del carrusel: activos del evento, incluyendo el ticket actual aunque no esté active.
    const inScope = allOwned
      .filter((r) => r.status === "active" || r.id === ticketId)
      .sort((a, b) =>
        a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
      );

    // Si el ticket actual no estaba en la lista (used/void, no entre activos), lo añadimos.
    if (!inScope.find((r) => r.id === ticketId)) {
      inScope.push({ id: ticketId, status: ticket.status, created_at: ticket.created_at, box_label: null, ticket_type: { event_id: eventId } });
      inScope.sort((a, b) =>
        a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
      );
    }

    const ids = inScope.map((r) => r.id);
    const currentIndex = ids.indexOf(ticketId);
    return ok({ ids, currentIndex, eventTicketCount });
  },

  async markUsedByTicketId(ticketId, scanner, opts = {}) {
    const db = supabaseAdmin();
    // Admisión confiable por ticketId: alta manual desde la lista (el portero
    // admite deliberadamente a alguien que buscó por nombre/DNI) o sync de un
    // scan ya verificado offline. No requiere firma.
    const { data: row } = await db
      .from("tickets")
      .select("qr_code, ticket_types!inner(event_id)")
      .eq("id", ticketId)
      .maybeSingle<{ qr_code: string; ticket_types: { event_id: string } }>();
    if (!row) return err("invalid");
    // Igual que en el scan: el ticket debe pertenecer al evento de la sesión.
    // markUsedByTicketId no valida firma, así que este es el ÚNICO control que
    // impide admitir/quemar un ticketId de otro evento conociendo su UUID.
    if (opts.expectedEventId && row.ticket_types.event_id !== opts.expectedEventId) {
      return err("wrong_event");
    }
    return markByQrCode(db, row.qr_code, scanner, opts.usedAt, ticketId);
  },
};

// ¿La entrada del QR está permitida en la puerta `zoneId`?
// Regla por cantidad de puertas (no hay "puerta por defecto" especial):
//   - Si el evento tiene UNA sola puerta → valida todas las entradas.
//   - Si tiene varias → cada puerta valida solo los ticket_types que tiene
//     asignados en zone_ticket_types.
// Si la zona no existe o el ticket no se encuentra, no bloquea (deja que
// markByQrCode resuelva el invalid).
async function isAllowedInZone(
  db: ReturnType<typeof supabaseAdmin>,
  effectiveQrCode: string,
  zoneId: string,
): Promise<boolean> {
  const { data: zone } = await db
    .from("zones")
    .select("event_id")
    .eq("id", zoneId)
    .maybeSingle<{ event_id: string }>();
  if (!zone) return true;

  // Una sola puerta en el evento → valida todo, sin importar su lista.
  const { count } = await db
    .from("zones")
    .select("*", { count: "exact", head: true })
    .eq("event_id", zone.event_id);
  if ((count ?? 0) <= 1) return true;

  const { data: tk } = await db
    .from("tickets")
    .select("ticket_type_id")
    .eq("qr_code", effectiveQrCode)
    .maybeSingle<{ ticket_type_id: string }>();
  if (!tk) return true;

  const { data: link } = await db
    .from("zone_ticket_types")
    .select("zone_id")
    .eq("zone_id", zoneId)
    .eq("ticket_type_id", tk.ticket_type_id)
    .maybeSingle();
  return !!link;
}

// Núcleo de marcado por qr_code estático (interno). Lo comparten markUsedByQr
// (tras resolver la firma) y markUsedByTicketId (admisión confiable).
async function markByQrCode(
  db: ReturnType<typeof supabaseAdmin>,
  effectiveQrCode: string,
  scanner: ScannerRef,
  usedAt: Date | undefined,
  rawToken: string,
) {
    // Guard de orden pagada: los tickets se insertan `active` aunque la orden siga
    // `pending` (el schema no permite 'pending_payment'). Sin esto, una reserva
    // nunca pagada escanearía como VÁLIDA en la puerta. Las órdenes gratis (total 0)
    // se marcan `paid` al instante, así que sí entran. Una query indexada por
    // qr_code antes de admitir — sólo bloquea cuando la orden existe y no es 'paid'.
    const { data: ordCheck } = await db
      .from("tickets")
      .select("order:orders!inner(status)")
      .eq("qr_code", effectiveQrCode)
      .maybeSingle();
    const ordStatus = (ordCheck as { order?: { status?: string } } | null)?.order?.status;
    if (ordStatus && ordStatus !== "paid") return err("invalid");

    const { data: updatedRow, error: upErr } = await db
      .from("tickets")
      .update({ status: "used", used_at: usedAt ? usedAt.toISOString() : new Date().toISOString() })
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
        scanned_by: scanner.profileId,
        scanner_session_id: scanner.sessionId,
        result: "valid",
        raw_token: rawToken,
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
        holderDniLast4: joined.holder_dni_last4,
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
    // Detección de doble-ingreso offline: si este scan venía de la cola offline
    // (usedAt = offlineScannedAt) y el ticket YA estaba usado, dos puertas sin
    // coordinador dejaron pasar el mismo ticket. El primer-scan-gana ya marcó
    // 'valid'; este se registra como dup_offline para alertar en el dashboard.
    const flag = result === "already_used" && usedAt ? "dup_offline" : "ok";
    await db.from("scan_events").insert({
      ticket_id: ex.id,
      event_id: ex.ticket_type.event_id,
      scanned_by: scanner.profileId,
      scanner_session_id: scanner.sessionId,
      result,
      raw_token: rawToken,
      flag,
    });
    return err(result);
}

// Resuelve un QR FIRMADO a su qr_code estático interno. Soporta DOS formatos:
//   - Compacto (actual): ticketId|windowIdx|sig (112 chars, sin cert en el QR).
//     La pública del ticket es `tickets.signing_pub` (autoritativa, server-side);
//     no viaja cert porque el server ya ligó esa pública al evento al mintearlo.
//   - Legado (cert~window~sig): el cert porta la pública; se verifica contra la
//     clave del evento. Compatibilidad durante la transición.
// No hay fallback a QR estático ni a HMAC: el único input válido de cámara es la
// firma ECDSA. La admisión manual usa markUsedByTicketId, no este resolver.
//   - online (offline=false): verifica firma + frescura del window + anti-replay.
//   - offline (offline=true): verifica solo la autenticidad (el window ya se
//     validó en la puerta al escanear; al sincronizar estaría vencido).
async function resolveScanInput(
  raw: string,
  opts: { offline?: boolean } = {},
): Promise<Result<{ qrCode: string; eventId: string }>> {
  const {
    isCompactQrPayload,
    parseCompactQrPayload,
    parseSignedQrPayload,
    verifyCert,
    verifyWindow,
    verifyWindowSignature,
  } = await import("@/lib/tickets/signedQr");

  const db = supabaseAdmin();

  // ── Formato compacto (actual): el ticketId viaja en claro; la pública es
  //    signing_pub de la BD. No hay cert que verificar contra el evento. ──
  if (isCompactQrPayload(raw)) {
    const parsed = parseCompactQrPayload(raw);
    if (!parsed) return err("invalid_payload");

    const { data: row } = await db
      .from("tickets")
      .select("id, qr_code, last_used_window, signing_pub, ticket_types!inner(event_id)")
      .eq("id", parsed.ticketId)
      .maybeSingle<{
        id: string;
        qr_code: string;
        last_used_window: number | null;
        signing_pub: import("jose").JWK | null;
        ticket_types: { event_id: string };
      }>();
    if (!row) return err("invalid");
    if (!row.signing_pub) return err("invalid_code");

    if (!opts.offline) {
      if (
        row.last_used_window != null &&
        row.last_used_window === parsed.windowIdx
      ) {
        return err("code_replay");
      }
      const fresh = await verifyWindow(
        row.signing_pub,
        parsed.ticketId,
        parsed.windowIdx,
        parsed.sig,
      );
      if (!fresh) return err("invalid_code");
      await db
        .from("tickets")
        .update({ last_used_window: parsed.windowIdx })
        .eq("id", row.id);
    } else {
      // Offline (sync): el window ya venció, pero la firma DEBE ser auténtica.
      // Verificar solo la firma (sin frescura) cierra el bypass en que el cliente
      // mandaba `offlineScannedAt` con una firma basura para quemar tickets.
      const authentic = await verifyWindowSignature(
        row.signing_pub,
        parsed.ticketId,
        parsed.windowIdx,
        parsed.sig,
      );
      if (!authentic) return err("invalid_code");
    }

    return ok({ qrCode: row.qr_code, eventId: row.ticket_types.event_id });
  }

  // ── Formato legado (cert~window~sig) ──
  const { decodeJwt } = await import("jose");
  const parsed = parseSignedQrPayload(raw);
  if (!parsed) return err("invalid_payload");

  let ticketId: string;
  try {
    ticketId = decodeJwt(parsed.cert).sub ?? "";
  } catch {
    return err("invalid_payload");
  }
  if (!ticketId) return err("invalid_payload");

  const { data: row } = await db
    .from("tickets")
    .select("id, qr_code, last_used_window, ticket_types!inner(event_id)")
    .eq("id", ticketId)
    .maybeSingle<{
      id: string;
      qr_code: string;
      last_used_window: number | null;
      ticket_types: { event_id: string };
    }>();
  if (!row) return err("invalid");

  const { data: keyRow } = await db
    .from("event_signing_keys")
    .select("public_key_jwk")
    .eq("event_id", row.ticket_types.event_id)
    .maybeSingle<{ public_key_jwk: import("jose").JWK }>();
  if (!keyRow) return err("invalid_code");

  // Cert siempre: prueba autenticidad y liga el ticket al evento.
  const claims = await verifyCert(keyRow.public_key_jwk, parsed.cert);
  if (!claims || claims.ticketId !== ticketId) return err("invalid_code");

  if (!opts.offline) {
    // Anti-replay del window + frescura (anti-screenshot del QR firmado).
    if (
      row.last_used_window != null &&
      row.last_used_window === parsed.windowIdx
    ) {
      return err("code_replay");
    }
    const fresh = await verifyWindow(
      claims.ticketPub,
      ticketId,
      parsed.windowIdx,
      parsed.sig,
    );
    if (!fresh) return err("invalid_code");
    await db
      .from("tickets")
      .update({ last_used_window: parsed.windowIdx })
      .eq("id", row.id);
  } else {
    // Offline (sync): el cert ya probó autenticidad del ticket contra el evento,
    // pero la firma de window prueba posesión de la privada del ticket. Sin
    // verificarla (aunque sea vencida) un screenshot del cert con firma basura
    // pasaría. Verificamos solo la firma, no la frescura.
    const authentic = await verifyWindowSignature(
      claims.ticketPub,
      ticketId,
      parsed.windowIdx,
      parsed.sig,
    );
    if (!authentic) return err("invalid_code");
  }

  return ok({ qrCode: row.qr_code, eventId: row.ticket_types.event_id });
}
