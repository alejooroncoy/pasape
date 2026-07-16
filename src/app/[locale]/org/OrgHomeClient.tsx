"use client";

import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useMyEvents } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { useRealtimeEventStats } from "@/lib/events/hooks/useRealtimeEventStats";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { useNewEventHref } from "@/lib/events/hooks/useNewEventHref";
import { formatDate, formatMoney } from "@/lib/_shared/format";
import { setEventBackTarget } from "@/lib/_shared/eventBackTarget";
import { Badge } from "@/components/ui/Badge";
import { eventStatusLabel, eventStatusTone } from "@/lib/events/eventStatusDisplay";
import type { EventStatus } from "@/server/events/domain/Event";

// Al entrar a un evento desde el home, el breadcrumb debe volver al home.
const backToHome = () => setEventBackTarget({ href: "/org", label: "Inicio" });

// La decisión "sin sesión" y "sin marcas" se resuelve en el server
// (src/app/[locale]/org/page.tsx). Acá ya asumimos auth + ≥1 marca.
export function OrgHomeClient() {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const events = useMyEvents();
  const newEventHref = useNewEventHref();

  const activeOrg = orgs.data?.find((o) => o.slug === me.data?.activeOrgSlug) ?? orgs.data?.[0];
  const firstName = me.data?.user?.fullName?.split(" ")[0];
  const greeting = firstName ? `Hola, ${firstName}` : "Hola";

  const liveEvent = events.data?.find((e) => e.status === "published");
  const totalEvents = events.data?.length ?? 0;
  const publishedCount = events.data?.filter((e) => e.status === "published").length ?? 0;
  const draftCount = events.data?.filter((e) => e.status === "draft").length ?? 0;
  const pendingReviewCount =
    events.data?.filter((e) => e.status === "pending_review").length ?? 0;
  // null = algún evento tiene un tipo de entrada sin límite (gana sobre la suma).
  const totalCapacity = (events.data ?? []).reduce<number | null>((sum, e) => {
    if (sum === null) return null;
    const eventCapacity = e.listStats ? e.listStats.capacity : (e.capacity.totalCapacity ?? 0);
    return eventCapacity === null ? null : sum + eventCapacity;
  }, 0);

  // Revenue del evento activo (si hay uno publicado). Si hay varios, se suma el primero visible.
  const liveStats = useEventStats(liveEvent?.slug ?? "");
  const liveRevenue = liveStats.data?.revenueCents ?? 0;
  // KPIs del evento en vivo al instante (Broadcast desde DB).
  useRealtimeEventStats(liveEvent?.id, liveEvent?.slug ?? "");

  return (
    <>
      <header className="mb-6 pt-2 sm:mb-7 sm:pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-medium tracking-wide text-cart-ink-3 sm:text-[12.5px]">
              {greeting}
            </div>
            <h1 className="mt-1 font-sans text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] sm:mt-0 sm:text-[clamp(28px,3.4vw,40px)] sm:tracking-[-0.03em]">
              {activeOrg?.name ?? "Tu agenda"}
            </h1>
          </div>
          <Link
            href={newEventHref as never}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-cart-accent px-5 py-3 text-[14.5px] font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 active:scale-[0.97]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Crear evento
          </Link>
        </div>
      </header>

      {orgs.isPending || events.isPending ? (
        <OrgHomeSkeleton />
      ) : (
        <div className="pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:pb-0">
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Eventos"
              value={String(totalEvents)}
              hint={
                pendingReviewCount > 0
                  ? `${draftCount} en borrador · ${pendingReviewCount} en revisión`
                  : `${draftCount} en borrador`
              }
            />
            <StatCard label="Publicados" value={String(publishedCount)} tone="accent" />
            <StatCard
              label="Aforo total"
              value={totalCapacity === null ? "Sin límite" : totalCapacity.toLocaleString("es-PE")}
            />
            <StatCard label="Recaudado" value={liveEvent ? formatMoney(liveRevenue) : "—"} hint={liveEvent ? liveEvent.title : "Sin evento activo"} tone="green" />
          </section>

          {liveEvent && (
            <section className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
                  Evento en vivo
                </h2>
                <Link
                  href={`/org/events/${liveEvent.slug}` as never}
                  onClick={backToHome}
                  className="inline-flex min-h-[36px] items-center gap-1 text-[13px] font-medium text-cart-ink-2 hover:text-cart-ink"
                >
                  Ver panel →
                </Link>
              </div>
              <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                <Link
                  href={`/org/events/${liveEvent.slug}` as never}
                  onClick={backToHome}
                  className="group relative block overflow-hidden rounded-[22px] border border-cart-line-strong bg-cart-bg-elev p-6 transition-colors hover:border-cart-accent sm:p-7"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(184,124,255,0.14), rgba(184,124,255,0.02) 55%, var(--color-cart-bg-elev))",
                  }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full"
                    style={{
                      background:
                        "radial-gradient(closest-side, var(--color-cart-accent-glow), transparent 70%)",
                      filter: "blur(20px)",
                    }}
                  />
                  <div className="relative flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-600">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_currentColor]" />
                        Live
                      </div>
                      <h3 className="font-sans text-[22px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[clamp(22px,2.4vw,30px)] sm:tracking-[-0.02em]">
                        {liveEvent.title}
                      </h3>
                      <p className="mt-2 text-[13.5px] text-cart-ink-3">
                        {formatDate(liveEvent.startsAt, liveEvent.timezone)} · {liveEvent.venue ?? "—"}
                      </p>
                    </div>
                    <div className="grid w-full grid-cols-3 gap-3 sm:w-auto sm:min-w-[360px]">
                      <MiniStat
                        label="Aforo"
                        value={
                          liveStats.data
                            ? (liveStats.data.capacity == null ? "Sin límite" : String(liveStats.data.capacity))
                            : String(liveEvent.capacity.totalCapacity ?? 0)
                        }
                      />
                      <MiniStat label="Validadas" value={String(liveStats.data?.validated ?? 0)} tone="green" />
                      <MiniStat label="Recaudado" value={formatMoney(liveStats.data?.revenueCents ?? 0)} tone="accent" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </section>
          )}

          {events.data && events.data.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
                  Tus eventos
                </h2>
                <Link
                  href={"/org/events" as never}
                  className="inline-flex min-h-[36px] items-center text-[13px] font-medium text-cart-ink-2 hover:text-cart-ink"
                >
                  Ver todos →
                </Link>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev sm:hidden">
                {events.data.map((e, idx) => (
                  <motion.div
                    key={e.id}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  >
                    <Link
                      href={`/org/events/${e.slug}` as never}
                      onClick={backToHome}
                      className={`flex min-h-[64px] items-center gap-3 px-3.5 py-3 active:bg-cart-bg-elev-2 ${
                        idx > 0 ? "border-t border-cart-line/60" : ""
                      }`}
                    >
                      <div
                        aria-hidden
                        className="size-12 flex-shrink-0 rounded-xl"
                        style={{
                          background: "linear-gradient(135deg, #4B1F9A, #7C3AED)",
                          boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-sans text-[15px] font-semibold tracking-[-0.01em]">
                          {e.title}
                        </div>
                        <div className="mt-0.5 truncate text-[12.5px] text-cart-ink-3">
                          {formatDate(e.startsAt, e.timezone)} · {e.venue ?? "—"}
                        </div>
                      </div>
                      <StatusPill status={e.status} />
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden className="ml-0.5 text-cart-ink-4">
                        <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </motion.div>
                ))}
              </div>

              <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
                {events.data.map((e) => (
                  <Link
                    key={e.id}
                    href={`/org/events/${e.slug}` as never}
                    onClick={backToHome}
                    className="group flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev p-3 transition-colors hover:border-cart-line-strong hover:bg-cart-bg-elev-2"
                  >
                    <div
                      aria-hidden
                      className="size-14 flex-shrink-0 rounded-xl"
                      style={{
                        background: "linear-gradient(135deg, #4B1F9A, #7C3AED)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-sans text-[14.5px] font-semibold tracking-[-0.01em]">
                        {e.title}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-cart-ink-3">
                        {formatDate(e.startsAt, e.timezone)} · {e.venue ?? "—"}
                      </div>
                    </div>
                    <StatusPill status={e.status} />
                  </Link>
                ))}
              </div>
            </section>
          ) : !liveEvent ? (
            <OrgEmpty />
          ) : null}
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "accent" | "green" }) {
  const valueColor =
    tone === "accent" ? "text-cart-accent" : tone === "green" ? "text-emerald-600" : "text-cart-ink";
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-cart-ink-3">{label}</div>
      <div className={`mt-2 font-sans text-[26px] font-semibold leading-none tracking-[-0.025em] sm:text-[clamp(20px,2.6vw,26px)] sm:tracking-[-0.02em] ${valueColor}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-cart-ink-4 sm:mt-0.5">{hint}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "accent" | "green" }) {
  const c =
    tone === "accent" ? "text-cart-accent" : tone === "green" ? "text-emerald-600" : "text-cart-ink";
  return (
    <div className="rounded-xl border border-cart-line bg-cart-bg/60 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-cart-ink-3">{label}</div>
      <div className={`mt-1 font-sans text-[17px] font-semibold tracking-[-0.01em] ${c}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: EventStatus }) {
  return (
    <Badge tone={eventStatusTone(status)} size="sm" className="shrink-0 uppercase tracking-wide">
      {eventStatusLabel(status)}
    </Badge>
  );
}

// Skeleton mientras cargan marcas/eventos: evita el destello del estado vacío
// ("Arma tu evento") y de los ceros antes de que llegue la data real.
function OrgHomeSkeleton() {
  return (
    <div className="animate-pulse pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:pb-0">
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4">
            <div className="h-3 w-20 rounded bg-cart-line-strong" />
            <div className="mt-3 h-7 w-12 rounded bg-cart-line-strong" />
            <div className="mt-2.5 h-2.5 w-16 rounded bg-cart-line" />
          </div>
        ))}
      </section>
      <div className="mb-3 h-3 w-24 rounded bg-cart-line-strong" />
      <div className="rounded-3xl border border-cart-line bg-cart-bg-elev p-6 sm:p-10">
        <div className="h-5 w-40 rounded bg-cart-line-strong" />
        <div className="mt-4 h-3 w-full max-w-[44ch] rounded bg-cart-line" />
        <div className="mt-2 h-3 w-3/4 max-w-[40ch] rounded bg-cart-line" />
        <div className="mt-6 h-11 w-52 rounded-full bg-cart-line-strong" />
      </div>
    </div>
  );
}

function OrgEmpty() {
  const newEventHref = useNewEventHref();
  return (
    <div className="grid items-center gap-8 rounded-3xl border border-cart-line bg-cart-bg-elev p-6 sm:p-10 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cart-accent/30 bg-cart-accent-soft px-3 py-1 text-[11.5px] font-medium tracking-wide text-cart-accent">
          ◆ Tu primera noche
        </div>
        <h2 className="font-sans text-[40px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[clamp(32px,4vw,48px)] sm:leading-[1.02] sm:tracking-[-0.035em]">
          Arma tu evento
          <br />
          <span className="font-serif italic font-normal text-cart-accent">en un minuto.</span>
        </h2>
        <p className="mt-4 max-w-[44ch] text-[14.5px] leading-[1.55] text-cart-ink-3 sm:mt-3 sm:text-[14px]">
          Sin tarjeta · publicas y compartes en 60 segundos. El cobro va directo a tu cuenta y tus clientes reciben su entrada por WhatsApp.
        </p>
        <Link
          href={newEventHref as never}
          className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-cart-accent px-5 py-3 text-[15px] font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 active:scale-[0.97] sm:mt-5 sm:min-h-[44px] sm:text-[14.5px]"
        >
          + Crear mi primer evento
        </Link>
      </div>
      <div
        aria-hidden
        className="relative hidden h-[260px] w-[200px] rounded-[20px] lg:block"
        style={{
          background: "linear-gradient(150deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 110%)",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1) inset",
          transform: "rotate(-6deg)",
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex justify-between">
            <span className="size-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
            <span className="text-[9.5px] tracking-[0.12em] text-white/80">SÁB · 22H</span>
          </div>
          <div>
            <div className="font-sans text-[22px] font-semibold leading-[0.95] tracking-[-0.03em] text-white">
              Tu evento
              <br />
              aquí.
            </div>
            <div className="mt-2 text-[10px] text-white/70">Barranco · Lima</div>
          </div>
        </div>
      </div>
    </div>
  );
}
