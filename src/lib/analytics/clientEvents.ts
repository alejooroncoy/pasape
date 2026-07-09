import posthog from "posthog-js";
import { trackAnalyticsEvent } from "./track";

function capture(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
  trackAnalyticsEvent(event, properties);
}

// Un método por evento client-side: los componentes llaman a estos en vez de
// `posthog.capture("...")` a mano — nombres y properties quedan en un solo
// lugar, así un cambio de shape no obliga a tocar cada componente.
export const clientEvents = {
  identify: (userId: string, properties: { email?: string | null; name?: string | null }) =>
    posthog.identify(userId, properties),

  signInStarted: (properties: { provider: string }) => {
    capture("sign_in_started", properties);
    capture("login", properties);
  },

  signOut: () => {
    capture("sign_out");
    posthog.reset();
  },

  onboardingCompleted: (properties: { role: string; is_organizer: boolean }) => {
    capture("onboarding_completed", properties);
    capture("sign_up", properties);
  },

  checkoutStarted: (properties: { event_slug: string; location: string }) => {
    capture("checkout_started", properties);
    capture("checkout_start", properties);
  },

  checkoutCompleted: (properties: { event_slug: string; order_id?: string }) => {
    capture("checkout_complete", properties);
  },

  eventView: (properties: { event_slug: string; event_id: string }) => {
    capture("event_view", properties);
  },

  search: (properties: { query: string; location: string }) => {
    capture("search", properties);
  },

  eventSaved: (properties: { event_id: string; saved: boolean }) =>
    capture("event_saved", properties),

  eventShared: (properties: { method: "native_share" | "clipboard" }) =>
    capture("event_shared", properties),

  checkoutStepAdvanced: (properties: {
    from_phase: string;
    to_phase: string;
    event_slug: string;
    items_count: number;
  }) => capture("checkout_step_advanced", properties),

  ticketViewed: (properties: { ticket_id: string; event_id: string; status: string }) =>
    capture("ticket_viewed", properties),

  ticketQrResult: (properties: { ticket_id: string; ok: boolean; error: string | null }) =>
    capture("ticket_qr_result", properties),
};
