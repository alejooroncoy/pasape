"use client";

import { use, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useUpdateEvent } from "@/lib/events/hooks/useUpdateEvent";
import { EventShell } from "../_shell/EventShell";
import { DoorsSection } from "./DoorsSection";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgEventConfigPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const update = useUpdateEvent(slug);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const ev = event.data?.event;

  return (
    <EventShell slug={slug} active="settings">
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="font-sans text-[22px] font-semibold tracking-[-0.02em]">Ajustes</h1>
          <p className="mt-1 text-[13px] text-cart-ink-3">
            Cómo funciona el evento. Para editar nombre, fecha, lugar, portada o tipos de entrada usa{" "}
            <span className="font-medium text-white">Editar evento</span>.
          </p>
        </header>

        {/* Transferencias */}
        <Section title="Transferencias" hint="Si los compradores pueden pasar entradas">
          <ToggleRow
            label="Permitir transferir"
            description="El comprador puede mandar su entrada a alguien"
            on={!!ev?.transferPolicy.enabled}
            onChange={(v) => update.mutate({ transfersEnabled: v })}
            disabled={update.isPending}
          />
          {ev?.transferPolicy.enabled && (
            <>
              <EditNumberRow
                label="Se puede transferir hasta"
                value={ev.transferPolicy.deadlineHours}
                suffix="h antes"
                unit="h antes"
                min={1}
                allowNull
                onSave={(v) => update.mutate({ transferDeadlineHours: v })}
                saving={update.isPending && "transferDeadlineHours" in (update.variables ?? {})}
              />
              <EditNumberRow
                label="Máximo por entrada"
                value={ev.transferPolicy.maxCount}
                min={1}
                onSave={(v) => update.mutate({ transferMaxCount: v ?? 1 })}
                saving={update.isPending && "transferMaxCount" in (update.variables ?? {})}
                last
              />
            </>
          )}
        </Section>

        {/* Puertas */}
        <DoorsSection slug={slug} />

        {/* Cerrar evento */}
        {ev?.status !== "cancelled" && (
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <div className="text-[14.5px] font-semibold">Cerrar evento</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-cart-ink-3">
                  El evento ya ocurrió. Marca como cerrado para archivar estadísticas y
                  detener las ventas. Los compradores conservan sus entradas.
                </div>
              </div>
              {ev?.status === "closed" ? (
                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[12px] font-semibold text-cart-ink-2">
                    <span className="size-1.5 rounded-full bg-cart-ink-2" />
                    Cerrado
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("¿Reabrir el evento? Volverá a estar publicado y se reanudarán las ventas."))
                        update.mutate({ status: "published" });
                    }}
                    className="rounded-full border border-cart-line bg-cart-bg-elev-2 px-4 py-2 text-[12.5px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
                  >
                    Reabrir evento
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClose(true)}
                  className="self-start rounded-full border border-cart-line bg-cart-bg-elev-2 px-4 py-2 text-[12.5px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white lg:self-auto"
                >
                  Cerrar evento
                </button>
              )}
            </div>
          </div>
        )}

        {/* Zona peligrosa */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[14.5px] font-semibold text-red-300">Cancelar evento</div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-cart-ink-3">
                El evento no va a ocurrir. Notificamos a los compradores e iniciamos reembolsos.
                Esta acción no se puede deshacer.
              </div>
            </div>
            {ev?.status === "cancelled" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-semibold text-red-300">
                <span className="size-1.5 rounded-full bg-red-400" />
                Cancelado
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="self-start rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-[12.5px] font-semibold text-red-300 transition hover:bg-red-500/20 lg:self-auto"
              >
                Cancelar evento
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmClose && (
          <ConfirmCloseSheet
            onCancel={() => setConfirmClose(false)}
            onConfirm={() => {
              update.mutate({ status: "closed" });
              setConfirmClose(false);
            }}
          />
        )}
        {confirmCancel && (
          <ConfirmSheet
            onCancel={() => setConfirmCancel(false)}
            onConfirm={() => {
              update.mutate({ status: "cancelled" });
              setConfirmCancel(false);
            }}
          />
        )}
      </AnimatePresence>
    </EventShell>
  );
}

// ============================================================
// Section + rows
// ============================================================
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="border-b border-cart-line px-4 py-3 lg:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {hint && <p className="text-[11.5px] text-cart-ink-3">{hint}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}

// Detecta desktop para elegir popover (≥lg) vs drawer (móvil).
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

// Fila editable: clic en el valor → popover en desktop, drawer en móvil.
// El editor comparte cuerpo entre ambos; guarda con "Listo"/Enter o "Sin límite".
function EditNumberRow({
  label,
  value,
  suffix,
  unit,
  min,
  allowNull,
  nullLabel = "Sin límite",
  onSave,
  saving,
  last,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  unit?: string;
  min: number;
  allowNull?: boolean;
  nullLabel?: string;
  onSave: (v: number | null) => void;
  saving?: boolean;
  last?: boolean;
}) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState("");
  const close = () => setOpen(false);
  const openEditor = () => {
    setLocal(value != null ? String(value) : "");
    setOpen(true);
  };
  const commit = () => {
    const n = parseInt(local, 10);
    if (!(local.trim() === "" || isNaN(n) || n < min)) onSave(n);
    close();
  };
  const display = value == null ? nullLabel : `${value}${suffix ?? ""}`;

  const body = (
    <div className="flex flex-col gap-3">
      <div className="text-[13.5px] font-semibold">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          value={local}
          autoFocus
          placeholder={allowNull ? "sin límite" : undefined}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") close();
          }}
          className="w-24 rounded-lg bg-cart-bg-elev-2 px-2.5 py-2 text-center font-mono text-[15px] font-semibold outline-none ring-1 ring-cart-line-strong focus:ring-cart-accent"
        />
        {unit && <span className="text-[13px] text-cart-ink-3">{unit}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={commit}
          className="rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-white"
        >
          Listo
        </button>
        {allowNull && (
          <button
            type="button"
            onClick={() => {
              onSave(null);
              close();
            }}
            className="rounded-full bg-cart-bg-elev-2 px-3 py-2 text-[12.5px] font-semibold text-cart-ink-2 ring-1 ring-cart-line-strong transition hover:text-white"
          >
            Sin límite
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        "flex items-center justify-between gap-3 px-4 py-3 lg:px-5 " +
        (last ? "" : "border-b border-cart-line")
      }
    >
      <span className="text-[13px] text-cart-ink-3">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={openEditor}
          disabled={saving}
          className="inline-flex items-center gap-1.5 font-mono text-[13.5px] font-medium text-white transition hover:text-cart-accent disabled:opacity-70"
        >
          {display}
          {saving ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="animate-spin text-cart-accent" aria-hidden>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.25" />
              <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-cart-ink-4" aria-hidden>
              <path d="M9 2.5l2.5 2.5-6 6H3v-2.5l6-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <AnimatePresence>
          {open && isDesktop && (
            <div key="pop">
              <div className="fixed inset-0 z-[70]" onClick={close} aria-hidden />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 z-[71] mt-2 w-60 origin-top-right rounded-2xl border border-cart-line bg-cart-bg-elev p-4 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]"
              >
                {body}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && !isDesktop && (
          <div key="drawer">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              aria-hidden
              className="fixed inset-0 z-[80] app-scrim"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 360 }}
              className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-[480px] rounded-t-[28px] border-t border-cart-line bg-cart-bg-elev p-5 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
              {body}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  on,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const [localOn, setLocalOn] = useState(on);
  useEffect(() => setLocalOn(on), [on]);

  const handle = () => {
    if (disabled) return;
    const next = !localOn;
    setLocalOn(next);
    onChange(next);
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-cart-line px-4 py-3 lg:px-5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{label}</div>
        {description && <div className="text-[11.5px] text-cart-ink-3">{description}</div>}
      </div>
      <button
        type="button"
        onClick={handle}
        disabled={disabled}
        aria-pressed={localOn}
        aria-label={label}
        className={
          "relative h-7 w-[52px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 " +
          (localOn
            ? "bg-cart-accent shadow-[0_0_12px_var(--color-cart-accent-glow)]"
            : "bg-white/10")
        }
      >
        <span
          className={
            "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-200 " +
            (localOn ? "translate-x-[24px]" : "translate-x-0")
          }
        />
      </button>
    </div>
  );
}

// ============================================================
// Confirm sheet (cancelar)
// ============================================================
function ConfirmSheet({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <motion.div
        key="bd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        aria-hidden
        className="fixed inset-0 z-[80] app-scrim"
      />
      <motion.div
        key="sh"
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-[480px] rounded-t-[28px] border-t border-red-500/30 bg-cart-bg-elev p-5 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
        <div className="text-[20px] font-semibold tracking-[-0.02em]">¿Cancelar el evento?</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-cart-ink-3">
          Vamos a notificar a todos los compradores y empezar los reembolsos.
          Esto no se puede deshacer.
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-cart-line bg-cart-bg-elev-2 text-[14px] font-semibold"
          >
            Mejor no
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-red-500 text-[14px] font-semibold text-white"
          >
            Sí, cancelar
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ============================================================
// Confirm sheet (cerrar)
// ============================================================
function ConfirmCloseSheet({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <motion.div
        key="close-bd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        aria-hidden
        className="fixed inset-0 z-[80] app-scrim"
      />
      <motion.div
        key="close-sh"
        role="dialog"
        aria-modal="true"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-[480px] rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev p-5 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
        <div className="text-[20px] font-semibold tracking-[-0.02em]">¿Cerrar el evento?</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-cart-ink-3">
          Las ventas se detienen y el evento queda archivado. Los compradores conservan
          sus entradas. Puedes reabrirlo si lo necesitas.
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-cart-line bg-cart-bg-elev-2 text-[14px] font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-cart-line-strong bg-cart-bg-elev-2 text-[14px] font-semibold text-white"
          >
            Sí, cerrar
          </button>
        </div>
      </motion.div>
    </>
  );
}
