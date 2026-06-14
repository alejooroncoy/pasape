"use client";

import { use, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { OrgShell } from "@/app/[locale]/org/_shell/OrgShell";
import {
  useOrgPromoterDetail,
  useUpdateOrgPromoter,
} from "@/lib/promoters/hooks/useOrgPromoters";
import type { OrgPromoter } from "@/server/promoters/domain/OrgPromoter";
import { formatMoney } from "@/lib/_shared/format";
import { Money } from "@/lib/_shared/money";

type Params = Promise<{ id: string; locale: string }>;

export default function OrgPromoterDetailPage({ params }: { params: Params }) {
  const { id } = use(params);
  const detail = useOrgPromoterDetail(id);
  const update = useUpdateOrgPromoter();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const promoter = detail.data?.promoter;
  const totals = detail.data?.totals;
  const byEvent = detail.data?.byEvent ?? [];

  return (
    <OrgShell>
      <div className="mx-auto w-full max-w-[1180px] pb-24 lg:pb-12">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center justify-between lg:mb-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            <button
              type="button"
              onClick={() => router.push("/org/team" as never)}
              className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-cart-ink-3 transition hover:bg-white/5 hover:text-white lg:inline-flex"
            >
              <ChevronLeft /> Equipo
            </button>
            <span className="hidden text-cart-ink-4 lg:inline">›</span>
            <button
              type="button"
              onClick={() => router.push("/org/team" as never)}
              aria-label="Atrás"
              className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white lg:hidden"
            >
              <ChevronLeft />
            </button>
            <span className="truncate text-cart-ink-2">{promoter?.name ?? "Cargando…"}</span>
          </div>
        </div>

        {/* Hero */}
        <header className="mb-7 flex items-start gap-4 lg:mb-9">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[20px] font-semibold text-cart-accent lg:size-16 lg:text-[22px]">
            {((promoter?.name?.[0] ?? "?")).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-sans text-[26px] font-semibold leading-[1.1] tracking-[-0.025em] lg:text-[34px]">
              {promoter?.name ?? "Cargando…"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-cart-ink-3">
              {promoter?.whatsapp && (
                <span className="font-mono">{promoter.whatsapp}</span>
              )}
              {promoter && (
                <>
                  <span className="text-cart-ink-4">·</span>
                  <span>{promoter.defaultCommissionPct}% comisión default</span>
                </>
              )}
              {promoter?.profileId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#22D17F]/12 px-1.5 py-px text-[9.5px] font-semibold tracking-[0.08em] text-[#22D17F]">
                  <span className="size-1 rounded-full bg-[#22D17F]" />
                  ACTIVO EN APP
                </span>
              )}
            </div>
          </div>
          {promoter && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="hidden rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white lg:inline-flex"
            >
              Editar
            </button>
          )}
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <KpiCard label="Eventos" value={(totals?.eventsCount ?? 0).toLocaleString("es-PE")} hint="participados" />
          <KpiCard
            label="Vendidas"
            value={(totals?.ticketsSold ?? 0).toLocaleString("es-PE")}
            hint="acumulado"
            tone="accent"
          />
          <KpiCard
            label="Validadas"
            value={(totals?.ticketsValidated ?? 0).toLocaleString("es-PE")}
            hint="entraron al evento"
            tone="green"
          />
          <KpiCard
            label="Ganado"
            value={formatMoneyClean(totals?.commissionCents ?? 0)}
            hint="comisión calculada"
          />
        </section>

        {/* Eventos */}
        <section className="mt-7">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">Eventos</h2>
              <p className="text-[12.5px] text-cart-ink-3">
                Cada evento donde le diste un link único.
              </p>
            </div>
          </header>

          <div className="overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev">
            {detail.isLoading ? (
              <Empty label="Cargando…" />
            ) : byEvent.length === 0 ? (
              <Empty label="Aún no le has asignado eventos." />
            ) : (
              <div className="divide-y divide-cart-line">
                {byEvent.map((e) => (
                  <EventRow
                    key={e.promoterLinkId}
                    title={e.eventTitle}
                    startsAt={e.eventStartsAt}
                    ticketsSold={e.ticketsSold}
                    maxSold={Math.max(1, ...byEvent.map((x) => x.ticketsSold))}
                    commissionCents={e.commissionCents}
                    href={`/org/events/${e.eventSlug}/promoter-detail/${e.promoterLinkId}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Edit sheet */}
        <AnimatePresence>
          {editing && promoter && (
            <Sheet onClose={() => setEditing(false)} title={`Editar ${promoter.name}`}>
              <PromoterEditForm
                initial={promoter}
                isPending={update.isPending}
                onSubmit={(payload) =>
                  update.mutate(
                    { id: promoter.id, payload },
                    { onSuccess: () => setEditing(false) },
                  )
                }
              />
            </Sheet>
          )}
        </AnimatePresence>
      </div>
    </OrgShell>
  );
}

// ============================================================
// Pieces
// ============================================================
function KpiCard({
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
      <div className="mt-2 font-sans text-[26px] font-semibold leading-none tracking-[-0.03em] lg:text-[32px]">
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-cart-ink-3">{hint}</div>
    </div>
  );
}

function EventRow({
  title,
  startsAt,
  ticketsSold,
  maxSold,
  commissionCents,
  href,
}: {
  title: string;
  startsAt: string;
  ticketsSold: number;
  maxSold: number;
  commissionCents: number;
  href: string;
}) {
  const date = (() => {
    try {
      return new Date(startsAt)
        .toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
        .replace(/\./g, "");
    } catch {
      return "—";
    }
  })();
  // Barra relativa: el evento con más ventas del promotor llena la barra; el
  // resto se mide contra ese máximo (escala honesta, sin un tope inventado).
  const barPct = Math.min(100, Math.round((ticketsSold / maxSold) * 100));
  return (
    <Link
      href={href as never}
      className="grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-white/[0.02] lg:grid-cols-[1fr_auto_auto] lg:items-center lg:gap-4 lg:px-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{title}</span>
          <span className="rounded-full bg-white/5 px-1.5 py-px text-[9.5px] font-semibold tracking-[0.08em] text-cart-ink-3">
            {date}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${barPct}%`,
                background: "var(--color-cart-accent)",
              }}
            />
          </div>
          <span className="font-mono text-[11px] text-cart-ink-3">
            {formatMoneyClean(commissionCents)} comisión
          </span>
        </div>
      </div>
      <span className="hidden text-right font-mono text-[13px] font-semibold lg:inline">
        {ticketsSold} vendidas
      </span>
      <span className="hidden text-right text-[12px] font-medium text-cart-accent lg:inline">Ver →</span>
      <span className="font-mono text-[11.5px] text-cart-ink-3 lg:hidden">{ticketsSold} vendidas</span>
    </Link>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-cart-ink-3 lg:px-5">{label}</div>;
}

function ChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M10 3L5 7l5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatMoneyClean(cents: number): string {
  const s = Money.formatClean(cents);
  return s ? `S/ ${s}` : "S/ 0";
}

// ============================================================
// Edit form (reuses the same shape as /org/team)
// ============================================================
function PromoterEditForm({
  initial,
  isPending,
  onSubmit,
}: {
  initial: OrgPromoter;
  isPending: boolean;
  onSubmit: (payload: {
    name: string;
    whatsapp: string | null;
    defaultCommissionPct: number;
    notes?: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [pct, setPct] = useState(initial.defaultCommissionPct);
  const [notes, setNotes] = useState(initial.notes ?? "");

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      whatsapp: whatsapp.trim() ? whatsapp.trim() : null,
      defaultCommissionPct: pct,
      notes: notes.trim() ? notes.trim() : null,
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Field label="Nombre" value={name} onChange={setName} />
      <Field label="WhatsApp" type="tel" mono value={whatsapp} onChange={setWhatsapp} />
      <div>
        <Label>Comisión por defecto</Label>
        <div className="mt-2 flex gap-2">
          {[10, 15, 20].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPct(p)}
              className={
                "flex-1 rounded-xl px-3 py-2 text-[13.5px] font-semibold transition " +
                (pct === p
                  ? "bg-cart-accent text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)]"
                  : "bg-cart-bg-elev text-cart-ink-2 hover:text-white")
              }
            >
              {p}%
            </button>
          ))}
          <input
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="w-16 rounded-xl bg-cart-bg-elev px-2.5 py-2 text-center font-mono text-[13.5px] outline-none"
          />
        </div>
      </div>
      <Field label="Notas" value={notes} onChange={setNotes} />
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !name.trim()}
        className="mt-2 inline-flex h-12 items-center justify-center rounded-2xl bg-cart-accent px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_28px_-10px_var(--color-cart-accent-glow-strong)] disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          "rounded-xl border border-cart-line bg-cart-bg-elev px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-cart-line-strong " +
          (mono ? "font-mono text-[13.5px]" : "")
        }
      />
    </label>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">{children}</span>
  );
}

function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 140 || info.velocity.y > 700) onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-81 mx-auto max-h-[88dvh] w-full max-w-[560px] touch-none overflow-y-auto rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="sticky top-0 z-10 -mx-px flex flex-col bg-cart-bg-elev/95 px-5 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-semibold text-cart-accent"
            >
              Cerrar
            </button>
          </div>
        </div>
        <div className="px-5">{children}</div>
      </motion.div>
    </>
  );
}
