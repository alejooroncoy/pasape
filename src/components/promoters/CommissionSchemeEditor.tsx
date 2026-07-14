"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";
import { MilestonesEditor } from "./MilestonesEditor";

/**
 * Editor unificado del esquema de comisión de un promotor. Dos ejes
 * INDEPENDIENTES que coexisten, cada uno en su sección colapsable:
 *   1) Comisión por venta — % sobre lo vendido (0 = sin comisión).
 *   2) Metas — hitos en efectivo y/o premios en especie por umbral.
 *
 * Es el MISMO componente en los tres lugares con herencia (esquema del evento,
 * default de la marca, personalización de un promotor). `variant="drawer"` es
 * para cuando el editor ya vive dentro de un drawer: apila las secciones y
 * agrega hitos/premios con un form inline (no abre otro drawer encima).
 */
export function CommissionSchemeEditor({
  pct,
  config,
  onPctChange,
  onConfigChange,
  variant = "page",
  saving = false,
  autoSave = true,
  presets = [10, 15, 20],
  inheritedPct,
  inheritLabel,
}: {
  /** % PROPIO de este nivel. null = hereda (si `inheritedPct` está definido) o
   *  sin comisión (si no hay de dónde heredar, ej. la marca). */
  pct: number | null;
  config: CommissionConfig | null | undefined;
  onPctChange: (v: number | null) => void;
  /** Recibe el config ya normalizado: null cuando no quedan metas. */
  onConfigChange: (cfg: CommissionConfig) => void;
  variant?: "page" | "drawer";
  saving?: boolean;
  /** true = guarda al vuelo (muestra "Se guarda solo"). false = form con botón
   *  de submit (marca): no mostramos el aviso de autoguardado. */
  autoSave?: boolean;
  presets?: number[];
  /** Si este nivel puede HEREDAR, el % que aplicaría cuando el propio es null.
   *  Definirlo activa el chip "Hereda" y el resumen "Hereda X%". */
  inheritedPct?: number | null;
  /** De dónde hereda, para el copy (ej. "de la marca", "del evento"). */
  inheritLabel?: string;
}) {
  const inDrawer = variant === "drawer";
  const canInherit = inheritedPct !== undefined;
  const milestones = config?.milestones ?? [];
  const cashCount = milestones.filter((m) => m.rewardKind === "cash").length;
  const perkCount = milestones.length - cashCount;
  const metasSummary =
    milestones.length === 0
      ? "Sin metas"
      : [
          cashCount ? `${cashCount} hito${cashCount === 1 ? "" : "s"}` : null,
          perkCount ? `${perkCount} premio${perkCount === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex flex-col gap-3">
      {autoSave && (
        <div className="flex justify-end">
          <SchemeAutoSave saving={saving} />
        </div>
      )}

      <SchemeSection
        title="Comisión por venta"
        summary={
          pct != null ? (
            `${pct}%`
          ) : canInherit ? (
            <span>
              {inheritedPct ?? 0}%{" "}
              <span className="text-cart-ink-4">· igual que {inheritLabel}</span>
            </span>
          ) : (
            "Sin comisión"
          )
        }
        defaultOpen={pct != null}
      >
        <PctField
          value={pct}
          onChange={onPctChange}
          presets={presets}
          canInherit={canInherit}
          inheritedPct={inheritedPct ?? null}
          inheritLabel={inheritLabel}
        />
        <p className="mt-2.5 text-[12px] leading-relaxed text-cart-ink-3">
          {canInherit ? (
            <>
              Sin tocar nada, va{" "}
              <b className="text-cart-ink-2">{inheritedPct ?? 0}% igual que {inheritLabel}</b>. Pon
              otro número solo si aquí cambia.
            </>
          ) : (
            <>
              Déjalo en <span className="font-mono text-cart-ink-2">0</span> si no paga % por venta.
              Puedes premiar solo con metas, o con nada.
            </>
          )}
        </p>
      </SchemeSection>

      <SchemeSection
        title="Metas"
        summary={metasSummary}
        defaultOpen={milestones.length > 0}
        bodyClassName={inDrawer ? "" : "bg-cart-bg"}
      >
        <MilestonesEditor
          split={!inDrawer}
          addMode={inDrawer ? "inline" : "sheet"}
          config={config ?? undefined}
          onSave={(cfg) => onConfigChange(cfg.milestones.length > 0 ? cfg : null)}
        />
      </SchemeSection>
    </div>
  );
}

// Sección colapsable con header en negrita (resalta) + resumen a la derecha.
function SchemeSection({
  title,
  summary,
  defaultOpen = false,
  bodyClassName,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // El valor puede llegar async (scheme cacheado): si aún no lo tocó el usuario,
  // refleja el defaultOpen cuando llegue. Tras el primer toggle, respeta su elección.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev">
      <button
        type="button"
        onClick={() => {
          touched.current = true;
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-cart-line-2 lg:px-5"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={"shrink-0 text-cart-ink-3 transition-transform " + (open ? "rotate-90" : "")}
        >
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[15.5px] font-semibold tracking-[-0.01em] text-cart-ink">{title}</span>
        {summary != null && (
          <span className="ml-auto text-[12.5px] font-medium text-cart-ink-3">{summary}</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={"border-t border-cart-line px-4 py-4 lg:px-5 " + (bodyClassName ?? "")}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// % por venta: chip "Hereda" (si aplica) + atajos (10/15/20) + input libre.
// null = hereda (o sin comisión si no hay de dónde); 0 = sin comisión explícita.
function PctField({
  value,
  onChange,
  presets,
  canInherit = false,
  inheritedPct = null,
  inheritLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  presets: number[];
  canInherit?: boolean;
  inheritedPct?: number | null;
  inheritLabel?: string;
}) {
  const [local, setLocal] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setLocal(value == null ? "" : String(value));
  }, [value]);
  const commit = (n: number) => {
    if (!isNaN(n) && n >= 0 && n <= 100) onChange(n);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canInherit && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={
            "rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition " +
            (value == null
              ? "bg-cart-accent text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)]"
              : "bg-cart-bg-elev-2 text-cart-ink-2 hover:text-cart-ink")
          }
        >
          Igual que {inheritLabel ?? "el default"}
        </button>
      )}
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => {
            setLocal(String(p));
            commit(p);
          }}
          className={
            "rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition " +
            (value === p
              ? "bg-cart-accent text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)]"
              : "bg-cart-bg-elev-2 text-cart-ink-2 hover:text-cart-ink")
          }
        >
          {p}%
        </button>
      ))}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          value={local}
          placeholder={canInherit ? "—" : ""}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            // Vacío + puede heredar → vuelve a heredar (null); sino, comitea el número.
            if (local.trim() === "" && canInherit) onChange(null);
            else commit(parseInt(local, 10));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(parseInt(local, 10));
          }}
          className="w-16 rounded-xl bg-cart-bg-elev-2 px-2.5 py-2 text-center font-mono text-[14px] font-semibold outline-none ring-1 ring-cart-line-strong focus:ring-cart-accent"
        />
        <span className="text-[13px] text-cart-ink-3">% por venta</span>
      </div>
    </div>
  );
}

// Aviso de autoguardado inline: "Se guarda solo" → "Guardando…" → "✓ Guardado".
function SchemeAutoSave({ saving }: { saving: boolean }) {
  const [justSaved, setJustSaved] = useState(false);
  const prev = useRef(saving);
  useEffect(() => {
    if (prev.current && !saving) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1800);
      prev.current = saving;
      return () => clearTimeout(t);
    }
    prev.current = saving;
  }, [saving]);
  return (
    <span className="text-[11px] font-medium">
      {saving ? (
        <span className="text-cart-ink-3">Guardando…</span>
      ) : justSaved ? (
        <span className="text-emerald-300">✓ Guardado</span>
      ) : (
        <span className="text-cart-ink-4">Se guarda solo</span>
      )}
    </span>
  );
}
