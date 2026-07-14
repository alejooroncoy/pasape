"use client";

import { useState } from "react";
import { Money } from "@/lib/_shared/money";
import type {
  CommissionConfig,
  CommissionMilestone,
  MilestoneBasis,
} from "@/server/promoters/domain/OrgPromoter";

// Un hito con su índice en el array completo (para editar/borrar la fila exacta).
type IndexedMilestone = { m: CommissionMilestone; i: number };

const formatSoles = (cents: number | null): string => {
  if (cents == null) return "—";
  const n = Money.toSoles(cents);
  return `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
};

/**
 * Editor de metas (hitos en efectivo + premios en especie) estilo Square/Upwork.
 * Es el eje de METAS, independiente del %. Un solo lugar, compartido por el
 * esquema del evento, la personalización por-link, la marca y la página /tiers.
 * Mantiene su copia de trabajo en estado local (sembrada del `config`) y avisa
 * cada cambio con `onSave({ basis, milestones })`. `basis` decide si los hitos
 * cuentan por VENTAS o por ASISTENCIA (gente que entró).
 */
export function MilestonesEditor({
  config,
  onSave,
  saving = false,
  split = false,
  addMode = "sheet",
}: {
  config: CommissionConfig | undefined;
  onSave: (config: { basis: MilestoneBasis; milestones: CommissionMilestone[] }) => void;
  saving?: boolean;
  /** En contenedores anchos (esquema del evento, /tiers) muestra Hitos | Premios
   *  lado a lado en desktop. En sheets angostos déjalo en false (apilado). */
  split?: boolean;
  /** Cómo se agrega un hito/premio. "sheet" = drawer (default, páginas anchas).
   *  "inline" = form desplegado dentro de la sección, para cuando el editor YA
   *  vive dentro de un drawer (personalizar 1 promotor) y no queremos anidar. */
  addMode?: "sheet" | "inline";
}) {
  const initial = config && "milestones" in config ? config.milestones : [];
  const [milestones, setMilestones] = useState<CommissionMilestone[]>(initial);
  const [basis, setBasis] = useState<MilestoneBasis>(
    config && "basis" in config ? config.basis : "sold",
  );
  const [composer, setComposer] = useState<null | "cash" | "perk">(null);

  const commit = (nextMilestones: CommissionMilestone[], nextBasis: MilestoneBasis = basis) => {
    setMilestones(nextMilestones);
    setBasis(nextBasis);
    onSave({ basis: nextBasis, milestones: nextMilestones });
  };
  const cashTiers = milestones
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.rewardKind === "cash")
    .sort((a, b) => a.m.threshold - b.m.threshold);
  const perkTiers = milestones
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.rewardKind !== "cash")
    .sort((a, b) => a.m.threshold - b.m.threshold);

  const addMilestone = (m: CommissionMilestone) => {
    commit([...milestones, m]);
    setComposer(null);
  };
  // El form inline (drawer) sale JUSTO debajo de la sección que se tocó: si
  // clickeó "+ Agregar hito" aparece bajo Hitos; si "+ Agregar premio", bajo
  // Premios. (Sólo en addMode "inline", que siempre va apilado — no rompe el grid.)
  const inlineFor = (kind: "cash" | "perk") =>
    addMode === "inline" && composer === kind ? (
      <InlineComposer
        kind={kind}
        onCancel={() => setComposer(null)}
        onSubmit={addMilestone}
        submitting={saving}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <BasisToggle basis={basis} onChange={(b) => commit(milestones, b)} />
      <div
        className={
          "grid gap-4 " + (split ? "grid-cols-1 lg:grid-cols-2 lg:items-start" : "grid-cols-1")
        }
      >
        <CashSection
          tiers={cashTiers}
          basis={basis}
          onAdd={() => setComposer("cash")}
          onDelete={(index) => commit(milestones.filter((_, i) => i !== index))}
          deleting={saving}
        />
        {inlineFor("cash")}
        <PerkSection
          tiers={perkTiers}
          basis={basis}
          onAdd={() => setComposer("perk")}
          onDelete={(index) => commit(milestones.filter((_, i) => i !== index))}
          deleting={saving}
        />
        {inlineFor("perk")}
      </div>
      {composer && addMode === "sheet" && (
        <ComposerSheet
          kind={composer}
          onClose={() => setComposer(null)}
          onSubmit={addMilestone}
          submitting={saving}
        />
      )}
    </div>
  );
}

// Form inline para agregar hito/premio SIN abrir otro drawer (cuando el editor
// ya vive dentro de un drawer). Mismos campos que el ComposerSheet.
function InlineComposer({
  kind,
  onSubmit,
  onCancel,
  submitting,
}: {
  kind: "cash" | "perk";
  onSubmit: (milestone: CommissionMilestone) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [threshold, setThreshold] = useState(50);
  const [amountSoles, setAmountSoles] = useState(100);
  const [perkLabel, setPerkLabel] = useState("");

  const submit = () => {
    if (kind === "cash") {
      onSubmit({
        threshold: Math.max(1, threshold),
        rewardKind: "cash",
        amountCents: Math.max(0, Money.toCents(amountSoles)),
        label: "",
      });
    } else {
      onSubmit({
        threshold: Math.max(1, threshold),
        rewardKind: "perk",
        amountCents: null,
        label: perkLabel.trim() || "Premio",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-cart-line-strong bg-cart-bg-elev-2 p-4">
      <div className="mb-3 text-[13px] font-semibold text-cart-ink">
        {kind === "cash" ? "Nuevo hito en efectivo" : "Nuevo premio en especie"}
      </div>
      <div className="flex flex-col gap-3">
        <NumField label="Al alcanzar" value={threshold} onChange={setThreshold} suffix="ventas/asistencias" />
        {kind === "cash" ? (
          <NumField label="Bono en soles" value={amountSoles} onChange={setAmountSoles} prefix="S/" />
        ) : (
          <TextField
            label="¿Qué premio se lleva?"
            value={perkLabel}
            onChange={setPerkLabel}
            placeholder="Botella de ron premium, mesa VIP…"
          />
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-cart-bg-elev px-4 text-[13.5px] font-semibold text-cart-ink-2 ring-1 ring-cart-line-strong transition hover:text-cart-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex h-11 flex-[1.4] items-center justify-center rounded-full bg-cart-accent px-4 text-[13.5px] font-semibold text-white shadow-[0_10px_24px_-10px_var(--color-cart-accent-glow-strong)] transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Guardando…" : "Agregar"}
        </button>
      </div>
    </div>
  );
}

// Contar por: ventas o asistencia (gente que entró). Anti-fraude: "asistencia"
// no cuenta invitados que no aparecen.
function BasisToggle({ basis, onChange }: { basis: MilestoneBasis; onChange: (b: MilestoneBasis) => void }) {
  const opts: [MilestoneBasis, string][] = [
    ["sold", "Ventas"],
    ["attended", "Asistencia"],
  ];
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        Contar por
      </span>
      <div className="inline-flex gap-1 rounded-xl bg-cart-bg-elev-2 p-1">
        {opts.map(([v, lbl]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={
              "rounded-lg px-3 py-1 text-[12.5px] font-semibold transition " +
              (basis === v ? "bg-cart-accent text-white" : "text-cart-ink-3 hover:text-cart-ink")
            }
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

const basisNoun = (basis: MilestoneBasis) => (basis === "attended" ? "asistencias" : "ventas");

// ============================================================
// Hitos en efectivo — tabla Square-style
// ============================================================
function CashSection({
  tiers,
  basis,
  onAdd,
  onDelete,
  deleting,
}: {
  tiers: IndexedMilestone[];
  basis: MilestoneBasis;
  onAdd: () => void;
  onDelete: (index: number) => void;
  deleting: boolean;
}) {
  const totalCash = tiers.reduce((sum, t) => sum + (t.m.amountCents ?? 0), 0);

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
            Bonos en soles al alcanzar {basisNoun(basis)}.{" "}
            <span className="text-cart-ink-2">
              {tiers.length} escalón{tiers.length === 1 ? "" : "es"}
            </span>
            {" · "}
            <span className="font-mono text-cart-ink-2">{formatSoles(totalCash)}</span> en bonos
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
              <path d="M12 4v16M6 8h8a2 2 0 010 4H8a2 2 0 000 4h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
          title="Sin hitos en efectivo"
          desc={`Define escalones tipo: 50 ${basisNoun(basis)} → S/ 100, 100 → S/ 250.`}
        />
      ) : (
        <TierTable tiers={tiers} basis={basis} kind="cash" onDelete={onDelete} deleting={deleting} />
      )}
    </section>
  );
}

// Tabla compacta compartida por Hitos (cash) y Premios (perk). Columnas
// proporcionales (auto | 1fr | auto) para que se adapte a la columna angosta
// del split sin partir el texto ni scroll horizontal. La recompensa trunca.
// Rejilla compartida por header y filas: anchos FIJOS (no `auto`) para que las
// columnas del header y del contenido caigan exactamente en el mismo sitio.
// col1 umbral · col2 recompensa (flex, trunca) · col3 valor · col4 borrar.
const TIER_GRID = "grid grid-cols-[80px_minmax(0,1fr)_96px_32px] items-center gap-x-2";

function TierTable({
  tiers,
  basis,
  kind,
  onDelete,
  deleting,
}: {
  tiers: IndexedMilestone[];
  basis: MilestoneBasis;
  kind: "cash" | "perk";
  onDelete: (index: number) => void;
  deleting: boolean;
}) {
  return (
    <div>
      <div
        className={
          TIER_GRID +
          " border-b border-cart-line bg-cart-bg/40 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4 lg:px-5"
        }
      >
        <div>Al llegar</div>
        <div>Recompensa</div>
        <div className="text-right">{kind === "cash" ? "Bono" : "Tipo"}</div>
        <div />
      </div>
      <div className="divide-y divide-cart-line">
        {tiers.map((t) => (
          <TierRow key={t.i} tier={t} basis={basis} kind={kind} onDelete={onDelete} deleting={deleting} />
        ))}
      </div>
    </div>
  );
}

function TierRow({
  tier,
  basis,
  kind,
  onDelete,
  deleting,
}: {
  tier: IndexedMilestone;
  basis: MilestoneBasis;
  kind: "cash" | "perk";
  onDelete: (index: number) => void;
  deleting: boolean;
}) {
  const { m, i } = tier;
  const isCash = kind === "cash";
  return (
    <div className={TIER_GRID + " px-4 py-3 transition hover:bg-cart-line-2 lg:px-5"}>
      <div className="whitespace-nowrap font-mono text-[14px] font-semibold">
        {m.threshold}
        <span className="ml-1 text-[10px] font-medium text-cart-ink-4">{basisNoun(basis)}</span>
      </div>
      <div className="min-w-0 truncate text-[13.5px] text-cart-ink-2">
        {m.label || (isCash ? "Bono en efectivo" : "Premio")}
      </div>
      <div className="text-right">
        {isCash ? (
          <span className="whitespace-nowrap font-mono text-[14px] font-semibold text-cart-ink">
            {formatSoles(m.amountCents)}
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-[#22D17F]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#22D17F]">
            Premio
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <DeleteBtn onClick={() => onDelete(i)} disabled={deleting} />
      </div>
    </div>
  );
}

// ============================================================
// Premios en especie — Upwork-style parallel cards
// ============================================================
function PerkSection({
  tiers,
  basis,
  onAdd,
  onDelete,
  deleting,
}: {
  tiers: IndexedMilestone[];
  basis: MilestoneBasis;
  onAdd: () => void;
  onDelete: (index: number) => void;
  deleting: boolean;
}) {
  return (
    <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="flex flex-col gap-3 border-b border-cart-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#22D17F]/15 text-[#22D17F]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2h4M6 2v2M6 4c-2 0-3 1-3 3v4a1 1 0 001 1h4a1 1 0 001-1V7c0-2-1-3-3-3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="font-sans text-[16px] font-semibold tracking-[-0.01em]">
              Premios en especie
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-cart-ink-3">
            Botella en local, mesa VIP, premios físicos. Por {basisNoun(basis)}.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-cart-line bg-cart-bg-elev-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-cart-ink transition hover:border-cart-line-strong"
        >
          + Agregar premio
        </button>
      </header>

      {tiers.length === 0 ? (
        <Empty
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 3h6M10 3v3M10 6c-3 0-4 2-4 5v8a2 2 0 002 2h8a2 2 0 002-2v-8c0-3-1-5-4-5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Sin premios en especie"
          desc={`Por ejemplo: 30 ${basisNoun(basis)} → botella en local, 60 → mesa VIP.`}
        />
      ) : (
        <TierTable tiers={tiers} basis={basis} kind="perk" onDelete={onDelete} deleting={deleting} />
      )}
    </section>
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
}: {
  kind: "cash" | "perk";
  onClose: () => void;
  onSubmit: (milestone: CommissionMilestone) => void;
  submitting: boolean;
}) {
  const [threshold, setThreshold] = useState(50);
  const [amountSoles, setAmountSoles] = useState(100);
  const [perkLabel, setPerkLabel] = useState("");

  const submit = () => {
    if (kind === "cash") {
      onSubmit({
        threshold: Math.max(1, threshold),
        rewardKind: "cash",
        amountCents: Math.max(0, Money.toCents(amountSoles)),
        label: "",
      });
    } else {
      onSubmit({
        threshold: Math.max(1, threshold),
        rewardKind: "perk",
        amountCents: null,
        label: perkLabel.trim() || "Premio",
      });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] app-scrim" onClick={onClose} aria-hidden />
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
            className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-cart-ink-3 transition hover:border-cart-line-strong hover:text-cart-ink"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <NumField label="Al alcanzar" value={threshold} onChange={setThreshold} suffix="unidades" />

        {kind === "cash" ? (
          <NumField label="Bono" value={amountSoles} onChange={setAmountSoles} prefix="S/" />
        ) : (
          <TextField
            label="Descripción del premio"
            value={perkLabel}
            onChange={setPerkLabel}
            placeholder="Botella de ron premium, mesa VIP…"
          />
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
// El desbloqueo ya no se persiste (se deriva del conteo en el panel del
// promotor). Aquí el organizador solo CONFIGURA la negociación.
function DeleteBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Eliminar"
      className="grid size-8 place-items-center rounded-full text-cart-ink-3 transition hover:bg-cart-line-2 hover:text-red-600 disabled:opacity-50"
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Empty({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-xl bg-cart-bg-elev-2 text-cart-ink-3">{icon}</span>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 focus-within:border-cart-line-strong">
        {prefix && <span className="font-mono text-[13px] text-cart-ink-3">{prefix}</span>}
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full bg-transparent font-mono text-[18px] font-semibold text-cart-ink outline-none"
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">{label}</span>
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
