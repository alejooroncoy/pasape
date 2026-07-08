<wizard-report>
# PostHog post-wizard report

The wizard completed a deep integration of PostHog into Pasape's Next.js App Router application. The integration was already partially in place — SDK initialization, reverse proxy, server client, user identification, and most event captures were present. The wizard verified all 14 planned events are correctly implemented, fixed a TypeScript type error (`Order.profileId` → `Order.buyerId` in the buy route), confirmed environment variables are set, and created a PostHog dashboard with 5 key business insights.

## Events tracked

| Event name | Description | File |
|---|---|---|
| `sign_in_started` | User clicks the Google sign-in button in the SignInDrawer | `src/app/[locale]/_home/SignInDrawer.tsx` |
| `user_signed_in` | OAuth callback confirms successful Google sign-in (server-side) | `src/app/auth/callback/route.ts` |
| `sign_out` | User signs out, triggering session clear and PostHog reset | `src/lib/identity/hooks/useSupabaseAuth.ts` |
| `onboarding_completed` | User completes the multi-step onboarding flow | `src/app/[locale]/auth/onboarding/page.tsx` |
| `checkout_started` | User clicks "Comprar entradas" on the event detail page | `src/app/[locale]/events/[slug]/EventDetailClient.tsx` |
| `event_saved` | User saves or un-saves an event to their favorites | `src/app/[locale]/events/[slug]/EventDetailClient.tsx` |
| `event_shared` | User taps the share button (native share or clipboard) | `src/app/[locale]/events/[slug]/EventDetailClient.tsx` |
| `checkout_step_advanced` | User advances between checkout phases (pick→data, data→pay) | `src/app/[locale]/events/[slug]/buy/page.tsx` |
| `order_created` | Server creates a ticket order with stock reserved (server-side) | `src/app/api/tickets/buy/route.ts` |
| `payment_card_initiated` | Server forwards a card payment request to Mercado Pago (server-side) | `src/app/api/payments/card/route.ts` |
| `payment_yape_initiated` | Server forwards a Yape payment request to Mercado Pago (server-side) | `src/app/api/payments/yape/route.ts` |
| `payment_completed` | MercadoPago webhook confirms a successful payment (server-side) | `src/app/api/webhook/mp/route.ts` |
| `event_published` | Organizer publishes an event, making it publicly visible (server-side) | `src/app/api/events/[slug]/publish/route.ts` |
| `promoter_applied` | A promoter submits their application for a specific event (server-side) | `src/app/api/promoters/apply/route.ts` |
| `newsletter_subscribed` | User successfully subscribes to the Pasape newsletter (server-side) | `src/app/api/newsletter/route.ts` |

Additional integration points:
- **User identification**: `PostHogIdentify` component wired in `src/app/[locale]/layout.tsx` — calls `posthog.identify(userId, { email, name })` on every page load for authenticated users. Server-side identify also runs in the OAuth callback.
- **Error tracking**: `posthog.captureException(error)` in `src/app/global-error.tsx` (alongside Sentry). `capture_exceptions: true` in `instrumentation-client.ts` for autocapture of unhandled exceptions.
- **Reverse proxy**: `/ingest/*` rewrites in `next.config.ts` route PostHog traffic through the app to avoid ad-blockers.

## Next steps

A dashboard and insights have been created to monitor key user behaviors:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/500182/dashboard/1805710)
- [Checkout funnel](https://us.posthog.com/project/500182/insights/g7xsyoiR)
- [New user sign-ins](https://us.posthog.com/project/500182/insights/IaE1Fx5H)
- [Payment method split](https://us.posthog.com/project/500182/insights/NPHjFse0)
- [Onboarding funnel](https://us.posthog.com/project/500182/insights/9slaJOIr)
- [Events published & promoter applications](https://us.posthog.com/project/500182/insights/m2ISjE9T)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogIdentify` component handles this on every page load, but verify it fires correctly after a hard refresh with an active session.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
