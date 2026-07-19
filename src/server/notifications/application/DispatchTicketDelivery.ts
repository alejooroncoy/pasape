import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { NotificationSender } from "../ports/NotificationSender";
import { CompositeNotificationSender } from "../infrastructure/CompositeNotificationSender";
import { ResendEmailSender } from "../infrastructure/ResendEmailSender";
import { WhatsAppNotificationSender } from "../infrastructure/WhatsAppNotificationSender";
import { signOrderLink } from "../domain/OrderLinkToken";
import { resolveHolderEmail, resolveHolderPhone } from "@/server/_shared/crypto/holderContact";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";

// Despacha el QR del ticket por email + WhatsApp tras un pago exitoso.
//
// Hasta 2 llamadores independientes pueden marcar la misma orden como pagada
// casi al mismo tiempo (PayWithCard/PayWithYape, respuesta directa de MP, y
// HandleWebhook, el webhook real que MP dispara aparte) — sin coordinación
// entre ellos, el comprador recibiría el email/WhatsApp duplicado. El claim
// atómico sobre `orders.notified_at` (más abajo) resuelve esto en la raíz,
// una sola vez, para cualquier llamador presente o futuro — no en cada sitio
// que dispara el envío.

type Deps = {
  db?: SupabaseClient;
  sender?: NotificationSender;
  whatsapp?: WhatsAppNotificationSender;
  suppressWhatsApp?: boolean;
};

type OrderRow = {
  id: string;
  buyer_id: string | null;
  event_id: string;
  total_cents: number;
  guest_email: string | null;
  guest_phone: string | null;
  guest_name: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
};

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
};

type TicketRow = {
  id: string;
  holder_name: string | null;
  holder_email: string | null;
  holder_phone: string | null;
  holder_email_enc: string | null;
  holder_phone_enc: string | null;
  box_label: string | null;
  box_host_ticket_id: string | null;
  ticket_type_id: string;
  ticket_type: { unit_noun: string | null } | null;
};

const defaultSender = (suppressWhatsApp: boolean): NotificationSender =>
  new CompositeNotificationSender(
    suppressWhatsApp ? [new ResendEmailSender()] : [new ResendEmailSender(), new WhatsAppNotificationSender()],
  );

const appBaseUrl = (): string =>
  process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL ?? "https://app.pasape.lat";

export const dispatchTicketDelivery = async (
  deps: Deps,
  orderId: string,
): Promise<{ dispatched: number; emailSent: boolean; whatsappSent: boolean }> => {
  const db = deps.db ?? supabaseAdmin();
  const sender = deps.sender ?? defaultSender(!!deps.suppressWhatsApp);
  const whatsapp = deps.whatsapp ?? new WhatsAppNotificationSender();

  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id, buyer_id, event_id, total_cents, guest_email, guest_phone, guest_name")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (orderErr || !order) {
    throw new Error(`dispatchTicketDelivery: order ${orderId} not found (${orderErr?.message ?? "null"})`);
  }

  // Claim atómico: la primera invocación que reclama `notified_at` es la que
  // despacha; cualquier otra (el segundo trigger) ve 0 filas afectadas y
  // no envía nada. `UPDATE ... WHERE notified_at IS NULL` es atómico a nivel
  // de fila en Postgres — no hay ventana de carrera entre el check y el set.
  const { data: claimed } = await db
    .from("orders")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { dispatched: 0, emailSent: false, whatsappSent: false };
  }

  const [{ data: event }, { data: tickets }] = await Promise.all([
    db
      .from("events")
      .select("id, title, starts_at, venue")
      .eq("id", order.event_id)
      .maybeSingle<EventRow>(),
    db
      .from("tickets")
      .select(
        "id, holder_name, holder_email, holder_phone, holder_email_enc, holder_phone_enc, box_label, box_host_ticket_id, ticket_type_id, ticket_type:ticket_types(unit_noun)",
      )
      .eq("order_id", order.id)
      .returns<TicketRow[]>(),
  ]);

  if (!event) throw new Error(`dispatchTicketDelivery: event ${order.event_id} not found`);
  if (!tickets || tickets.length === 0) {
    return { dispatched: 0, emailSent: false, whatsappSent: false };
  }

  // Resolver contactos a nivel de orden (fallback) — buyer profile o guest.
  let buyerProfile: ProfileRow | null = null;
  if (order.buyer_id) {
    const { data: prof } = await db
      .from("profiles")
      .select("id, email, phone, full_name")
      .eq("id", order.buyer_id)
      .maybeSingle<ProfileRow>();
    buyerProfile = prof ?? null;
  }
  // Why: el profile de un guest lleva un email SINTÉTICO garantizado único
  // (ver SupabaseTicketRepository.buy) — nunca es el contacto real. La
  // orden (guest_email/guest_phone) es la fuente de verdad para delivery;
  // el profile solo gana cuando no es una compra de guest (order.guest_email
  // null → comprador logueado real, ahí sí vale su profile).
  const orderEmail = order.guest_email ?? buyerProfile?.email ?? null;
  const orderPhone = order.guest_phone ?? buyerProfile?.phone ?? null;
  const orderHolderName = order.guest_name ?? buyerProfile?.full_name ?? "Titular";

  let emailSentAny = false;
  let whatsappSentAny = false;
  const dispatches: {
    order_id: string;
    channel: "email" | "whatsapp";
    status: "sent" | "failed" | "skipped";
    error: string | null;
  }[] = [];

  // Agrupar por contacto único ANTES de mandar: si el comprador aún no repartió
  // sus N tickets a holders distintos, todos caen al mismo email/teléfono de la
  // orden (fallback) — sin esto, mandábamos N correos y N WhatsApps casi
  // idénticos a la misma persona. Un ticket ya repartido a otro holder (email/
  // teléfono propio) forma su propio grupo y recibe su propio aviso, como debe.
  const groups = new Map<string, { to: { email: string | null; phone: string | null }; holderName: string; ticketIds: string[] }>();
  for (const ticket of tickets) {
    const to = {
      email: resolveHolderEmail(ticket) ?? orderEmail,
      phone: resolveHolderPhone(ticket) ?? orderPhone,
    };
    const holderName = ticket.holder_name ?? orderHolderName;
    const key = `${to.email ?? ""}|${to.phone ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.ticketIds.push(ticket.id);
    } else {
      groups.set(key, { to, holderName, ticketIds: [ticket.id] });
    }
  }

  for (const group of groups.values()) {
    // Una sola página: el link es un redirector durable a tu orden (/order) —
    // decide solo si te manda al login+reclamo, o directo a tu ticket ya
    // reclamado (offline-capable incluido). (Reemplaza /t/?k= como vista de
    // QR y /auth/gate, que nunca existió.)
    const orderUrl = `${appBaseUrl()}/order/${order.id}/${signOrderLink(order.id)}${order.total_cents === 0 ? "?free=1" : ""}`;
    const ticketUrl = orderUrl;
    const walletSignupUrl = orderUrl;

    const res = await sender.sendTicketDelivery({
      to: group.to,
      holderName: group.holderName,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      eventVenue: event.venue,
      ticketUrl,
      walletSignupUrl,
      ticketCount: group.ticketIds.length,
    });

    if (res.emailSent) emailSentAny = true;
    if (res.whatsappSent) whatsappSentAny = true;

    const emailErr = res.errors?.find((e) => e.channel === "email")?.message ?? null;
    const waErr = res.errors?.find((e) => e.channel === "whatsapp")?.message ?? null;
    dispatches.push({
      order_id: order.id,
      channel: "email",
      status: res.emailSent ? "sent" : emailErr ? "failed" : "skipped",
      error: emailErr,
    });
    dispatches.push({
      order_id: order.id,
      channel: "whatsapp",
      status: res.whatsappSent ? "sent" : waErr ? "failed" : "skipped",
      error: waErr,
    });
  }

  // Segundo WhatsApp, solo al host de un box (nunca a acompañantes): invita a
  // compartir su link una vez que el QR normal ya salió. El box nace acá si
  // aún no existe — es idempotente y ya se dispara en paralelo desde el
  // handler de pago, pero sin garantía de orden respecto a este despacho, así
  // que lo re-aseguramos antes de leer su invite_token.
  const boxHostTickets = tickets.filter((t) => t.box_label && !t.box_host_ticket_id);
  if (!deps.suppressWhatsApp && boxHostTickets.length > 0) {
    await supabaseBoxRepository.ensureForOrder(order.id).catch((e) => {
      console.error("[dispatchTicketDelivery] ensureForOrder (box invite) falló:", (e as Error).message);
    });
    for (const host of boxHostTickets) {
      const group = [...groups.values()].find((g) => g.ticketIds.includes(host.id));
      if (!group?.to.phone) continue;
      const { data: box } = await db
        .from("boxes")
        .select("invite_token, box_number, capacity")
        .eq("order_id", order.id)
        .eq("ticket_type_id", host.ticket_type_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ invite_token: string; box_number: string | null; capacity: number }>();
      if (!box || box.capacity <= 1) continue;
      // "Box" era literal — si el organizador llamó a su unidad "Mesa" o
      // "Grupo" (ticket_type.unit_noun), el mensaje de WhatsApp seguía
      // diciendo "Box 4" igual. Con unit_noun, usa el sustantivo que el
      // organizador eligió; sin personalizar, cae a "Box" (default actual).
      const unitNoun = host.ticket_type?.unit_noun?.trim() || "Box";
      const unitNounEscaped = unitNoun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const alreadyPrefixed = new RegExp(`^${unitNounEscaped}\\b`, "i").test(box.box_number?.trim() ?? "");
      const boxLabel = box.box_number
        ? alreadyPrefixed
          ? box.box_number
          : `${unitNoun} ${box.box_number}`
        : host.box_label ?? `tu ${unitNoun.toLowerCase()}`;
      await whatsapp.sendBoxInvite({
        phone: group.to.phone,
        holderName: group.holderName,
        boxLabel,
        eventTitle: event.title,
        shareToken: box.invite_token,
      });
    }
  }

  if (dispatches.length > 0) {
    const { error: dispatchInsertErr } = await db.from("notification_dispatches").insert(dispatches);
    if (dispatchInsertErr) {
      console.error(
        "[dispatchTicketDelivery] notification_dispatches insert failed:",
        dispatchInsertErr.message,
      );
    }
  }

  // In-app notification (solo si hay buyer logueado).
  if (order.buyer_id) {
    await db.from("notifications").insert({
      profile_id: order.buyer_id,
      kind: "ticket_ready",
      payload: {
        orderId: order.id,
        ticketsCount: tickets.length,
        eventTitle: event.title,
      },
    });
  }

  return { dispatched: tickets.length, emailSent: emailSentAny, whatsappSent: whatsappSentAny };
};
