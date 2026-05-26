"use client";

import { use } from "react";
import { Link } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { formatMoney } from "@/lib/_shared/format";
import { EventShell } from "./_shell/EventShell";
import { SpotlightTour } from "@/components/ui/SpotlightTour";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgEventPanelPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const stats = useEventStats(slug);

  const ev = event.data?.event;
  const sold = stats.data?.sold ?? 0;
  const validated = stats.data?.validated ?? 0;
  const revenue = stats.data?.revenueCents ?? 0;
  const capacity = ev?.capacity.totalCapacity ?? 0;
  const soldPct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const validatedPct = sold ? Math.round((validated / sold) * 100) : 0;

  return (
    <EventShell slug={slug} active="panel">
      {/* KPIs */}
      <section data-tour="kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <KpiCard
          label="Vendidas"
          value={sold.toLocaleString("es-PE")}
          hint={capacity ? `${soldPct}% del aforo (${capacity.toLocaleString("es-PE")})` : "Sin aforo definido"}
          progress={capacity ? soldPct : null}
          tone="accent"
        />
        <KpiCard
          label="Validadas"
          value={validated.toLocaleString("es-PE")}
          hint={sold ? `${validatedPct}% de las vendidas` : "Sin ventas aún"}
          progress={sold ? validatedPct : null}
          tone="green"
        />
        <KpiCard
          label="Recaudado"
          value={formatMoneyClean(revenue)}
          hint="acumulado · S/"
          tone="neutral"
        />
      </section>

      {/* Body: 2 columnas en desktop, stack en mobile */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-7">
        {/* Ranking de promotores */}
        <section data-tour="promoters" className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Promotores</h2>
              <p className="text-[11.5px] text-cart-ink-3">vendido · validado · ingreso</p>
            </div>
            <Link
              href={`/org/events/${slug}/team` as never}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-cart-ink-2 transition hover:bg-white/5 hover:text-white"
            >
              Ver links →
            </Link>
          </header>

          {stats.data?.byPromoter?.length ? (
            <div className="divide-y divide-cart-line">
              {stats.data.byPromoter.map((p, i) => (
                <PromoterRow key={p.promoterLinkId} rank={i + 1} promoter={p} slug={slug} />
              ))}
            </div>
          ) : (
            <EmptyRow label="Sin ventas por promotor todavía." />
          )}
        </section>

        {/* Live feed */}
        <section data-tour="live-scans" className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
            <div className="flex items-center gap-2">
              <span className="relative grid size-5 place-items-center">
                <span className="absolute size-3 animate-ping rounded-full bg-cart-accent/40" />
                <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent-glow-strong)]" />
              </span>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Accesos en vivo</h2>
            </div>
            <span className="text-[11.5px] text-cart-ink-4">últimos 10</span>
          </header>

          {stats.data?.scansRecent.length ? (
            <ul className="divide-y divide-cart-line">
              {stats.data.scansRecent.slice(0, 10).map((s) => (
                <ScanRow key={s.id} when={s.scannedAt} result={s.result} />
              ))}
            </ul>
          ) : (
            <EmptyRow label="Aún no hay accesos registrados." />
          )}

          <div className="border-t border-cart-line p-3 lg:p-4">
            <Link
              href={`/org/events/${slug}/team` as never}
              className="block rounded-xl border border-dashed border-cart-line-strong px-3.5 py-2.5 text-center text-[12.5px] font-medium text-cart-ink-2 transition hover:border-white/40 hover:text-white"
            >
              Ver historial completo
            </Link>
          </div>
        </section>
      </div>

      {/* Quick actions (mobile inline; desktop ya está arriba) */}
      <section className="mt-6 grid grid-cols-2 gap-2.5 lg:hidden">
        <Link
          href={`/org/events/${slug}/door-link` as never}
          className="flex items-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 text-[13px] font-medium"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-cart-accent-soft text-cart-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          Link portero
        </Link>
        <button
          type="button"
          data-tour="download"
          onClick={() => {
            window.location.href = `/api/events/${slug}/export`;
          }}
          className="flex items-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 text-left text-[13px] font-medium"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-cart-accent-soft text-cart-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v8m0 0l-3-3m3 3l3-3M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Excel
        </button>
      </section>

      <SpotlightTour
        tourId="event_panel"
        steps={[
          {
            selector: "[data-tour='kpis']",
            title: "Lo importante",
            body: "Estos 3 números son tu noche.",
          },
          {
            selector: "[data-tour='promoters']",
            title: "Tu equipo",
            body: "Tap a un promotor para ver sus ventas.",
          },
          {
            selector: "[data-tour='live-scans']",
            title: "En vivo",
            body: "Cada vez que el portero escanea, aparece aquí.",
          },
          {
            selector: "[data-tour='download']",
            title: "Cuando quieras",
            body: "Bajá el Excel a cualquier hora.",
          },
        ]}
      />
    </EventShell>
  );
}

// ============================================================
// KPI Card
// ============================================================
function KpiCard({
  label,
  value,
  hint,
  progress,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  progress?: number | null;
  tone: "accent" | "green" | "neutral";
}) {
  const barColor =
    tone === "accent" ? "var(--color-cart-accent)" : tone === "green" ? "#22D17F" : "rgba(255,255,255,0.5)";
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
        <span
          className="size-1.5 rounded-full"
          style={{ background: barColor, boxShadow: tone === "green" ? "0 0 6px rgba(34,209,127,0.6)" : "none" }}
        />
        {label}
      </div>
      <div className="mt-2 font-sans text-[36px] font-semibold leading-none tracking-[-0.035em] lg:text-[44px]">
        {value}
      </div>
      <div className="mt-2 text-[11.5px] text-cart-ink-3">{hint}</div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%`, background: barColor }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Promoter row
// ============================================================
function PromoterRow({
  rank,
  promoter,
  slug,
}: {
  rank: number;
  promoter: {
    promoterLinkId: string;
    name: string;
    code: string;
    ticketsSold: number;
    ticketsValidated: number;
    revenueCents: number;
    flag?: string;
    attendanceRate?: number;
  };
  slug: string;
}) {
  const flagColor =
    promoter.flag === "suspect"
      ? "#FF4D5E"
      : promoter.flag === "watch"
        ? "#FFCE3B"
        : "#22D17F";
  const flagLabel =
    promoter.flag === "suspect"
      ? "Revisar — posible autoventa"
      : promoter.flag === "watch"
        ? "Asistencia baja"
        : "Asistencia OK";
  const pct = Math.round((promoter.attendanceRate ?? 0) * 100);

  return (
    <Link
      href={`/org/events/${slug}/promoter-detail/${promoter.promoterLinkId}` as never}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] lg:px-5"
    >
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-[12px] font-semibold text-cart-ink-2">
        {rank}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{promoter.name}</span>
          <span
            title={flagLabel}
            aria-label={flagLabel}
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: flagColor, boxShadow: `0 0 6px ${flagColor}88` }}
          />
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-cart-ink-3">
          {promoter.code} · {pct}% asistencia
        </div>
      </div>
      <div className="flex items-baseline gap-3 text-right">
        <span className="font-mono text-[13px] font-semibold">{promoter.ticketsSold}</span>
        <span className="font-mono text-[12.5px] font-semibold text-[#22D17F]">
          {promoter.ticketsValidated}
        </span>
        <span className="hidden font-mono text-[12.5px] text-cart-ink-3 sm:inline">
          {formatMoneyClean(promoter.revenueCents)}
        </span>
      </div>
    </Link>
  );
}

// ============================================================
// Scan row
// ============================================================
function ScanRow({
  when,
  result,
}: {
  when: string;
  result: "valid" | "already_used" | "invalid" | "void" | "unknown_event";
}) {
  const meta = {
    valid: { color: "#22D17F", label: "Válido" },
    already_used: { color: "#FFCE3B", label: "Ya usado" },
    invalid: { color: "#FF4D5E", label: "Inválido" },
    void: { color: "#FF4D5E", label: "Anulado" },
    unknown_event: { color: "rgba(255,255,255,0.45)", label: "Otro evento" },
  }[result];

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-5">
      <div className="flex items-center gap-2.5">
        <span
          className="size-1.5 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}88` }}
        />
        <span className="text-[13px] font-medium">{meta.label}</span>
      </div>
      <span className="font-mono text-[11.5px] text-cart-ink-3">
        {new Date(when).toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </li>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-[13px] text-cart-ink-3 lg:px-5">{label}</div>;
}

function formatMoneyClean(cents: number): string {
  const s = formatMoney(cents)
    .replace(/[^\d,.]/g, "")
    .trim();
  return s ? `S/ ${s}` : "S/ 0";
}
