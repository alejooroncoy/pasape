import posthog from "posthog-js";

// Un método por evento client-side: los componentes llaman a estos en vez de
// `posthog.capture("...")` a mano — nombres y properties quedan en un solo
// lugar, así un cambio de shape no obliga a tocar cada componente.
export const clientEvents = {
  identify: (userId: string, properties: { email?: string | null; name?: string | null }) =>
    posthog.identify(userId, properties),

  signInStarted: (properties: { provider: string }) =>
    posthog.capture("sign_in_started", properties),

  signOut: () => {
    posthog.capture("sign_out");
    posthog.reset();
  },

  onboardingCompleted: (properties: { role: string; is_organizer: boolean }) =>
    posthog.capture("onboarding_completed", properties),

  checkoutStarted: (properties: { event_slug: string; location: string }) =>
    posthog.capture("checkout_started", properties),

  eventSaved: (properties: { event_id: string; saved: boolean }) =>
    posthog.capture("event_saved", properties),

  eventShared: (properties: { method: "native_share" | "clipboard" }) =>
    posthog.capture("event_shared", properties),

  checkoutStepAdvanced: (properties: {
    from_phase: string;
    to_phase: string;
    event_slug: string;
    items_count: number;
  }) => posthog.capture("checkout_step_advanced", properties),
};
