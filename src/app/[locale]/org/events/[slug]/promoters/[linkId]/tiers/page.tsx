"use client";

import { use, useMemo, useState } from "react";
import { Money } from "@/lib/_shared/money";
import { EventShell } from "../../../_shell/EventShell";
import { Link } from "@/i18n/navigation";
import {
  useCommissionTiers,
  useCreateCommissionTier,
  useDeleteCommissionTier,
  type CreateTierInput,
} from "@/lib/promoters/tiers/hooks/useCommissionTiers";
import { useEventPromoters } from "@/lib/promoters/hooks/useEventPromoters";
import type { CommissionTier } from "@/server/promoters/tiers/domain/CommissionTier";

type Params = Promise<{ slug: string; linkId: string; locale: string }>;

const formatSoles = (cents: number | null): string => {
  if (cents == null) return "—";
  const n = Money.toSoles(cents);
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
};

export default function OrgPromoterTiersPage({ params }: { params: Params }) {
  const { slug, linkId } = use(params);
  const tiers = useCommissionTiers(linkId);
  const create = useCreateCommissionTier(linkId);
  const del = useDeleteCommissionTier(linkId);
  const assignments = useEventPromoters(slug);

  const promoter = useMemo(
    () =>
      (assignments.data ?? []).find((a) => a.promoterLinkId === linkId) ?? null,
    [assignments.data, linkId],
  );

  const items = tiers.data ?? [];
  const cashTiers = useMemo(
    () => items.filter((t) => t.rewardKind === "cash").sort((a, b) => a.thresholdCount - b.thresholdCount),
    [items],
  );
  const perkTiers = useMemo(
    () => items.filter((t) => t.rewardKind !== "cash").sort((a, b) => a.thresholdCount - b.thresholdCount),
    [items],
  );

  const [composer, setComposer] = useState<null | "cash" | "perk">(null);

  return (
    <EventShell slug={slug} active="panel">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-cart-ink-3">
              <Link
                href={`/org/events/${slug}/promoter-detail/${linkId}` as never}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-cart-ink-3 transition hover:bg-white/5 hover:text-white"
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M10 3L5 7l5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {promoter?.name ?? "Promotor"}
              </Link>
              <span className="text-cart-ink-4">›</span>
              <span>Comisiones</span>
            </div>
            <h1 className="mt-2 font-sans text-[26px] font-semibold tracking-[-0.025em] lg:text-[30px]">
              Hitos y premios
            </h1>
            <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-cart-ink-3">
              Negociá escalones individuales con {promoter?.name?.split(" ")[0] ?? "este promotor"}.
              Se desbloquean automáticamente cuando alcance las ventas pactadas.
            </p>
          </div>
        </header>

        {/* Hitos en efectivo — Square table pattern */}
        <CashSection
          tiers={cashTiers}
          onAdd={() => setComposer("cash")}
          onDelete={(id) => del.mutate(id)}
          deleting={del.isPending}
        />

        {/* Premios en especie — Upwork parallel cards */}
        <PerkSection
          tiers={perkTiers}
          onAdd={() => setComposer("perk")}
          onDelete={(id) => del.mutate(id)}
          deleting={del.isPending}
        />
      </div>

      {composer && (
        <ComposerSheet
          kind={composer}
          onClose={() => setComposer(null)}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
            setComposer(null);
          }}
          submitting={create.isPending}
          error={create.error ? (create.error as Error).message : null}
        />
      )}
    </EventShell>
  );
}

// ============================================================
// Hitos en efectivo — tabla Square-style
// ============================================================
function CashSection({
  tiers,
  onAdd,
  onDelete,
  deleting,
}: {
  tiers: CommissionTier[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const unlocked = tiers.filter((t) => t.unlockedAt).length;
  const totalCash = tiers.reduce((sum, t) => sum + (t.rewardAmountCents ?? 0), 0);
  const cumulativeCash = tiers
    .filter((t) => t.unlockedAt)
    .reduce((sum, t) => sum + (t.rewardAmountCents ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="flex flex-col gap-3 border-b border-cart-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-cart-accent-soft text-cart-accent">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M3 5h6M3 9h6M11 5h0.5M11 9h0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <h2 className="font-sans text-[16px] font-semibold tracking-[-0.01em]">
              Hitos en efectivo
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-cart-ink-3">
            Bonos en soles cuando alcanza ventas pactadas.{" "}
            <span className="text-cart-ink-2">
              {tiers.length} escalón{tiers.length === 1 ? "" : "es"}
            </span>
            {" · "}
            <span className="font-mono text-cart-ink-2">{formatSoles(cumulativeCash)}</span>{" "}
            de <span className="font-mono">{formatSoles(totalCash)}</span> desbloqueado
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-cart-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_-8px_var(--color-cart-accent-glow-strong)] transition hover:brightness-110"
        >
          + Agregar hito
        </button>
      </header>

      {tiers.length === 0 ? (
        <Empty
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4v16M6 8h8a2 2 0 010 4H8a2 2 0 000 4h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          }
          title="Sin hitos en efectivo"
          desc="Define escalones tipo: 50 ventas → S/ 100, 100 ventas → S/ 250."
        />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-[120px_1fr_140px_140px_44px] items-center gap-3 border-b border-cart-line bg-cart-bg/50 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
              <div>Al vender</div>
              <div>Recompensa</div>
              <div className="text-right">Bono</div>
              <div>Estado</div>
              <div />
            </div>
            <div className="divide-y divide-cart-line">
              {tiers.map((t) => (
                <CashRow key={t.id} tier={t} onDelete={onDelete} deleting={deleting} desktop />
              ))}
            </div>
          </div>
          {/* Mobile: list */}
          <div className="divide-y divide-cart-line lg:hidden">
            {tiers.map((t) => (
              <CashRow key={t.id} tier={t} onDelete={onDelete} deleting={deleting} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CashRow({
  tier,
  onDelete,
  deleting,
  desktop,
}: {
  tier: CommissionTier;
  onDelete: (id: string) => void;
  deleting: boolean;
  desktop?: boolean;
}) {
  const unlocked = !!tier.unlockedAt;
  if (desktop) {
    return (
      <div className="grid grid-cols-[120px_1fr_140px_140px_44px] items-center gap-3 px-5 py-3 transition hover:bg-white/[0.02]">
        <div className="font-mono text-[14.5px] font-semibold">
          {tier.thresholdCount}
          <span className="ml-1 text-[10.5px] font-medium text-cart-ink-4">tickets</span>
        </div>
        <div className="text-[13.5px] text-cart-ink-2">{tier.rewardLabel}</div>
        <div className="text-right font-mono text-[14.5px] font-semibold text-white">
          {formatSoles(tier.rewardAmountCents)}
        </div>
        <div>
          <StatusPill unlocked={unlocked} />
        </div>
        <div className="text-right">
          <DeleteBtn onClick={() => onDelete(tier.id)} disabled={deleting} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-cart-bg-elev-2 font-mono text-[15px] font-semibold">
        {tier.thresholdCount}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[15px] font-semibold">
          {formatSoles(tier.rewardAmountCents)}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{tier.rewardLabel}</div>
      </div>
      <StatusPill unlocked={unlocked} />
      <DeleteBtn onClick={() => onDelete(tier.id)} disabled={deleting} />
    </div>
  );
}

// ============================================================
// Premios en especie — Upwork-style parallel cards
// ============================================================
function PerkSection({
  tiers,
  onAdd,
  onDelete,
  deleting,
}: {
  tiers: CommissionTier[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="flex flex-col gap-3 border-b border-cart-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#22D17F]/15 text-[#22D17F]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M5 2h4M6 2v2M6 4c-2 0-3 1-3 3v4a1 1 0 001 1h4a1 1 0 001-1V7c0-2-1-3-3-3z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="font-sans text-[16px] font-semibold tracking-[-0.01em]">
              Premios en especie
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-cart-ink-3">
            Botella en local, mesa VIP, premios físicos. Por cantidad vendida.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-cart-line bg-cart-bg-elev-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:border-white/30"
        >
          + Agregar premio
        </button>
      </header>

      {tiers.length === 0 ? (
        <Empty
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 3h6M10 3v3M10 6c-3 0-4 2-4 5v8a2 2 0 002 2h8a2 2 0 002-2v-8c0-3-1-5-4-5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          title="Sin premios en especie"
          desc='Por ejemplo: 30 ventas → botella en local, 60 ventas → mesa VIP.'
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
          {tiers.map((t) => (
            <PerkCard key={t.id} tier={t} onDelete={onDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </section>
  );
}

function PerkCard({
  tier,
  onDelete,
  deleting,
}: {
  tier: CommissionTier;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const unlocked = !!tier.unlockedAt;
  const isBottle = tier.rewardKind === "bottle";
  const accent = isBottle ? "#22D17F" : "#FFCE3B";
  const tint = isBottle ? "rgba(34,209,127,0.10)" : "rgba(255,206,59,0.10)";

  return (
    <div
      className={
        "group relative flex flex-col gap-3 rounded-2xl border p-4 transition " +
        (unlocked
          ? "border-cart-line-strong"
          : "border-cart-line hover:border-cart-line-strong")
      }
      style={
        unlocked
          ? { background: tint, boxShadow: `inset 0 0 0 1px ${accent}55` }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ background: tint, color: accent }}
        >
          {isBottle ? "Botella" : "Premio"}
        </span>
        <DeleteBtn onClick={() => onDelete(tier.id)} disabled={deleting} subtle />
      </div>

      <div>
        <div className="font-sans text-[18px] font-semibold leading-tight tracking-[-0.01em]">
          {tier.rewardLabel}
        </div>
        <div className="mt-1 text-[12px] text-cart-ink-3">
          Al alcanzar{" "}
          <span className="font-mono font-semibold text-white">{tier.thresholdCount}</span>{" "}
          {tier.thresholdCount === 1 ? "venta" : "ventas"}
        </div>
      </div>

      <div className="mt-auto pt-1">
        <StatusPill unlocked={unlocked} />
      </div>
    </div>
  );
}

// ============================================================
// Composer sheet
// ============================================================
function ComposerSheet({
  kind,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  kind: "cash" | "perk";
  onClose: () => void;
  onSubmit: (input: CreateTierInput) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [threshold, setThreshold] = useState(50);
  const [amountSoles, setAmountSoles] = useState(100);
  const [perkKind, setPerkKind] = useState<"bottle" | "custom">("bottle");
  const [perkLabel, setPerkLabel] = useState("");

  const submit = async () => {
    if (kind === "cash") {
      await onSubmit({
        thresholdCount: Math.max(1, threshold),
        rewardKind: "cash",
        rewardAmountCents: Math.max(0, Money.toCents(amountSoles)),
        rewardLabel: `S/ ${amountSoles.toLocaleString("es-PE")}`,
      });
    } else {
      const label =
        perkLabel.trim() ||
        (perkKind === "bottle" ? "Botella en local" : "Premio");
      await onSubmit({
        thresholdCount: Math.max(1, threshold),
        rewardKind: perkKind,
        rewardAmountCents: null,
        rewardLabel: label,
      });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={kind === "cash" ? "Nuevo hito en efectivo" : "Nuevo premio en especie"}
        className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex w-full max-w-[520px] flex-col gap-4 rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev p-5 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)] lg:inset-y-0 lg:right-0 lg:left-auto lg:mx-0 lg:h-dvh lg:max-w-[460px] lg:rounded-none lg:rounded-l-3xl lg:border-l"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Nuevo
            </div>
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">
              {kind === "cash" ? "Hito en efectivo" : "Premio en especie"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-cart-ink-3 transition hover:border-cart-line-strong hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <NumField
          label="Al alcanzar (ventas)"
          value={threshold}
          onChange={setThreshold}
          suffix="tickets"
        />

        {kind === "cash" ? (
          <NumField
            label="Bono"
            value={amountSoles}
            onChange={setAmountSoles}
            prefix="S/"
          />
        ) : (
          <>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                Tipo
              </div>
              <div className="grid grid-cols-2 gap-2">
                <KindChip
                  active={perkKind === "bottle"}
                  onClick={() => setPerkKind("bottle")}
                  label="Botella en local"
                  accent="#22D17F"
                />
                <KindChip
                  active={perkKind === "custom"}
                  onClick={() => setPerkKind("custom")}
                  label="Otro premio"
                  accent="#FFCE3B"
                />
              </div>
            </div>
            <TextField
              label="Descripción"
              value={perkLabel}
              onChange={setPerkLabel}
              placeholder={
                perkKind === "bottle" ? "Botella de ron premium" : "Mesa VIP + tragos"
              }
            />
          </>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-1 flex h-12 items-center justify-center rounded-full bg-cart-accent text-[14.5px] font-semibold text-white shadow-[0_12px_28px_-10px_var(--color-cart-accent-glow-strong)] transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Guardando…" : "Agregar"}
        </button>
      </div>
    </>
  );
}

// ============================================================
// Pieces
// ============================================================
function StatusPill({ unlocked }: { unlocked: boolean }) {
  if (unlocked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22D17F]/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#22D17F]">
        <span className="size-1.5 rounded-full bg-[#22D17F] shadow-[0_0_6px_rgba(34,209,127,0.7)]" />
        Desbloqueado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">
      <span className="size-1.5 rounded-full bg-cart-ink-4" />
      Pendiente
    </span>
  );
}

function DeleteBtn({
  onClick,
  disabled,
  subtle,
}: {
  onClick: () => void;
  disabled: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Eliminar"
      className={
        "grid size-8 place-items-center rounded-full text-cart-ink-3 transition disabled:opacity-50 " +
        (subtle ? "hover:bg-white/5 hover:text-red-300" : "hover:bg-white/5 hover:text-red-300")
      }
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Empty({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-xl bg-cart-bg-elev-2 text-cart-ink-3">
        {icon}
      </span>
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="max-w-[360px] text-[12.5px] leading-relaxed text-cart-ink-3">{desc}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 focus-within:border-cart-line-strong">
        {prefix && <span className="font-mono text-[13px] text-cart-ink-3">{prefix}</span>}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full bg-transparent font-mono text-[18px] font-semibold text-white outline-none"
        />
        {suffix && <span className="text-[12px] text-cart-ink-4">{suffix}</span>}
      </div>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 text-[14px] outline-none placeholder:text-cart-ink-4 focus:border-cart-line-strong"
      />
    </label>
  );
}

function KindChip({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition " +
        (active
          ? "border-transparent text-black"
          : "border-cart-line bg-cart-bg-elev-2 text-cart-ink-2 hover:text-white")
      }
      style={active ? { background: accent } : undefined}
    >
      {label}
    </button>
  );
}
