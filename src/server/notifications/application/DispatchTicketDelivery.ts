import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { NotificationSender } from "../ports/NotificationSender";
import { CompositeNotificationSender } from "../infrastructure/CompositeNotificationSender";
import { ResendEmailSender } from "../infrastructure/ResendEmailSender";
import { KapsoWhatsAppSender } from "../infrastructure/KapsoWhatsAppSender";
import { signOrderLink } from "../domain/OrderLinkToken";

// Despacha el QR del ticket por email + WhatsApp tras un pago exitoso.
// Idempotente respecto a la tabla `notifications` in-app (kind `ticket_ready`).

type Deps = {
  db?: SupabaseClient;
  sender?: NotificationSender;
};

type OrderRow = {
  id: string;
  buyer_id: string | null;
  event_id: string;
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
};

const defaultSender = (): NotificationSender =>
  new CompositeNotificationSender([new ResendEmailSender(), new KapsoWhatsAppSender()]);

const appBaseUrl = (): string =>
  process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL ?? "https://app.pasape.lat";

export const dispatchTicketDelivery = async (
  deps: Deps,
  orderId: string,
): Promise<{ dispatched: number; emailSent: boolean; whatsappSent: boolean }> => {
  const db = deps.db ?? supabaseAdmin();
  const sender = deps.sender ?? defaultSender();

  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id, buyer_id, event_id, guest_email, guest_phone, guest_name")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (orderErr || !order) {
    throw new Error(`dispatchTicketDelivery: order ${orderId} not found (${orderErr?.message ?? "null"})`);
  }

  const [{ data: event }, { data: tickets }] = await Promise.all([
    db
      .from("events")
      .select("id, title, starts_at, venue")
      .eq("id", order.event_id)
      .maybeSingle<EventRow>(),
    db
      .from("tickets")
      .select("id, holder_name, holder_email, holder_phone")
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

  for (const ticket of tickets) {
    const to = {
      email: ticket.holder_email ?? orderEmail,
      phone: ticket.holder_phone ?? orderPhone,
    };
    const holderName = ticket.holder_name ?? orderHolderName;
    // Una sola página: el link lleva a "Entra para ver tus entradas" (unlock),
    // que reclama la compra a tu cuenta y la deja en tu billetera con QR offline.
    // (Reemplaza /t/?k= como vista de QR y /auth/gate, que nunca existió.)
    const unlockUrl = `${appBaseUrl()}/unlock/${order.id}/${signOrderLink(order.id)}`;
    const ticketUrl = unlockUrl;
    const walletSignupUrl = unlockUrl;

    const res = await sender.sendTicketDelivery({
      to,
      holderName,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      eventVenue: event.venue,
      ticketUrl,
      walletSignupUrl,
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

  if (dispatches.length > 0) {
    await db.from("notification_dispatches").insert(dispatches);
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
