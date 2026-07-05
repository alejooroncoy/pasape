"use client";

import { useEffect, useMemo, useState } from "react";
import { Money } from "@/lib/_shared/money";
import { motion } from "motion/react";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyPromoterLinks, usePromoterHome } from "@/lib/promoters/hooks/usePromoter";
import { useRealtimePromoterStats } from "@/lib/events/hooks/useRealtimeEventStats";
import type { PromoterLink } from "@/server/promoters/domain/Promoter";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";
import { milestoneIcon } from "@/lib/promoters/milestoneDisplay";
import { PromoterShell } from "./_shell/PromoterShell";

const buildShareUrl = (code: string) =>
  typeof window === "undefined"
    ? `/r/${code}`
    : `${window.location.origin}/r/${code}`;

const formatSoles = (cents: number | null | undefined): string => {
  if (cents == null) return "—";
  const n = Money.toSoles(cents);
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
};

const formatDate = (iso: string, timezone?: string): string => {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: timezone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date(iso))
      .replace(/\./g, "");
  } catch {
    return iso;
  }
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

const timingLabel = (iso: string, status: "live" | "upcoming" | "closed"): string => {
  if (status === "live") return "Hoy";
  if (status === "closed") {
    return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" })
      .format(new Date(iso))
      .replace(/\./g, "");
  }
  const diffMs = new Date(iso).getTime() - Date.now();
  const daysUntil = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (daysUntil === 1) return "Mañana";
  if (daysUntil <= 7) return `En ${daysUntil} días`;
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" })
    .format(new Date(iso))
    .replace(/\./g, "");
};

export default function PromoHomePage() {
  const me = useCurrentUser();
  const links = useMyPromoterLinks();
  const items = useMemo(() => links.data ?? [], [links.data]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Separar próximos vs pasados.
  const { upcoming, past } = useMemo(() => {
    const up: typeof items = [];
    const pa: typeof items = [];
    for (const l of items) {
      if (l.eventStatus === "closed") pa.push(l);
      else up.push(l);
    }
    up.sort((a, b) => new Date(a.eventStartsAt).getTime() - new Date(b.eventStartsAt).getTime());
    pa.sort((a, b) => new Date(b.eventStartsAt).getTime() - new Date(a.eventStartsAt).getTime());
    return { upcoming: up, past: pa };
  }, [items]);

  const visible = showPast ? [...upcoming, ...past] : upcoming.length > 0 ? upcoming : past;

  // Auto-elige el más próximo al cargar.
  useEffect(() => {
    if (!activeSlug && visible.length > 0) {
      setActiveSlug(visible[0].eventSlug);
    }
  }, [activeSlug, visible]);

  const activeLink = useMemo(
    () =>
      items.find((l) => l.eventSlug === activeSlug) ??
      visible[0] ??
      items[0] ??
      null,
    [items, visible, activeSlug],
  );

  const firstName = me.data?.user?.fullName?.split(" ")[0] ?? "Promotor";

  if (links.isLoading) {
    return (
      <PromoterShell active="home">
        <SkeletonHome />
      </PromoterShell>
    );
  }

  if (items.length === 0) {
    return (
      <PromoterShell active="home">
        <EmptyHome firstName={firstName} />
      </PromoterShell>
    );
  }

  return (
    <PromoterShell active="home">
      {/* Greeting */}
      <div className="mb-6 lg:mb-8">
        <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-[-0.025em] lg:text-[36px]">
          Hola{" "}
          <span style={{ color: "var(--color-cart-accent)" }}>{firstName}</span> 👋
        </h1>
        <p className="mt-1 text-[13px] text-cart-ink-3 lg:text-[14px]">
          {items.length === 1
            ? "Tu link para vender esta noche."
            : `${upcoming.length} ${upcoming.length === 1 ? "evento próximo" : "eventos próximos"}${past.length > 0 ? ` · ${past.length} ${past.length === 1 ? "pasado" : "pasados"}` : ""}`}
        </p>
      </div>

      {/* Event chips (sólo si hay 2+ visibles) */}
      {visible.length > 1 && (
        <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {visible.map((l) => {
            const active = l.eventSlug === (activeLink?.eventSlug ?? "");
            const isPast = l.eventStatus === "closed";
            const isLive = l.eventStatus === "live";
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveSlug(l.eventSlug)}
                className={
                  "shrink-0 rounded-2xl px-3.5 py-2 text-left transition " +
                  (active
                    ? "bg-cart-accent text-white shadow-[0_8px_18px_-8px_var(--color-cart-accent-glow-strong)]"
                    : "border border-cart-line bg-cart-bg-elev text-cart-ink-2 hover:border-cart-line-strong hover:text-white")
                }
              >
                <div className="flex items-center gap-2">
                  {isLive && (
                    <span className="size-1.5 rounded-full bg-[#22D17F] shadow-[0_0_8px_rgba(34,209,127,0.7)]" />
                  )}
                  <span className="max-w-[180px] truncate text-[13px] font-semibold leading-tight">
                    {l.eventTitle}
                  </span>
                </div>
                <div
                  className={
                    "mt-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] " +
                    (active
                      ? "text-white/85"
                      : isPast
                        ? "text-cart-ink-4"
                        : isLive
                          ? "text-[#22D17F]"
                          : "text-cart-ink-3")
                  }
                >
                  {timingLabel(l.eventStartsAt, l.eventStatus)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeLink && <ActiveEventPanel link={activeLink} />}

      {/* Botón mostrar pasados */}
      {past.length > 0 && !showPast && (
        <button
          type="button"
          onClick={() => setShowPast(true)}
          className="mt-6 w-full rounded-2xl border border-dashed border-cart-line bg-transparent px-4 py-3 text-[12.5px] font-medium text-cart-ink-3 transition hover:border-cart-line-strong hover:text-white"
        >
          Ver eventos pasados ({past.length})
        </button>
      )}
      {showPast && past.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast(false)}
          className="mt-6 w-full rounded-2xl border border-dashed border-cart-line bg-transparent px-4 py-3 text-[12.5px] font-medium text-cart-ink-3 transition hover:border-cart-line-strong hover:text-white"
        >
          Ocultar pasados
        </button>
      )}
    </PromoterShell>
  );
}

// ============================================================
// Panel del evento activo (hero + KPIs + hitos + actividad)
// ============================================================
function ActiveEventPanel({ link }: { link: PromoterLink }) {
  const home = usePromoterHome(link.eventSlug);

  // El promotor ve sus ventas/hitos en vivo: mismo Broadcast del evento que usa
  // el panel del organizador.
  useRealtimePromoterStats(link.eventId, link.eventSlug);

  const sold = home.data?.soldCount ?? 0;
  const attended = home.data?.attendedCount ?? 0;
  const validated = attended;
  const generatedCents = useMemo(() => {
    // Estimación: ventas × ticket promedio. Por ahora dejamos 0 hasta tener
    // datos consolidados de la orden completa via API.
    return 0;
  }, []);

  const recent = home.data?.recent ?? [];

  return (
    <div className="flex flex-col gap-5">
      <HeroCard link={link} />

      <KpiRow sold={sold} validated={validated} generatedCents={generatedCents} />

      <PaySection
        pct={home.data?.commissionPct ?? 0}
        config={home.data?.commissionConfig ?? null}
        sold={sold}
        attended={attended}
        configured={home.data?.schemeConfigured ?? true}
        loading={home.isLoading}
      />

      <ActivityFeed recent={recent} loading={home.isLoading} />
    </div>
  );
}

// ============================================================
// Hero card del evento
// ============================================================
function HeroCard({ link }: { link: PromoterLink }) {
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(link.code);
  const dateLabel = formatDate(link.eventStartsAt);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };

  const onWa = () => {
    const msg = encodeURIComponent(
      `${link.eventTitle} — entradas acá: ${url}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-cart-line-strong p-5 lg:p-6"
      style={{
        background:
          "linear-gradient(180deg, rgba(124,58,237,0.22), rgba(20,12,40,0.6))",
        boxShadow:
          "inset 0 0 0 1px rgba(184,124,255,0.3), 0 30px 60px -30px rgba(124,58,237,0.55)",
      }}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        Vendiendo
      </div>
      <h2 className="mt-1 font-sans text-[22px] font-semibold leading-tight tracking-[-0.02em] lg:text-[26px]">
        {link.eventTitle}
      </h2>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-cart-ink-2">
        <span>{dateLabel}</span>
        {link.eventVenue && (
          <>
            <span className="text-cart-ink-4">·</span>
            <span>{link.eventVenue}</span>
          </>
        )}
      </div>

      {/* Link box */}
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3.5 py-3 backdrop-blur">
        <span className="size-2 shrink-0 rounded-full bg-[#22D17F] shadow-[0_0_8px_rgba(34,209,127,0.7)]" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-white">
          {url.replace(/^https?:\/\//, "")}
        </span>
      </div>

      {/* CTAs */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr]">
        <button
          type="button"
          onClick={onCopy}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 text-[13.5px] font-semibold text-white transition hover:bg-white/10"
        >
          {copied ? "✓ Copiado" : "Copiar link"}
        </button>
        <button
          type="button"
          onClick={onWa}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] text-[14px] font-semibold text-[#062315] shadow-[0_12px_28px_-10px_rgba(37,211,102,0.6)] transition hover:brightness-110"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="#062315">
            <path d="M9 1.5C4.86 1.5 1.5 4.86 1.5 9c0 1.43.4 2.77 1.1 3.9L1.5 16.5l3.74-1.05A7.4 7.4 0 0 0 9 16.5c4.14 0 7.5-3.36 7.5-7.5S13.14 1.5 9 1.5Zm0 13.5c-1.18 0-2.3-.31-3.27-.86l-.23-.13-2.22.62.63-2.17-.15-.24A6 6 0 1 1 15 9a6 6 0 0 1-6 6Z" />
          </svg>
          Compartir por WhatsApp
        </button>
      </div>
    </section>
  );
}

// ============================================================
// KPIs row (3 cards)
// ============================================================
function KpiRow({
  sold,
  validated,
  generatedCents,
}: {
  sold: number;
  validated: number;
  generatedCents: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
      <Kpi label="Vendidas" value={sold.toLocaleString("es-PE")} />
      <Kpi label="Validadas" value={validated.toLocaleString("es-PE")} />
      <Kpi label="Generado" value={formatSoles(generatedCents)} mono />
    </div>
  );
}

function Kpi({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-3 py-3 text-center lg:px-4 lg:py-4 lg:text-left">
      <div
        className={
          "font-sans text-[22px] font-semibold leading-none tracking-[-0.025em] lg:text-[28px] " +
          (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3 lg:text-[10.5px]">
        {label}
      </div>
    </div>
  );
}

// ============================================================
// "Cómo te pagan" — bloque adaptativo a la modalidad real del promotor.
//   percentage → % por venta · tiered → hitos en efectivo · inkind → premios.
// ============================================================
function PaySection({
  pct,
  config,
  sold,
  attended,
  configured,
  loading,
}: {
  pct: number;
  config: CommissionConfig;
  sold: number;
  attended: number;
  /** false = el organizador aún no configuró nada → estado "configurando". */
  configured: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section>
        <SectionTitle title="Cómo te pagan" />
        <div className="mt-2 h-24 animate-pulse rounded-2xl border border-cart-line bg-cart-bg-elev/50" />
      </section>
    );
  }

  // Nada configurado en ningún nivel: no digas "sin comisión" (parecería que no
  // ganas nada), di que el organizador todavía lo está armando.
  if (!configured) {
    return (
      <section>
        <SectionTitle title="Cómo te pagan" />
        <div className="mt-2 flex items-start gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-4">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-cart-accent/15 text-cart-accent">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <div className="text-[14px] font-semibold text-white">
              El organizador aún está configurando este evento
            </div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-cart-ink-3">
              Todavía no definió cómo te paga (comisión o metas). Comparte tu link igual — apenas
              lo configure, aparece acá.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Dos ejes independientes: % por venta y metas. Puede tener ambos.
  // Las metas cuentan por ventas o por asistencia según el basis que eligió el
  // organizador — usamos la unidad correcta y la nombramos explícito.
  const byAttendance = config?.basis === "attended";
  const metaProgress = byAttendance ? attended : sold;
  const unitOne = byAttendance ? "asistencia" : "venta";
  const unitMany = byAttendance ? "asistencias" : "ventas";
  const milestones =
    config && "milestones" in config
      ? [...config.milestones].sort((a, b) => a.threshold - b.threshold)
      : [];
  if (pct <= 0 && milestones.length === 0) return <PayEmpty />;

  return (
    <section>
      <SectionTitle title="Cómo te pagan" />
      {pct > 0 && (
        <div
          className="mt-2 flex items-center gap-4 rounded-2xl border border-cart-line-strong p-4"
          style={{ background: "linear-gradient(135deg, rgba(184,124,255,0.14), rgba(184,124,255,0.02))" }}
        >
          <div className="font-sans text-[34px] font-semibold leading-none tracking-[-0.03em] text-cart-accent">
            {pct}%
          </div>
          <div className="text-[13px] leading-snug text-cart-ink-2">
            de comisión por <b className="text-white">cada entrada</b> que vendas con tu link.
          </div>
        </div>
      )}
      {milestones.length > 0 && (
        <>
          <p className="mb-2 mt-3 text-[12px] text-cart-ink-3">
            Además, ganas al llegar a estas metas.
          </p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {milestones.map((m, i) =>
          m.rewardKind === "cash" ? (
            <MilestoneCard
              key={i}
              headline={formatSoles(m.amountCents ?? 0)}
              threshold={m.threshold}
              sold={metaProgress}
              unitOne={unitOne}
              unitMany={unitMany}
              tag="Efectivo"
              accent="var(--color-cart-accent)"
            />
          ) : (
            <MilestoneCard
              key={i}
              headline={m.label}
              icon={milestoneIcon(m.rewardKind)}
              threshold={m.threshold}
              sold={metaProgress}
              unitOne={unitOne}
              unitMany={unitMany}
              tag="Premio"
              accent="#FFCE3B"
            />
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PayEmpty() {
  return (
    <section>
      <SectionTitle title="Cómo te pagan" />
      <div className="mt-2 rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-6 text-center text-[13px] text-cart-ink-3">
        Este evento no ofrece comisión ni metas. Ayudas al organizador difundiéndolo.
      </div>
    </section>
  );
}

// Tarjeta de meta (hito o premio): headline + umbral + progreso vs ventas.
function MilestoneCard({
  headline,
  icon,
  threshold,
  sold,
  unitOne = "venta",
  unitMany = "ventas",
  tag,
  accent,
}: {
  headline: string;
  icon?: string;
  threshold: number;
  sold: number;
  /** Unidad del umbral según el basis de la meta: venta(s) o asistencia(s). */
  unitOne?: string;
  unitMany?: string;
  tag: string;
  accent: string;
}) {
  const reached = sold >= threshold;
  const pct = Math.min(100, Math.round((sold / Math.max(1, threshold)) * 100));
  const remaining = Math.max(0, threshold - sold);
  return (
    <div
      className={
        "block w-56 shrink-0 rounded-2xl border p-3.5 lg:w-64 " +
        (reached ? "border-cart-line-strong" : "border-cart-line")
      }
      style={
        reached
          ? { background: `linear-gradient(135deg, ${accent}22, ${accent}04)`, boxShadow: `inset 0 0 0 1px ${accent}55` }
          : { background: "var(--color-cart-bg-elev)" }
      }
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: `${accent}22`, color: accent }}
        >
          {tag}
        </span>
        {reached && <span className="text-[13px] font-semibold text-emerald-300">✓ Logrado</span>}
      </div>
      <div className="mt-2 flex items-center gap-1.5 font-sans text-[17px] font-semibold tracking-[-0.01em]">
        {icon && <span aria-hidden>{icon}</span>}
        <span className="truncate">{headline}</span>
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">
        al llegar a {threshold} {threshold === 1 ? unitOne : unitMany}
      </div>
      {!reached && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: accent }}
            />
          </div>
          <div className="mt-1.5 text-[11px] text-cart-ink-3">
            {remaining > 0 ? `Faltan ${remaining}` : "Casi"}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Activity feed
// ============================================================
function ActivityFeed({
  recent,
  loading,
}: {
  recent: Array<{ firstName: string; createdAt: string }>;
  loading: boolean;
}) {
  return (
    <section>
      <SectionTitle title="Última actividad" />
      {loading ? (
        <div className="mt-2 space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-2xl border border-cart-line bg-cart-bg-elev/50"
            />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="mt-2 rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-5 text-center text-[12.5px] text-cart-ink-3">
          Cuando alguien compre con tu link aparece aquí.
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {recent.slice(0, 5).map((r) => (
            <li
              key={r.createdAt}
              className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-2.5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#22D17F]/15 text-[12.5px] font-semibold text-[#22D17F]">
                {(r.firstName[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">
                  {r.firstName} compró
                </div>
                <div className="text-[11px] text-cart-ink-3">vía tu link</div>
              </div>
              <span className="font-mono text-[11px] text-cart-ink-3">
                {formatTime(r.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// Pieces compartidos
// ============================================================
function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
      {title}
    </h3>
  );
}

function EmptyHome({ firstName }: { firstName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 text-5xl"
      >
        🎟️
      </motion.div>
      <h1 className="font-sans text-[22px] font-semibold tracking-[-0.02em]">
        Hola {firstName}
      </h1>
      <p className="mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-cart-ink-3">
        Aún no tienes invitaciones de promotor activas. Pídele a tu organizador
        que te active para un evento.
      </p>
    </div>
  );
}

function SkeletonHome() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-md bg-cart-bg-elev" />
        <div className="h-3 w-64 animate-pulse rounded-md bg-cart-bg-elev/60" />
      </div>
      <div className="h-44 animate-pulse rounded-3xl bg-cart-bg-elev" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-cart-bg-elev" />
        ))}
      </div>
    </div>
  );
}
