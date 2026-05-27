"use client";

import { useMemo } from "react";
import { useMyEarnings } from "@/lib/promoters/hooks/usePromoter";
import { PromoterShell } from "../_shell/PromoterShell";

const formatSoles = (cents: number): string => {
  const n = cents / 100;
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
    const totalCommission = arr.reduce((a, e) => a + e.commissionCents, 0);
    const pending = arr.filter((e) => e.payoutStatus === "pending").reduce((a, e) => a + e.commissionCents, 0);
    const paid = arr.filter((e) => e.payoutStatus === "paid").reduce((a, e) => a + e.commissionCents, 0);
    const ticketsTotal = arr.reduce((a, e) => a + e.ticketsSold, 0);
    const avgCommission =
      arr.length > 0
        ? Math.round(arr.reduce((a, e) => a + e.commissionPct, 0) / arr.length)
        : 0;
    return {
      totalCommission,
      pending,
      paid,
      ticketsTotal,
      avgCommission,
      count: arr.length,
    };
  }, [data]);

  return (
    <PromoterShell active="earnings">
      <header className="mb-6 lg:mb-8">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Ganancias
        </div>
        <h1 className="mt-1 font-sans text-[28px] font-semibold leading-tight tracking-[-0.025em] lg:text-[36px]">
          Tu acumulado
        </h1>
      </header>

      {/* Hero total */}
      <section
        className="relative mb-6 overflow-hidden rounded-3xl border border-cart-line-strong p-5 lg:p-7"
        style={{
          background:
            "linear-gradient(180deg, rgba(124,58,237,0.18), rgba(20,12,40,0.5))",
          boxShadow:
            "inset 0 0 0 1px rgba(184,124,255,0.25), 0 30px 60px -30px rgba(124,58,237,0.4)",
        }}
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Comisión acumulada
        </div>
        <div className="mt-2 font-sans text-[44px] font-semibold leading-none tracking-[-0.04em] lg:text-[64px]">
          <span style={{ color: "var(--color-cart-accent)" }}>
            {formatSoles(totals.totalCommission)}
          </span>
        </div>
        <div className="mt-2 text-[12.5px] text-cart-ink-3">
          {totals.count} {totals.count === 1 ? "evento" : "eventos"} ·{" "}
          {totals.ticketsTotal.toLocaleString("es-PE")} entradas vendidas
        </div>

        {totals.pending > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] px-3.5 py-2.5">
            <span className="size-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.6)]" />
            <div className="flex-1 text-[12.5px]">
              <b className="text-amber-200">{formatSoles(totals.pending)}</b>{" "}
              <span className="text-cart-ink-3">pendiente de pago</span>
            </div>
          </div>
        )}
      </section>

      {/* KPIs secundarios */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SecondaryKpi label="Entradas vendidas" value={totals.ticketsTotal.toLocaleString("es-PE")} />
        <SecondaryKpi label="Comisión media" value={`${totals.avgCommission}%`} mono />
        <SecondaryKpi label="Pagado" value={formatSoles(totals.paid)} mono />
      </div>

      {/* Historial */}
      <section>
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Historial
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-cart-line bg-cart-bg-elev/50"
              />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-8 text-center text-[13px] text-cart-ink-3">
            Aún no tienes ganancias acumuladas. Cuando alguien compre con tu link
            aparecerá acá.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((e) => (
              <li
                key={e.eventId}
                className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                    {e.eventTitle}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-cart-ink-3">
                    {formatDate(e.eventStartsAt)} · {e.ticketsSold} vendidas ·{" "}
                    {e.commissionPct}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[15px] font-semibold tracking-[-0.01em]">
                    {formatSoles(e.commissionCents)}
                  </div>
                  <PayoutBadge status={e.payoutStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PromoterShell>
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
