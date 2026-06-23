"use client";

// DEMO (no productiva): 3 variantes de gestión/invitación de BOX en celular,
// con el diseño de producción (cart-*). Datos mock de un Box de 8.
// Ruta: /es/tickets/demo-box

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QrSquare } from "@/components/design";

type Variant = "inline" | "sheet" | "page";

type Member = { id: string; name: string; you?: boolean };
const MEMBERS: Member[] = [
  { id: "1", name: "Alejo", you: true },
  { id: "2", name: "María" },
  { id: "3", name: "Carlos" },
];
const CAPACITY = 8;
const INVITE_URL = "pasape.pe/box/bx-7h2k9";

export default function DemoBoxPage() {
  const [variant, setVariant] = useState<Variant>("inline");
  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      <div className="mx-auto w-full max-w-[640px] px-5 pb-24 pt-6 lg:max-w-[460px]">
        <p className="text-[12px] font-medium text-white/50">Demo · comparativa</p>
        <h1 className="mt-0.5 text-[24px] font-bold tracking-[-0.02em]">Box en celular</h1>
        <p className="mt-1 text-[12.5px] text-white/40">
          3 formas de gestionar e invitar al box. Cambia el modo.
        </p>

        <div className="mt-4 flex gap-1 rounded-2xl bg-white/[0.04] p-1 shadow-[0_0_0_1px_var(--color-cart-line)_inset]">
          {(
            [
              ["inline", "Inline"],
              ["sheet", "Hoja"],
              ["page", "Página"],
            ] as [Variant, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={`flex-1 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition ${
                variant === v ? "bg-cart-accent text-cart-bg" : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {variant === "inline" && <InlineVariant />}
          {variant === "sheet" && <SheetVariant />}
          {variant === "page" && <PageVariant />}
        </div>
      </div>
    </div>
  );
}

/* ---------- piezas compartidas ---------- */

function SeatsRow() {
  const remaining = CAPACITY - MEMBERS.length;
  return (
    <div className="flex flex-wrap gap-2">
      {MEMBERS.map((m) => (
        <div key={m.id} className="flex w-[calc(25%-6px)] flex-col items-center gap-1">
          <div
            className={
              "relative grid size-11 place-items-center rounded-xl text-[15px] font-bold " +
              (m.you ? "bg-cart-accent text-cart-bg" : "bg-white/[0.08] text-white")
            }
          >
            {m.name[0]}
            {m.you && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-1 text-[7px] font-bold text-black">
                TÚ
              </span>
            )}
          </div>
          <span className="max-w-full truncate text-[10px] text-white/45">{m.name}</span>
        </div>
      ))}
      {Array.from({ length: remaining }).map((_, i) => (
        <div key={i} className="flex w-[calc(25%-6px)] flex-col items-center gap-1">
          <div className="grid size-11 place-items-center rounded-xl text-[18px] text-white/30 shadow-[0_0_0_1.5px_rgba(255,255,255,0.12)_inset]">
            +
          </div>
          <span className="text-[10px] text-transparent">.</span>
        </div>
      ))}
    </div>
  );
}

function InviteBlock() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-black/40 px-4 py-3 text-left font-mono text-[13.5px] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]"
      >
        <span className="truncate">{copied ? "¡copiado!" : INVITE_URL}</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-cart-accent">
          <rect x="6" y="6" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-[13.5px] font-bold text-[#062315]"
      >
        <svg width="17" height="17" viewBox="0 0 18 18"><path d="M9 1.5C4.86 1.5 1.5 4.86 1.5 9c0 1.43.4 2.77 1.1 3.9L1.5 16.5l3.74-1.05A7.4 7.4 0 0 0 9 16.5c4.14 0 7.5-3.36 7.5-7.5S13.14 1.5 9 1.5Z" fill="#062315" /></svg>
        Mandar al grupo de WhatsApp
      </button>
    </div>
  );
}

function CountHeader() {
  const remaining = CAPACITY - MEMBERS.length;
  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/40">Ya se sumaron</p>
        <p className="mt-0.5 text-[22px] font-bold tracking-[-0.02em]">
          {MEMBERS.length} <span className="text-[15px] font-medium text-white/40">/ {CAPACITY}</span>
        </p>
      </div>
      {remaining > 0 && (
        <span className="rounded-full bg-cart-accent/15 px-2.5 py-1 text-[11px] font-bold text-cart-accent">
          {remaining} {remaining === 1 ? "lugar libre" : "lugares libres"}
        </span>
      )}
    </div>
  );
}

/* Tarjeta del QR (igual que la entrada real, resumida) */
function QrCard() {
  return (
    <div
      className="overflow-hidden rounded-[28px] border border-cart-accent/40"
      style={{ background: "linear-gradient(180deg, rgba(124,58,237,0.28), rgba(20,12,40,0.6))" }}
    >
      <div className="px-6 pt-5">
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          Válida · Box B
        </span>
      </div>
      <div className="mx-6 my-5 grid place-items-center rounded-2xl bg-white p-4">
        <QrSquare code="demo-box-qr-payload" size={200} />
      </div>
      <div className="px-6 pb-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">Titular</p>
        <p className="text-[14px] font-semibold">Alejo Oroncoy</p>
        <p className="text-[11.5px] text-cart-ink-3">Box B · para 8 personas</p>
      </div>
    </div>
  );
}

/* ---------- Variante A: inline (combinación recomendada) ---------- */
function InlineVariant() {
  return (
    <div className="space-y-4">
      <QrCard />
      <div className="rounded-2xl border border-cart-accent/25 bg-cart-accent/[0.06] p-4">
        {/* Mensaje clave, siempre visible — el corazón del box */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[19px] font-bold leading-[1.15] tracking-[-0.02em]">
            Compartí el link.
            <br />
            Cada uno se suma solo.
          </h2>
          <a href="#" className="mt-0.5 shrink-0 text-[12px] font-semibold text-cart-accent">
            Ver QRs →
          </a>
        </div>

        <div className="mt-3.5">
          <InviteBlock />
        </div>

        <div className="mt-4">
          <CountHeader />
        </div>
        <div className="mt-3 rounded-2xl bg-white/[0.03] p-3 shadow-[0_0_0_1px_var(--color-cart-line)_inset]">
          <SeatsRow />
        </div>

        <p className="mt-3 rounded-xl bg-cart-accent/10 px-3 py-2 text-[11.5px] leading-snug text-white/70">
          Cada uno entra al link, pone su nombre y DNI, y recibe su propio QR.
        </p>
      </div>
    </div>
  );
}

/* ---------- Variante B: bottom sheet (con la combinación recomendada) ---------- */
function SheetVariant() {
  const [open, setOpen] = useState(false);
  const remaining = CAPACITY - MEMBERS.length;
  return (
    <div className="space-y-4">
      <QrCard />

      {/* Aviso bajo el QR: el mensaje clave queda visible aunque la gestión esté
          en el sheet — un tap para invitar. */}
      <div className="rounded-2xl border border-cart-accent/25 bg-cart-accent/[0.06] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold">Tu box · {MEMBERS.length}/{CAPACITY} adentro</p>
            <p className="text-[12px] text-white/50">
              {remaining > 0 ? `Faltan ${remaining} — invítalos` : "Box completo"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-semibold text-cart-bg transition hover:brightness-110 active:scale-95"
          >
            Invitar al box
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-3xl border border-cart-line bg-cart-bg-elev px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3"
            >
              <div className="flex justify-center"><span className="h-1 w-10 rounded-full bg-white/20" /></div>

              {/* Mensaje clave dentro del sheet */}
              <div className="mt-3 flex items-start justify-between gap-3">
                <h2 className="text-[19px] font-bold leading-[1.15] tracking-[-0.02em]">
                  Compartí el link.
                  <br />
                  Cada uno se suma solo.
                </h2>
                <a href="#" className="mt-0.5 shrink-0 text-[12px] font-semibold text-cart-accent">
                  Ver QRs →
                </a>
              </div>

              <div className="mt-3.5"><InviteBlock /></div>
              <div className="mt-4"><CountHeader /></div>
              <div className="mt-3 rounded-2xl bg-white/[0.03] p-3 shadow-[0_0_0_1px_var(--color-cart-line)_inset]">
                <SeatsRow />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Variante C: página dedicada ---------- */
function PageVariant() {
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4">
      <p className="mb-1 text-[11px] text-white/40">(simula la pantalla /tickets/[id]/box)</p>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] font-bold tracking-wide">BOX B</span>
        <span className="text-[12px] text-white/45">· {MEMBERS.length}/{CAPACITY}</span>
        <a href="#" className="ml-auto text-[12px] font-semibold text-cart-accent">Ver QRs →</a>
      </div>
      <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em]">
        Compartí el link.<br />Cada uno se suma solo.
      </h2>
      <div className="mt-4 rounded-2xl bg-cart-accent/[0.07] p-4 shadow-[0_0_0_1.5px_var(--color-cart-accent-soft)_inset]">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cart-accent">◆ Link de tu box</p>
        <InviteBlock />
      </div>
      <div className="mt-5"><CountHeader /></div>
      <div className="mt-3 rounded-2xl bg-white/[0.03] p-4 shadow-[0_0_0_1px_var(--color-cart-line)_inset]">
        <SeatsRow />
      </div>
      <p className="mt-3 rounded-xl bg-cart-accent/10 px-3 py-2 text-[11.5px] leading-snug text-white/70">
        Cada uno entra al link, pone su nombre y DNI, y recibe su propio QR.
      </p>
    </div>
  );
}
