"use client";

import { use, useMemo, useState } from "react";
import { EventShell } from "../../_shell/EventShell";
import { Link } from "@/i18n/navigation";
import { useEventPromoters, usePromoterLinkSales } from "@/lib/promoters/hooks/useEventPromoters";
import { useSendPromoterInvite } from "@/lib/promoters/hooks/useSendPromoterInvite";
import { formatMoney } from "@/lib/_shared/format";
import { Money } from "@/lib/_shared/money";

type Params = Promise<{ slug: string; linkId: string; locale: string }>;

export default function PromoterDetailForEventPage({ params }: { params: Params }) {
  const { slug, linkId } = use(params);
  const assignments = useEventPromoters(slug);
  const sales = usePromoterLinkSales(slug, linkId);

  const assignment = useMemo(
    () => (assignments.data ?? []).find((a) => a.promoterLinkId === linkId) ?? null,
    [assignments.data, linkId],
  );

  const rows = sales.data ?? [];
  const totals = useMemo(() => {
    const sold = rows.reduce((acc, r) => acc + r.ticketCount, 0);
    const revenue = rows.reduce((acc, r) => acc + r.totalCents, 0);
    const commissionPct = assignment?.eventCommissionPct ?? 0;
    const commission = Math.round((revenue * commissionPct) / 100);
    return { sold, revenue, commission, orders: rows.length };
  }, [rows, assignment]);

  return (
    <EventShell slug={slug} active="panel">
      {/* Header del promotor */}
      <section className="mb-6 flex items-center gap-4 rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[16px] font-semibold text-cart-accent">
          {((assignment?.name?.[0] ?? "?")).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-sans text-[18px] font-semibold tracking-[-0.02em] lg:text-[20px]">
              {assignment?.name ?? "Cargando…"}
            </h2>
            {assignment && !assignment.profileId && (
              <span className="rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-300">
                SIN ACTIVAR
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11.5px] text-cart-ink-3">
            /r/{assignment?.code ?? "—"} · {assignment?.eventCommissionPct ?? 0}% comisión
          </div>
        </div>
        {assignment && <LinkActions url={assignment.url} name={assignment.name} whatsapp={assignment.whatsapp} />}
      </section>

      {/* Activación pendiente — sólo si el promotor aún no firmó */}
      {assignment && !assignment.profileId && (
        <InviteCard
          orgPromoterId={assignment.orgPromoterId}
          promoterName={assignment.name}
          whatsapp={assignment.whatsapp}
        />
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi label="Órdenes" value={totals.orders.toLocaleString("es-PE")} hint="pagadas" />
        <Kpi label="Tickets" value={totals.sold.toLocaleString("es-PE")} hint="vendidos" tone="accent" />
        <Kpi label="Recaudado" value={formatMoneyClean(totals.revenue)} hint="bruto" />
        <Kpi label="Comisión" value={formatMoneyClean(totals.commission)} hint="calculada" tone="green" />
      </section>

      {/* Acceso a hitos / premios */}
      <Link
        href={`/org/events/${slug}/promoters/${linkId}/tiers` as never}
        className="mt-5 flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3 transition hover:border-cart-line-strong"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cart-accent-soft text-cart-accent">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 16V8m4 8V4m4 12v-6m4 6v-9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
            Comisión por negociación
          </div>
          <div className="mt-0.5 truncate text-[14px] font-medium text-white">
            Hitos en efectivo y premios en especie
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-cart-ink-3"
        >
          <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* Tabla de ventas */}
      <section className="mt-7 rounded-2xl border border-cart-line bg-cart-bg-elev">
        <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Ventas</h3>
            <p className="text-[11.5px] text-cart-ink-3">cada compra hecha desde su link</p>
          </div>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10.5px] font-semibold text-cart-ink-3">
            {rows.length}
          </span>
        </header>

        {sales.isLoading ? (
          <Empty label="Cargando…" />
        ) : rows.length === 0 ? (
          <Empty label="Sin ventas todavía." />
        ) : (
          <div className="divide-y divide-cart-line">
            {rows.map((r) => (
              <SaleRow key={r.orderId} sale={r} />
            ))}
          </div>
        )}
      </section>
    </EventShell>
  );
}

function InviteCard({
  orgPromoterId,
  promoterName,
  whatsapp,
}: {
  orgPromoterId: string;
  promoterName: string;
  whatsapp: string | null;
}) {
  const send = useSendPromoterInvite(orgPromoterId);
  const result = send.data;

  const expiresLabel = result?.expiresAt
    ? new Date(result.expiresAt).toLocaleString("es-PE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section
      className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/[0.05] p-4 lg:p-5"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,206,59,0.06), rgba(20,12,40,0.0))",
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 6h14M3 6l1 9a2 2 0 002 2h8a2 2 0 002-2l1-9M8 10v3M12 10v3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              Activación pendiente
            </div>
            <div className="mt-0.5 text-[14px] font-medium text-white">
              {promoterName.split(" ")[0]} todavía no entró a su panel.
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-cart-ink-3">
              Le mandamos un mensaje de WhatsApp con un link para activar su cuenta.
              {whatsapp && (
                <>
                  {" "}Se envía a <span className="font-mono text-cart-ink-2">{whatsapp}</span>.
                </>
              )}
            </p>
            {result && (
              <p
                className={
                  "mt-2 text-[11.5px] " +
                  (result.delivered ? "text-[#22D17F]" : "text-amber-300")
                }
              >
                {result.delivered
                  ? `✓ Mensaje enviado. El link caduca ${expiresLabel ?? "en 48 h"}.`
                  : "⚠ Token generado pero el envío de WhatsApp falló. Revisa configuración de Kapso."}
              </p>
            )}
            {send.error && (
              <p className="mt-2 text-[11.5px] text-red-300">
                {(send.error as Error).message}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => send.mutate()}
          disabled={send.isPending || !whatsapp}
          className="self-start rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_-8px_var(--color-cart-accent-glow-strong)] transition hover:brightness-110 disabled:opacity-60 lg:self-auto"
        >
          {send.isPending
            ? "Enviando…"
            : result
              ? "Reenviar invitación"
              : "Enviar invitación"}
        </button>
      </div>
    </section>
  );
}

function LinkActions({
  url,
  name,
  whatsapp,
}: {
  url: string;
  name: string;
  whatsapp: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      const u =
        typeof window !== "undefined" && url.startsWith("/")
          ? `${window.location.origin}${url}`
          : url;
      await navigator.clipboard.writeText(u);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };
  const onWa = () => {
    if (!whatsapp) return;
    const u =
      typeof window !== "undefined" && url.startsWith("/")
        ? `${window.location.origin}${url}`
        : url;
    const text = encodeURIComponent(
      `Hola ${name.split(" ")[0]}, este es tu link para vender el evento: ${u}`,
    );
    const phone = whatsapp.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onCopy}
        className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/10"
      >
        {copied ? "✓ Copiado" : "Copiar"}
      </button>
      {whatsapp && (
        <button
          type="button"
          onClick={onWa}
          aria-label="WhatsApp"
          className="grid size-8 place-items-center rounded-full"
          style={{ background: "#25D366" }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="#062315">
            <path d="M16.6 3.4A9 9 0 0 0 2 12.1l-1 4.9 5-1.3a9 9 0 0 0 4 1h0a9 9 0 0 0 9-9 9 9 0 0 0-2.4-4.3z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "accent" | "green" | "neutral";
}) {
  const dot =
    tone === "accent" ? "var(--color-cart-accent)" : tone === "green" ? "#22D17F" : "rgba(255,255,255,0.5)";
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
        <span className="size-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </div>
      <div className="mt-2 font-sans text-[24px] font-semibold leading-none tracking-[-0.03em] lg:text-[30px]">
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-cart-ink-3">{hint}</div>
    </div>
  );
}

function SaleRow({
  sale,
}: {
  sale: {
    orderId: string;
    buyerName: string | null;
    buyerEmail: string | null;
    ticketTypeName: string;
    ticketCount: number;
    totalCents: number;
    paidAt: string;
  };
}) {
  const when = sale.paidAt
    ? new Date(sale.paidAt).toLocaleString("es-PE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const buyerLabel = sale.buyerName ?? sale.buyerEmail ?? "Comprador";
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[1.6fr_1fr_auto_auto] lg:px-5">
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{buyerLabel}</div>
        <div className="truncate text-[11.5px] text-cart-ink-3">
          {sale.buyerEmail && sale.buyerName ? sale.buyerEmail : sale.orderId.slice(0, 8)}
        </div>
      </div>
      <div className="hidden text-[12.5px] text-cart-ink-2 lg:block">
        {sale.ticketTypeName || "—"}
        {sale.ticketCount > 1 && (
          <span className="ml-1 rounded-full bg-white/5 px-1.5 py-px text-[10px] font-semibold text-cart-ink-3">
            ×{sale.ticketCount}
          </span>
        )}
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] font-semibold">{formatMoneyClean(sale.totalCents)}</div>
        <div className="font-mono text-[10.5px] text-cart-ink-3 lg:hidden">×{sale.ticketCount}</div>
      </div>
      <div className="hidden font-mono text-[11.5px] text-cart-ink-3 lg:block">{when}</div>
      <div className="col-span-2 font-mono text-[10.5px] text-cart-ink-3 lg:hidden">{when}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-cart-ink-3 lg:px-5">{label}</div>;
}

function formatMoneyClean(cents: number): string {
  const s = Money.formatClean(cents);
  return s ? `S/ ${s}` : "S/ 0";
}
