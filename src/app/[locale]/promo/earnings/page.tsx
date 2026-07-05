"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { Money } from "@/lib/_shared/money";
import { useMyEarnings } from "@/lib/promoters/hooks/usePromoter";
import type { PromoterEventEarning } from "@/server/promoters/domain/Promoter";
import { PromoterShell } from "../_shell/PromoterShell";

const formatSoles = (cents: number): string => {
  const n = Money.toSoles(cents);
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export default function PromoEarningsPage() {
  const { data, isLoading } = useMyEarnings();

  const totals = useMemo(() => {
    const arr = data ?? [];
    // LOW-17: commissionCents se computa en vivo desde órdenes pagadas,
    // independientemente del estado del payout — una fila con payoutStatus
    // "void" (evento anulado: fraude/cancelación/no-show) mantiene su
    // commissionCents > 0 aunque ese dinero nunca se le pague. Se excluyen
    // del total y de "por cobrar" para que el hero no prometa plata anulada.
    const collectable = arr.filter((e) => e.payoutStatus !== "void");
    const totalCommission = collectable.reduce((a, e) => a + e.commissionCents, 0);
    const pending = collectable.filter((e) => e.payoutStatus === "pending").reduce((a, e) => a + e.commissionCents, 0);
    const paid = collectable.filter((e) => e.payoutStatus === "paid").reduce((a, e) => a + e.commissionCents, 0);
    const ticketsTotal = arr.reduce((a, e) => a + e.ticketsSold, 0);
    // Por cobrar = lo ganado que aún no te pagaron (lo que el promotor más mira).
    const toCollect = Math.max(0, totalCommission - paid);
    return { totalCommission, pending, paid, toCollect, ticketsTotal, count: arr.length };
  }, [data]);

  // Agrupado por MES de cobro. Piero (productor): el pago al promotor es RH
  // mensual, no por evento — su reporte se cierra el lunes/martes siguiente. La
  // liquidación agrega todos los eventos del mes, así que el historial se ordena
  // por ciclo de pago, con el subtotal que irá en su RH de ese mes.
  const months = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; items: PromoterEventEarning[]; subtotal: number; pending: boolean }
    >();
    for (const e of data ?? []) {
      const d = new Date(e.eventStartsAt);
      const key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
      }).format(d);
      let g = groups.get(key);
      if (!g) {
        // "julio 2026" → "Julio 2026" (sin el "de" que mete el formato largo).
        const parts = new Intl.DateTimeFormat("es-PE", {
          timeZone: "America/Lima",
          month: "long",
          year: "numeric",
        }).formatToParts(d);
        const month = parts.find((p) => p.type === "month")?.value ?? "";
        const year = parts.find((p) => p.type === "year")?.value ?? "";
        const label = `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
        g = { key, label, items: [], subtotal: 0, pending: false };
        groups.set(key, g);
      }
      g.items.push(e);
      g.subtotal += e.commissionCents;
      if (e.payoutStatus === "pending") g.pending = true;
    }
    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [data]);

  return (
    <PromoterShell active="earnings">
      <header className="mb-6 lg:mb-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Ganancias
        </div>
        <h1 className="mt-1 font-sans text-[28px] font-semibold leading-tight tracking-[-0.025em] lg:text-[36px]">
          Tus ganancias
        </h1>
      </header>

      {/* Hero: lo que te falta cobrar (la pregunta #1 del promotor) */}
      <section
        className="relative mb-6 overflow-hidden rounded-3xl border border-cart-line-strong p-5 lg:p-7"
        style={{
          background: "linear-gradient(180deg, rgba(124,58,237,0.18), rgba(20,12,40,0.5))",
          boxShadow: "inset 0 0 0 1px rgba(184,124,255,0.25), 0 30px 60px -30px rgba(124,58,237,0.4)",
        }}
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Te falta cobrar
        </div>
        <div className="mt-2 font-sans text-[44px] font-semibold leading-none tracking-[-0.04em] lg:text-[64px]">
          <span style={{ color: "var(--color-cart-accent)" }}>{formatSoles(totals.toCollect)}</span>
        </div>
        <div className="mt-2 text-[12.5px] text-cart-ink-3">
          {totals.toCollect > 0
            ? "El organizador te lo paga en su cierre mensual"
            : "Estás al día — no te deben nada por ahora"}
        </div>
      </section>

      {/* Las 3 preguntas del promotor: cuánto gané, cuánto me pagaron, cuántas vendí */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <SecondaryKpi label="Ganado en total" value={formatSoles(totals.totalCommission)} mono />
        <SecondaryKpi label="Ya te pagaron" value={formatSoles(totals.paid)} mono />
        <SecondaryKpi label="Entradas vendidas" value={totals.ticketsTotal.toLocaleString("es-PE")} />
      </div>

      {/* Historial por mes de cobro (ciclo de pago RH mensual — ver Piero) */}
      <section>
        <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Por mes de cobro
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-cart-line bg-cart-bg-elev/50" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-8 text-center text-[13px] text-cart-ink-3">
            Aún no tienes ganancias acumuladas. Cuando alguien compre con tu link
            aparecerá acá.
          </div>
        ) : (
          <div className="space-y-6">
            {months.map((m) => (
              <div key={m.key}>
                {/* Encabezado del mes: lo que junta su RH de ese ciclo */}
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{m.label}</h3>
                  <div className="flex items-center gap-2">
                    {m.subtotal > 0 && m.pending && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300">
                        Por cobrar
                      </span>
                    )}
                    <span className="font-mono text-[14px] font-semibold tabular-nums text-white">
                      {formatSoles(m.subtotal)}
                    </span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {m.items.map((e) => (
                    <EarningRow key={e.eventId} e={e} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </PromoterShell>
  );
}

/**
 * Fila del historial adaptada a CÓMO gana el promotor en ese evento. Cada evento
 * paga de UNA sola forma (invariante del modelo unificado):
 *  - `percentage`: % por entrada → monto + estado de pago.
 *  - `milestones` con efectivo conseguido: monto + estado de pago.
 *  - `milestones` sin efectivo (solo especie, o cash aún no desbloqueado): no
 *    muestra "S/0", sino el progreso de hitos con acceso directo a las metas.
 */
function EarningRow({ e }: { e: PromoterEventEarning }) {
  // Dos ejes: % por venta + metas. Pueden coexistir.
  const hasMetas = e.totalMilestones > 0;
  const noCash = e.commissionPct <= 0 && e.commissionCents === 0 && hasMetas;
  const modality =
    e.commissionPct > 0
      ? `${e.commissionPct}% por venta${hasMetas ? " + metas" : ""}`
      : hasMetas
        ? "Por metas"
        : "Por definir";

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{e.eventTitle}</div>
        <div className="mt-0.5 text-[11.5px] text-cart-ink-3">
          {formatDate(e.eventStartsAt)} · {e.ticketsSold} vendidas · {modality}
        </div>
      </div>
      {noCash ? (
        <div className="flex flex-col items-end gap-1">
          {e.totalMilestones > 0 && (
            <span className="text-[12.5px] font-semibold tabular-nums text-white">
              {e.unlockedMilestones}/{e.totalMilestones} hitos
            </span>
          )}
          <Link
            href={`/promo/metas?event=${e.eventSlug}` as never}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-cart-accent hover:underline"
          >
            Ver tus metas
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="text-right">
          <div className="font-mono text-[15px] font-semibold tracking-[-0.01em]">
            {formatSoles(e.commissionCents)}
          </div>
          <PayoutBadge status={e.payoutStatus} />
        </div>
      )}
    </li>
  );
}

function SecondaryKpi({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 lg:px-4 lg:py-4">
      <div
        className={
          "font-sans text-[20px] font-semibold tracking-[-0.02em] lg:text-[22px] " +
          (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        {label}
      </div>
    </div>
  );
}

function PayoutBadge({ status }: { status: "pending" | "paid" | "void" | "none" }) {
  if (status === "paid") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#22D17F]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#22D17F]">
        Pagado
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300">
        Pendiente
      </span>
    );
  }
  if (status === "void") {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">
        Anulado
      </span>
    );
  }
  return null;
}
