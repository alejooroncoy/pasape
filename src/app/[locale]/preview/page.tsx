"use client";

import { useState, useEffect, useRef } from "react";

const EVENTS = [
  { id: "1", title: "Club Vertigo", venue: "Asia · Lima", date: "Sáb 7 jun", time: "10:00 PM", gradient: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)", accent: "#b87cff" },
  { id: "2", title: "Reggaeton Sunday", venue: "Barranco · Lima", date: "Dom 8 jun", time: "8:00 PM", gradient: "linear-gradient(150deg,#1a0010 0%,#7c0a2a 45%,#ff4d5e 100%)", accent: "#ff8fa3" },
  { id: "3", title: "Noche de Jazz", venue: "Miraflores · Lima", date: "Sáb 13 jun", time: "9:00 PM", gradient: "linear-gradient(150deg,#001a10 0%,#064e3b 45%,#22d17f 100%)", accent: "#6ee7b7" },
  { id: "4", title: "Techno Warehouse", venue: "Cercado · Lima", date: "Vie 20 jun", time: "11:00 PM", gradient: "linear-gradient(150deg,#0a0a0f 0%,#1e293b 45%,#475569 100%)", accent: "#94a3b8" },
];

type Ev = typeof EVENTS[0];

function Flyer({ ev }: { ev: Ev }) {
  return (
    <div style={{ width: "100%", height: "100%", background: ev.gradient, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
    </div>
  );
}

function MiniFlyer({ ev }: { ev: Ev }) {
  return (
    <div style={{ width: "100%", height: "100%", background: ev.gradient }} />
  );
}

const DURATION = 5000;

function HeroAB() {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (i: number) => setCur((i + EVENTS.length) % EVENTS.length);

  // Progress bar
  useEffect(() => {
    setProgress(0);
    if (progTimer.current) clearInterval(progTimer.current);
    progTimer.current = setInterval(() => setProgress(p => Math.min(p + 100 / (DURATION / 100), 100)), 100);
    return () => { if (progTimer.current) clearInterval(progTimer.current); };
  }, [cur]);

  // Auto-advance
  useEffect(() => {
    if (paused) { if (autoTimer.current) clearInterval(autoTimer.current); return; }
    autoTimer.current = setInterval(() => setCur(c => (c + 1) % EVENTS.length), DURATION);
    return () => { if (autoTimer.current) clearInterval(autoTimer.current); };
  }, [paused]);

  const ev = EVENTS[cur];

  return (
    <div
      style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.07)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background slides */}
      {EVENTS.map((e, i) => (
        <div key={e.id} style={{ position: "absolute", inset: 0, transition: "opacity 1s ease", opacity: i === cur ? 1 : 0, zIndex: i === cur ? 1 : 0 }}>
          <Flyer ev={e} />
        </div>
      ))}

      {/* Single clean scrim — sólo abajo */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(to top, rgba(4,4,8,1) 0%, rgba(4,4,8,0.75) 28%, rgba(4,4,8,0.1) 55%, transparent 75%)",
      }} />

      {/* Content — título + meta */}
      <div style={{
        position: "absolute", zIndex: 3,
        left: "clamp(24px,4vw,52px)", right: "clamp(24px,4vw,52px)",
        bottom: "calc(72px + clamp(20px,3vw,40px))",
      }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", fontFamily: "sans-serif", marginBottom: 10, letterSpacing: "0.01em" }}>
          {ev.date} · {ev.time} · {ev.venue}
        </div>
        <h2 style={{ margin: "0 0 20px", fontFamily: "sans-serif", fontSize: "clamp(28px,5vw,66px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.92, color: "#fff" }}>
          {ev.title}
        </h2>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          borderRadius: 999, background: "#b87cff", border: "none",
          padding: "12px 26px", fontSize: 13.5, fontWeight: 700, color: "#fff",
          cursor: "pointer", fontFamily: "sans-serif",
          boxShadow: "0 6px 24px -6px rgba(184,124,255,0.65)",
        }}>
          Comprar entradas
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Barra glass inferior */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 4,
        background: "rgba(6,6,12,0.65)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Barra de progreso */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#b87cff", transition: "width 0.1s linear", opacity: 0.8 }} />
        </div>

        {/* Solo flechas + contador */}
        <div style={{ padding: "10px clamp(16px,3vw,44px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "sans-serif", letterSpacing: "0.04em" }}>
            {cur + 1} de {EVENTS.length} eventos
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {([-1, 1] as const).map(dir => (
              <button
                key={dir}
                onClick={() => go(cur + dir)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d={dir === -1 ? "M9 3 5 7l4 4" : "M5 3l4 4-4 4"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Events Scroll ──────────────────────────────────────────────────────── */
function EventsScroll() {
  const all = [...EVENTS, ...EVENTS.slice(0, 2)];
  return (
    <section style={{ padding: "clamp(48px,6vw,80px) 0 clamp(32px,4vw,56px) clamp(16px,4vw,52px)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, paddingRight: "clamp(16px,4vw,52px)" }}>
        <h2 style={{ margin: 0, fontFamily: "sans-serif", fontSize: "clamp(20px,2.8vw,32px)", fontWeight: 600, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.85)" }}>
          Esta semana
        </h2>
        <button style={{ flexShrink: 0, borderRadius: 999, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", padding: "9px 18px", fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.45)", cursor: "pointer", fontFamily: "sans-serif" }}>Ver todos →</button>
      </div>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingRight: "clamp(16px,4vw,52px)", scrollSnapType: "x mandatory", scrollbarWidth: "none" as const }}>
        {all.map((ev, i) => (
          <div key={`${ev.id}-${i}`} style={{ flexShrink: 0, width: "clamp(170px,20vw,240px)", scrollSnapAlign: "start", cursor: "pointer" }}>
            <div
              style={{ width: "100%", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", position: "relative" }}
              onMouseEnter={el => { (el.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={el => { (el.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
            >
              <Flyer ev={ev} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(4,4,8,0.85) 0%,transparent 48%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: 10, left: 10, borderRadius: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)", padding: "4px 9px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "sans-serif", letterSpacing: "0.02em" }}>{ev.date}</div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 2px", fontFamily: "sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{ev.title}</p>
                <p style={{ margin: 0, fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{ev.venue}</p>
              </div>
            </div>
          </div>
        ))}
        <div style={{ flexShrink: 0, width: 20 }} />
      </div>
    </section>
  );
}

export default function PreviewPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff" }}>
      <div style={{ padding: "10px clamp(16px,4vw,52px)", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(184,124,255,0.6)", textTransform: "uppercase" as const, fontFamily: "sans-serif" }}>
        Preview · Mix A+B · Mock data
      </div>
      <div style={{ padding: "clamp(16px,3vw,28px) clamp(16px,4vw,52px) 0" }}>
        <HeroAB />
      </div>
      <EventsScroll />
    </div>
  );
}
