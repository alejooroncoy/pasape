"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { Link } from "@/i18n/navigation";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_EVENT = {
  title: "Gorillaz World Tour",
  venue: "Arena 1 Park · Lima",
  date: "Lun 23 Nov · 21:00",
  cover: "https://upload.wikimedia.org/wikipedia/en/9/9e/Song_Machine%2C_Season_One_cover.png",
};

const MOCK_TICKETS = [
  { id: "t1", type: "General Preventa", box: null, person: "Tú", initial: "T", status: "valid" },
  { id: "t2", type: "General Preventa", box: null, person: "María G.", initial: "M", status: "sent" },
  { id: "t3", type: "VIP", box: "Box A", person: "Carlos R.", initial: "C", status: "valid" },
];

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function QrPlaceholder({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden>
      <rect width="80" height="80" rx="8" fill="white" />
      {/* top-left */}
      <rect x="8" y="8" width="24" height="24" rx="3" fill="#111" />
      <rect x="13" y="13" width="14" height="14" rx="1" fill="white" />
      {/* top-right */}
      <rect x="48" y="8" width="24" height="24" rx="3" fill="#111" />
      <rect x="53" y="13" width="14" height="14" rx="1" fill="white" />
      {/* bottom-left */}
      <rect x="8" y="48" width="24" height="24" rx="3" fill="#111" />
      <rect x="13" y="53" width="14" height="14" rx="1" fill="white" />
      {/* dots */}
      <rect x="40" y="40" width="5" height="5" rx="1" fill="#111" />
      <rect x="48" y="40" width="5" height="5" rx="1" fill="#111" />
      <rect x="56" y="40" width="5" height="5" rx="1" fill="#111" />
      <rect x="40" y="48" width="5" height="5" rx="1" fill="#111" />
      <rect x="56" y="48" width="5" height="5" rx="1" fill="#111" />
      <rect x="40" y="56" width="5" height="5" rx="1" fill="#111" />
      <rect x="48" y="56" width="5" height="5" rx="1" fill="#111" />
      <rect x="64" y="40" width="5" height="5" rx="1" fill="#111" />
      <rect x="64" y="48" width="5" height="5" rx="1" fill="#111" />
      <rect x="64" y="56" width="5" height="5" rx="1" fill="#111" />
    </svg>
  );
}

function Badge({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${accent ? "bg-purple-500/20 text-purple-300 border border-purple-400/30" : "bg-white/8 text-white/60 border border-white/10"}`}>
      {children}
    </span>
  );
}

// ─── Variante 1: Apple Wallet horizontal swipeable ─────────────────────────
function Variant1() {
  const [current, setCurrent] = useState(0);

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Variante 1</p>
      <h3 className="mb-3 text-[17px] font-bold">Apple Wallet horizontal</h3>
      <p className="mb-4 text-[12.5px] text-white/50">Desliza entre entradas como tarjetas. Una a la vez, enfoque total.</p>

      {/* Event header */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MOCK_EVENT.cover} alt="" className="size-12 rounded-xl object-cover" />
        <div>
          <p className="text-[14px] font-semibold">{MOCK_EVENT.title}</p>
          <p className="text-[11.5px] text-white/50">{MOCK_EVENT.date}</p>
          <p className="text-[11px] text-white/35">{MOCK_EVENT.venue}</p>
        </div>
        <div className="ml-auto">
          <Badge>{MOCK_TICKETS.length} entradas</Badge>
        </div>
      </div>

      {/* Card stack */}
      <div className="relative overflow-hidden">
        <div
          className="flex gap-3 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(calc(-${current * 100}% - ${current * 12}px))` }}
        >
          {MOCK_TICKETS.map((t, i) => (
            <div key={t.id} className="w-full flex-shrink-0">
              <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#1a0533] to-[#3b0764]">
                {/* Top: event cover */}
                <div className="relative h-[130px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={MOCK_EVENT.cover} alt="" className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1a0533]" />
                  <div className="absolute right-3 top-3">
                    <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white/70 backdrop-blur">
                      {i + 1} / {MOCK_TICKETS.length}
                    </span>
                  </div>
                </div>

                {/* Tear line */}
                <div className="relative flex items-center gap-0">
                  <span className="absolute -left-3 size-6 rounded-full bg-[#0c0014]" />
                  <div className="flex-1 border-t border-dashed border-white/15 mx-3" />
                  <span className="absolute -right-3 size-6 rounded-full bg-[#0c0014]" />
                </div>

                {/* Body */}
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-400">{t.type}</p>
                    {t.box && <p className="text-[12px] text-white/60">{t.box}</p>}
                    <p className="mt-1 text-[13px] font-semibold">{t.person}</p>
                    {t.status === "sent" && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-amber-300">
                        <span className="size-1.5 rounded-full bg-amber-400" /> Enviada · esperando
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl bg-white p-1.5">
                    <QrPlaceholder size={72} />
                  </div>
                </div>

                {/* CTA */}
                <div className="px-4 pb-4">
                  <button className="w-full rounded-full bg-purple-600 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)] active:scale-95 transition">
                    Mostrar en puerta
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {MOCK_TICKETS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-200 ${i === current ? "w-5 h-1.5 bg-purple-400" : "size-1.5 bg-white/25"}`}
            />
          ))}
        </div>

        {/* Swipe buttons */}
        <div className="mt-3 flex justify-between">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] text-white/50 disabled:opacity-20 hover:text-white/80 transition"
          >
            ← Anterior
          </button>
          <button
            onClick={() => setCurrent(Math.min(MOCK_TICKETS.length - 1, current + 1))}
            disabled={current === MOCK_TICKETS.length - 1}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] text-white/50 disabled:opacity-20 hover:text-white/80 transition"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Variante 2: Boarding pass numerado ────────────────────────────────────
function Variant2() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Variante 2</p>
      <h3 className="mb-3 text-[17px] font-bold">Boarding pass numerado</h3>
      <p className="mb-4 text-[12.5px] text-white/50">Número grande como elemento primario. Sin ambigüedad en grupos.</p>

      {/* Event mini header */}
      <div className="mb-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MOCK_EVENT.cover} alt="" className="size-10 rounded-xl object-cover" />
        <div>
          <p className="text-[14px] font-semibold">{MOCK_EVENT.title}</p>
          <p className="text-[11px] text-white/40">{MOCK_EVENT.date} · {MOCK_TICKETS.length} entradas</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {MOCK_TICKETS.map((t, i) => (
          <motion.div key={t.id} layout>
            <button
              type="button"
              onClick={() => setSelected(selected === t.id ? null : t.id)}
              className="flex w-full items-center gap-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#110d1f] text-left transition hover:border-white/20"
            >
              {/* Number column */}
              <div className="flex w-[72px] shrink-0 flex-col items-center justify-center self-stretch bg-gradient-to-b from-purple-900/40 to-purple-900/20 py-4">
                <span className="text-[30px] font-black leading-none text-white/90">{i + 1}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-white/30">de {MOCK_TICKETS.length}</span>
              </div>

              {/* Tear notch */}
              <div className="relative w-0 shrink-0">
                <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#0c0014]" />
                <span className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#0c0014]" />
                <span className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l border-dashed border-white/10" />
              </div>

              {/* Info */}
              <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold">{t.type}</p>
                  {t.box && <p className="text-[11.5px] text-purple-400">{t.box}</p>}
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${t.status === "valid" ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="text-[11px] text-white/45">{t.person}</span>
                  </div>
                </div>
                <div className={`transition-transform duration-200 ${selected === t.id ? "rotate-90" : ""}`}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M7 5l5 5-5 5" stroke="white" strokeOpacity="0.3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </button>

            {/* QR expandido */}
            <AnimatePresence>
              {selected === t.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col items-center gap-3 rounded-b-2xl border border-t-0 border-white/[0.08] bg-[#110d1f] px-6 pb-5 pt-4">
                    <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(124,58,237,0.3)]">
                      <QrPlaceholder size={160} />
                    </div>
                    <p className="text-[12px] text-white/40">Entrada {i + 1} · {t.type}{t.box ? ` · ${t.box}` : ""}</p>
                    <button className="w-full rounded-full bg-purple-600 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)]">
                      Pantalla completa
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Variante 3: Asignación por persona ────────────────────────────────────
function Variant3() {
  const [selected, setSelected] = useState<string | null>(null);
  const colors = ["#b87cff", "#3ad6ff", "#ff6fae"];

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Variante 3</p>
      <h3 className="mb-3 text-[17px] font-bold">Por persona</h3>
      <p className="mb-4 text-[12.5px] text-white/50">Cada entrada tiene dueño. Ideal para grupos que compraron juntos.</p>

      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MOCK_EVENT.cover} alt="" className="size-14 rounded-xl object-cover" />
        <div className="flex-1">
          <p className="text-[15px] font-bold">{MOCK_EVENT.title}</p>
          <p className="text-[12px] text-white/45">{MOCK_EVENT.date}</p>
          <p className="text-[11.5px] text-white/30">{MOCK_EVENT.venue}</p>
        </div>
      </div>

      {/* Avatar row */}
      <div className="mb-4 flex gap-3">
        {MOCK_TICKETS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setSelected(selected === t.id ? null : t.id)}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div
              className={`relative flex size-14 items-center justify-center rounded-full text-[18px] font-bold text-white outline outline-2 transition-all duration-200 ${selected === t.id ? "outline-offset-2 scale-110" : "outline-transparent"}`}
              style={{ background: `${colors[i]}30`, outlineColor: selected === t.id ? colors[i] : "transparent" }}
            >
              <span style={{ color: colors[i] }}>{t.initial}</span>
              {selected === t.id && (
                <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full" style={{ background: colors[i] }}>
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              {t.status === "sent" && (
                <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-amber-400 border-2 border-[#0c0014]" />
              )}
            </div>
            <div className="text-center">
              <p className="text-[11px] font-semibold text-white/80">{t.person.split(" ")[0]}</p>
              <p className="text-[10px] text-white/35">{t.type.split(" ")[0]}</p>
            </div>
          </button>
        ))}
      </div>

      {/* QR del seleccionado */}
      <AnimatePresence mode="wait">
        {selected && (() => {
          const t = MOCK_TICKETS.find(x => x.id === selected)!;
          const i = MOCK_TICKETS.indexOf(t);
          return (
            <motion.div
              key={selected}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="rounded-[24px] border border-white/10 bg-[#110d1f] p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-full text-[15px] font-bold"
                  style={{ background: `${colors[i]}25`, color: colors[i] }}
                >
                  {t.initial}
                </div>
                <div>
                  <p className="text-[14px] font-semibold">{t.person}</p>
                  <p className="text-[12px] text-white/45">{t.type}{t.box ? ` · ${t.box}` : ""}</p>
                </div>
                {t.status === "sent" && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10.5px] text-amber-300">
                    <span className="size-1.5 rounded-full bg-amber-400" /> Esperando
                  </span>
                )}
              </div>
              <div className="flex justify-center">
                <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(124,58,237,0.25)]">
                  <QrPlaceholder size={150} />
                </div>
              </div>
              <button className="mt-4 w-full rounded-full bg-purple-600 py-2.5 text-[13.5px] font-semibold text-white">
                Mostrar en puerta
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {!selected && (
        <p className="py-4 text-center text-[12.5px] text-white/30">Toca un avatar para ver su QR</p>
      )}
    </div>
  );
}

// ─── Variante 4: Grid 2×N de stubs ─────────────────────────────────────────
function Variant4() {
  const [selected, setSelected] = useState<string | null>(null);
  const gradients = [
    "linear-gradient(135deg,#1a0533,#7c3aed)",
    "linear-gradient(135deg,#021726,#0e9bd6)",
    "linear-gradient(135deg,#2a0518,#d63d86)",
  ];

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Variante 4</p>
      <h3 className="mb-3 text-[17px] font-bold">Grid de stubs</h3>
      <p className="mb-4 text-[12.5px] text-white/50">Cuadrícula compacta. Ves todo de un vistazo y toca para abrir el QR.</p>

      <div className="mb-4 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MOCK_EVENT.cover} alt="" className="size-8 rounded-lg object-cover" />
        <p className="text-[13.5px] font-semibold">{MOCK_EVENT.title}</p>
        <span className="ml-auto text-[11px] text-white/35">{MOCK_EVENT.date}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {MOCK_TICKETS.map((t, i) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => setSelected(selected === t.id ? null : t.id)}
            whileTap={{ scale: 0.96 }}
            className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-200 ${selected === t.id ? "border-purple-400/60 shadow-[0_0_24px_rgba(124,58,237,0.3)]" : "border-white/[0.07] hover:border-white/20"}`}
          >
            {/* Background gradient */}
            <div className="absolute inset-0 opacity-60" style={{ background: gradients[i] }} />

            {/* Content */}
            <div className="relative p-3.5">
              {/* Status dot */}
              <span className={`mb-2 inline-block size-2 rounded-full ${t.status === "valid" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-amber-400"}`} />

              <p className="text-[12.5px] font-bold leading-tight text-white">{t.type}</p>
              {t.box && <p className="mt-0.5 text-[11px] text-purple-300">{t.box}</p>}
              <p className="mt-1 text-[10.5px] text-white/55">{t.person}</p>

              {/* QR mini icon */}
              <div className="mt-3 flex items-center justify-between">
                <svg width="28" height="28" viewBox="0 0 80 80" fill="none" opacity={0.6}>
                  <rect width="80" height="80" rx="4" fill="white" />
                  <rect x="8" y="8" width="24" height="24" rx="2" fill="#111" />
                  <rect x="13" y="13" width="14" height="14" rx="1" fill="white" />
                  <rect x="48" y="8" width="24" height="24" rx="2" fill="#111" />
                  <rect x="53" y="13" width="14" height="14" rx="1" fill="white" />
                  <rect x="8" y="48" width="24" height="24" rx="2" fill="#111" />
                  <rect x="13" y="53" width="14" height="14" rx="1" fill="white" />
                  <rect x="40" y="40" width="5" height="5" fill="#111" />
                  <rect x="48" y="48" width="5" height="5" fill="#111" />
                  <rect x="56" y="40" width="5" height="5" fill="#111" />
                </svg>
                {selected === t.id ? (
                  <span className="rounded-full bg-purple-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Abierto</span>
                ) : (
                  <span className="text-[10px] text-white/30">Tap →</span>
                )}
              </div>
            </div>
          </motion.button>
        ))}

        {/* Empty slot si es impar */}
        {MOCK_TICKETS.length % 2 !== 0 && <div />}
      </div>

      {/* QR expandido debajo del grid */}
      <AnimatePresence>
        {selected && (() => {
          const t = MOCK_TICKETS.find(x => x.id === selected)!;
          return (
            <motion.div
              key={selected}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-col items-center gap-3 rounded-[20px] border border-white/10 bg-[#110d1f] py-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{t.type}{t.box ? ` · ${t.box}` : ""} · {t.person}</p>
                <div className="rounded-2xl bg-white p-3">
                  <QrPlaceholder size={160} />
                </div>
                <button className="rounded-full bg-purple-600 px-8 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)]">
                  Pantalla completa
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ─── Variante 5: Bottom sheet inmersivo ────────────────────────────────────
function Variant5() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Variante 5</p>
      <h3 className="mb-3 text-[17px] font-bold">Bottom sheet inmersivo</h3>
      <p className="mb-4 text-[12.5px] text-white/50">Toca el evento → sheet desde abajo con portada grande + lista de entradas.</p>

      {/* Trigger card */}
      <motion.button
        type="button"
        onClick={() => setSheetOpen(true)}
        whileTap={{ scale: 0.985 }}
        className="w-full overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#110d1f] text-left"
      >
        <div className="relative h-[180px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MOCK_EVENT.cover} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#110d1f] via-[#110d1f]/40 to-transparent" />
          <div className="absolute bottom-0 p-4">
            <p className="text-[20px] font-bold leading-tight">{MOCK_EVENT.title}</p>
            <p className="text-[12.5px] text-white/60">{MOCK_EVENT.date}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" stroke="white" strokeOpacity="0.4" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            <span className="text-[13px] text-white/60">{MOCK_TICKETS.length} entradas</span>
          </div>
          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-[12px] font-semibold text-purple-300">Ver entradas →</span>
        </div>
      </motion.button>

      {/* Sheet overlay */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => { setSheetOpen(false); setSelectedTicket(null); }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden rounded-t-[28px] bg-[#110d1f] pb-[max(24px,env(safe-area-inset-bottom))]"
              style={{ maxHeight: "88vh" }}
            >
              {/* Portada */}
              <div className="relative h-[200px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MOCK_EVENT.cover} alt="" className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#110d1f] via-[#110d1f]/50 to-transparent" />

                {/* Handle */}
                <div className="absolute left-0 right-0 top-3 flex justify-center">
                  <div className="h-1 w-10 rounded-full bg-white/25" />
                </div>

                {/* Close */}
                <button
                  onClick={() => { setSheetOpen(false); setSelectedTicket(null); }}
                  className="absolute right-4 top-8 flex size-8 items-center justify-center rounded-full bg-black/50 text-white/60 backdrop-blur"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>

                <div className="absolute bottom-0 px-5 pb-4">
                  <p className="text-[22px] font-bold">{MOCK_EVENT.title}</p>
                  <p className="text-[13px] text-white/55">{MOCK_EVENT.date} · {MOCK_EVENT.venue}</p>
                </div>
              </div>

              {/* Tickets list */}
              <div className="overflow-y-auto px-4 pt-4" style={{ maxHeight: "calc(88vh - 200px)" }}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">
                  {MOCK_TICKETS.length} entradas compradas
                </p>

                <div className="flex flex-col gap-2.5">
                  {MOCK_TICKETS.map((t, i) => (
                    <motion.button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTicket(selected => selected === t.id ? null : t.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition ${selectedTicket === t.id ? "border-purple-400/50 bg-purple-500/10" : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"}`}
                    >
                      {/* Number */}
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                        <span className="text-[16px] font-black text-purple-300">{i + 1}</span>
                      </div>

                      <div className="flex-1">
                        <p className="text-[14px] font-semibold">{t.type}</p>
                        {t.box && <p className="text-[12px] text-purple-400">{t.box}</p>}
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${t.status === "valid" ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span className="text-[11.5px] text-white/50">{t.person}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${selectedTicket === t.id ? "bg-purple-500 text-white" : "bg-purple-500/15 text-purple-300"}`}>
                          {selectedTicket === t.id ? "▾ QR" : "Ver QR"}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* QR inline del seleccionado */}
                <AnimatePresence>
                  {selectedTicket && (() => {
                    const t = MOCK_TICKETS.find(x => x.id === selectedTicket)!;
                    return (
                      <motion.div
                        key={selectedTicket}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 flex flex-col items-center gap-3 rounded-[20px] border border-purple-400/20 bg-purple-500/5 py-5">
                          <p className="text-[11.5px] text-white/40">{t.type} · {t.person}</p>
                          <div className="rounded-2xl bg-white p-3 shadow-[0_0_40px_rgba(124,58,237,0.3)]">
                            <QrPlaceholder size={160} />
                          </div>
                          <button className="w-[80%] rounded-full bg-purple-600 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)]">
                            Pantalla completa
                          </button>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                <div className="h-4" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Variante 6: Quentro-style ─────────────────────────────────────────────
// Flujo: evento card → pantalla "Seleccionar entrada" → QR a pantalla completa
function Variant6() {
  // step: "list" | "select" | "qr"
  const [step, setStep] = useState<"list" | "select" | "qr">("list");
  const [selectedTicket, setSelectedTicket] = useState<(typeof MOCK_TICKETS)[0] | null>(null);

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Variante 6</p>
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-[17px] font-bold">Estilo Quentro</h3>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-300">Recomendado</span>
      </div>
      <p className="mb-4 text-[12.5px] text-white/50">Evento → lista de entradas → QR a pantalla completa. 3 pasos claros, sin expansiones inline.</p>

      {/* Breadcrumb de navegación */}
      <div className="mb-4 flex items-center gap-1.5 text-[11px] text-white/30">
        <button onClick={() => { setStep("list"); setSelectedTicket(null); }} className={step !== "list" ? "text-purple-400 hover:underline" : "font-semibold text-white/60"}>
          Mis entradas
        </button>
        {step !== "list" && (
          <>
            <span>›</span>
            <button onClick={() => setStep("select")} className={step === "qr" ? "text-purple-400 hover:underline" : "font-semibold text-white/60"}>
              {MOCK_EVENT.title}
            </button>
          </>
        )}
        {step === "qr" && (
          <>
            <span>›</span>
            <span className="font-semibold text-white/60">{selectedTicket?.type}</span>
          </>
        )}
      </div>

      {/* ── PASO 1: Lista de eventos ── */}
      <AnimatePresence mode="wait">
        {step === "list" && (
          <motion.div key="list" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
            {/* Tab Upcoming / Previous */}
            <div className="mb-4 flex rounded-2xl bg-white/[0.04] p-1">
              <div className="flex-1 rounded-xl bg-white/10 py-2 text-center text-[13px] font-semibold text-white">Próximas</div>
              <div className="flex-1 py-2 text-center text-[13px] text-white/35">Pasadas</div>
            </div>

            {/* Mes */}
            <p className="mb-2 text-[12px] font-semibold text-white/40">Noviembre 2026</p>

            {/* Evento card — estilo Quentro: imagen izquierda, info derecha */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => setStep("select")}
              className="flex w-full items-stretch overflow-hidden rounded-2xl border border-white/[0.08] bg-[#110d1f] text-left transition hover:border-white/20"
            >
              {/* Cover cuadrada */}
              <div className="relative w-[88px] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MOCK_EVENT.cover} alt="" className="absolute inset-0 size-full object-cover" />
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col justify-center gap-1 px-4 py-3.5">
                <p className="text-[11px] font-semibold text-purple-400">
                  {MOCK_TICKETS.length} {MOCK_TICKETS.length === 1 ? "entrada" : "entradas"}
                </p>
                <p className="text-[15.5px] font-bold leading-tight">{MOCK_EVENT.title}</p>
                <p className="text-[12px] text-white/45">{MOCK_EVENT.venue}</p>
                <p className="mt-0.5 text-[11px] text-white/30">{MOCK_EVENT.date}</p>
              </div>

              {/* Chevron */}
              <div className="flex items-center pr-4">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M7 5l5 5-5 5" stroke="white" strokeOpacity="0.25" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.button>
          </motion.div>
        )}

        {/* ── PASO 2: Selección de entrada ── */}
        {step === "select" && (
          <motion.div key="select" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18 }}>
            {/* Header del evento */}
            <div className="mb-5 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MOCK_EVENT.cover} alt="" className="size-12 rounded-xl object-cover" />
              <div>
                <p className="text-[15px] font-bold">{MOCK_EVENT.title}</p>
                <p className="text-[12px] text-white/40">{MOCK_EVENT.date}</p>
              </div>
            </div>

            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">
              Seleccioná tu entrada
            </p>

            <div className="flex flex-col gap-2">
              {MOCK_TICKETS.map((t, i) => (
                <motion.button
                  key={t.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedTicket(t); setStep("qr"); }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#110d1f] px-4 py-4 text-left transition hover:border-purple-400/40 hover:bg-purple-500/5"
                >
                  {/* Número */}
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[15px] font-black text-white/70">
                    {i + 1}
                  </div>

                  <div className="flex-1">
                    <p className="text-[14.5px] font-semibold">{t.type}</p>
                    {t.box && <p className="text-[12px] text-purple-400">{t.box}</p>}
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${t.status === "valid" ? "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" : "bg-amber-400"}`} />
                      <span className="text-[12px] text-white/40">{t.status === "sent" ? "Enviada · esperando" : t.person}</span>
                    </div>
                  </div>

                  {/* QR icon mini */}
                  <svg width="20" height="20" viewBox="0 0 80 80" fill="none" opacity={0.35}>
                    <rect width="80" height="80" rx="6" fill="white" />
                    <rect x="8" y="8" width="24" height="24" rx="3" fill="#111" />
                    <rect x="13" y="13" width="14" height="14" rx="1" fill="white" />
                    <rect x="48" y="8" width="24" height="24" rx="3" fill="#111" />
                    <rect x="53" y="13" width="14" height="14" rx="1" fill="white" />
                    <rect x="8" y="48" width="24" height="24" rx="3" fill="#111" />
                    <rect x="13" y="53" width="14" height="14" rx="1" fill="white" />
                    <rect x="40" y="40" width="5" height="5" fill="#111" />
                    <rect x="48" y="48" width="5" height="5" fill="#111" />
                    <rect x="56" y="40" width="5" height="5" fill="#111" />
                  </svg>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── PASO 3: QR a pantalla completa ── */}
        {step === "qr" && selectedTicket && (
          <motion.div key="qr" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }} className="flex flex-col items-center">
            {/* Info del evento compacta */}
            <div className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MOCK_EVENT.cover} alt="" className="size-10 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13.5px] font-bold">{MOCK_EVENT.title}</p>
                <p className="text-[11.5px] text-white/40">{MOCK_EVENT.date}</p>
              </div>
              {/* Navegación entre entradas */}
              <div className="flex items-center gap-1">
                {MOCK_TICKETS.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`size-2 rounded-full transition-all ${t.id === selectedTicket.id ? "w-4 bg-purple-400" : "bg-white/20"}`}
                  />
                ))}
              </div>
            </div>

            {/* QR grande */}
            <div className="relative rounded-[28px] bg-white p-5 shadow-[0_0_80px_rgba(124,58,237,0.4)]">
              <QrPlaceholder size={200} />
              {/* Logo centrado */}
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 size-10 items-center justify-center rounded-xl bg-[#0c0014]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Tipo + persona */}
            <div className="mt-4 text-center">
              <p className="text-[16px] font-bold">{selectedTicket.type}</p>
              {selectedTicket.box && <p className="text-[13px] text-purple-400">{selectedTicket.box}</p>}
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className={`size-1.5 rounded-full ${selectedTicket.status === "valid" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-amber-400"}`} />
                <span className="text-[12.5px] text-white/45">{selectedTicket.status === "sent" ? "Enviada · esperando confirmación" : selectedTicket.person}</span>
              </div>
            </div>

            {/* Countdown ring placeholder */}
            <div className="mt-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[11px] text-white/40">QR se renueva en <span className="font-semibold text-white/60">8s</span></span>
            </div>

            {/* Botón siguiente entrada si hay más */}
            {MOCK_TICKETS.length > 1 && (
              <button
                onClick={() => {
                  const idx = MOCK_TICKETS.findIndex(t => t.id === selectedTicket.id);
                  setSelectedTicket(MOCK_TICKETS[(idx + 1) % MOCK_TICKETS.length]);
                }}
                className="mt-4 w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white/60 transition hover:bg-white/[0.08]"
              >
                Ver siguiente entrada →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function TicketsDemoPage() {
  return (
    <div className="min-h-screen bg-[#0c0014] font-sans text-white">
      <div className="mx-auto max-w-[480px] px-4 pb-24 pt-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Demo · Mis Entradas</p>
          <h1 className="text-[28px] font-black tracking-[-0.02em]">6 variantes de UX</h1>
          <p className="mt-1 text-[13px] text-white/45">3 entradas compradas para el mismo evento. Explora cada variante y elige.</p>
        </div>

        <div className="flex flex-col gap-10">
          {[
            <Variant1 key="v1" />,
            <Variant2 key="v2" />,
            <Variant3 key="v3" />,
            <Variant4 key="v4" />,
            <Variant5 key="v5" />,
            <Variant6 key="v6" />,
          ].map((v, i) => (
            <div key={i} className={`rounded-[24px] border p-5 ${i === 5 ? "border-purple-400/30 bg-purple-500/[0.04] shadow-[0_0_40px_-10px_rgba(124,58,237,0.2)]" : "border-white/[0.07] bg-white/[0.02]"}`}>
              {v}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <p className="text-[12px] text-white/35">Esta página es solo para demo · <Link href={"/tickets" as never} className="text-purple-400 hover:underline">← Volver a Mis Entradas</Link></p>
        </div>
      </div>
    </div>
  );
}
