import "server-only";
import { getPostHogClient } from "@/lib/posthog-server";

// Un método por evento server-side: los route handlers llaman a estos en vez
// de armar `ph.capture({...})` a mano — nombres y properties quedan en un solo
// lugar, así un cambio de shape no obliga a tocar cada ruta.
const capture = (
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) => {
  getPostHogClient().capture({ distinctId, event, properties });
};

export const serverEvents = {
  identify: (
    distinctId: string,
    properties: { email?: string | null; name?: string | null },
  ) => getPostHogClient().identify({ distinctId, properties }),

  userSignedIn: (distinctId: string, properties: { provider: string }) =>
    capture(distinctId, "user_signed_in", properties),

  newsletterSubscribed: (distinctId: string, properties: { source: string }) =>
    capture(distinctId, "newsletter_subscribed", properties),

  eventCreated: (
    distinctId: string,
    properties: { event_id: string; category: string | null },
  ) => capture(distinctId, "event_created", properties),

  eventPublished: (distinctId: string, properties: { event_slug: string }) =>
    capture(distinctId, "event_published", properties),

  ticketTypeCreated: (
    distinctId: string,
    properties: { event_slug: string; kind?: string },
  ) => capture(distinctId, "ticket_type_created", properties),

  zoneCreated: (distinctId: string, properties: { event_slug: string }) =>
    capture(distinctId, "zone_created", properties),

  courtesyCreated: (distinctId: string, properties: { event_slug: string }) =>
    capture(distinctId, "courtesy_created", properties),

  promoterLinkCreated: (distinctId: string, properties: { event_slug: string }) =>
    capture(distinctId, "promoter_link_created", properties),

  promoterApplied: (distinctId: string, properties: { event_id?: string }) =>
    capture(distinctId, "promoter_applied", properties),

  teamMemberInvited: (distinctId: string, properties: { role?: string }) =>
    capture(distinctId, "team_member_invited", properties),

  exportDownloaded: (distinctId: string, properties: { event_slug: string }) =>
    capture(distinctId, "export_downloaded", properties),

  orderCreated: (
    distinctId: string,
    properties: {
      order_id?: string;
      event_id?: string;
      items_count: number;
      total_cents?: number;
      currency?: string;
      has_promo: boolean;
    },
  ) => capture(distinctId, "order_created", properties),

  paymentCardInitiated: (distinctId: string, properties: { order_id: string }) =>
    capture(distinctId, "payment_card_initiated", properties),

  paymentYapeInitiated: (distinctId: string, properties: { order_id: string }) =>
    capture(distinctId, "payment_yape_initiated", properties),

  paymentFailed: (
    distinctId: string,
    properties: { order_id: string; method: "card" | "yape" | "mp_webhook"; mp_status?: string },
  ) => capture(distinctId, "payment_failed", properties),

  paymentCompleted: (distinctId: string, properties: { order_id: string }) =>
    capture(distinctId, "payment_completed", properties),

  ticketTransferStarted: (distinctId: string, properties: { ticket_id: string }) =>
    capture(distinctId, "ticket_transfer_started", properties),

  ticketTransferCancelled: (distinctId: string, properties: { ticket_id: string }) =>
    capture(distinctId, "ticket_transfer_cancelled", properties),

  ticketClaimed: (
    distinctId: string,
    properties: { ticket_id: string; event_slug: string },
  ) => capture(distinctId, "ticket_claimed", properties),

  orderClaimed: (
    distinctId: string,
    properties: { order_id: string; tickets_claimed: number; event_slug: string },
  ) => capture(distinctId, "order_claimed", properties),

  // Señal anti-bot: un evento por intento evaluado. En shadow mode alimenta los
  // dashboards para calibrar umbrales antes de activar fricción. La métrica de
  // salud vive aquí: cruzar bot_signal (action='would_block') con payment_completed
  // por order_id revela cuántos pagos exitosos (≈ humanos) tocaría el enforcement.
  botSignal: (
    distinctId: string,
    properties: {
      phase: string;
      bot_score: number;
      reasons: string[];
      action: string;
      enforcement_mode: string;
      event_id?: string | null;
      order_id?: string | null;
      checkout_token_ok: boolean;
      ms_since_mount?: number | null;
    },
  ) => capture(distinctId, "bot_signal", properties),
};
