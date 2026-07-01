"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Réplica estática del panel real de organizador (mismos tokens `cart-*` que
 * /org/events/[slug]), con data de un evento de prueba — no una captura de
 * pantalla. Sin fetch: todo es prop estática para la landing, con los
 * números animados (cuentan de 0 al valor real cuando entran en pantalla).
 */

const KPIS = [
  { label: "Vendidas", to: 19, format: (n: number) => n.toLocaleString("es-PE"), hint: "Sin aforo definido", tone: "accent" as const, progress: null },
  { label: "Ingresaron", to: 18, format: (n: number) => n.toLocaleString("es-PE"), hint: "95% de las vendidas", tone: "green" as const, progress: 95 },
  { label: "Recaudado", to: 830, format: (n: number) => `S/ ${n.toLocaleString("es-PE")}`, hint: "acumulado en la noche", tone: "neutral" as const, progress: null },
];

const PROMOTERS = [{ rank: 1, name: "Promotor 1", code: "PROMO-01", sold: 1, validated: 0, revenue: "S/ 30" }];

function useCountUp(to: number, format: (n: number) => string, durationMs = 1100) {
  const [display, setDisplay] = useState(format(0));
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = () => {
      if (started.current) return;
      started.current = true;
      if (reduceMotion) {
        setDisplay(format(to));
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / durationMs);
        const eased = 1 - (1 - p) ** 3;
        setDisplay(format(Math.round(to * eased)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, format, durationMs]);

  return { ref, display };
}

function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const { ref, display } = useCountUp(to, format);
  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  );
}

const SCANS = [
  "01:10:02 p. m.",
  "01:09:36 p. m.",
  "01:09:22 p. m.",
  "12:33:29 p. m.",
  "12:18:46 p. m.",
  "09:51:51 a. m.",
];

type Layout = "grid" | "stacked" | "hero";

function KpiCard({
  label,
  to,
  format,
  hint,
  progress,
  tone,
  layout,
}: {
  label: string;
  to: number;
  format: (n: number) => string;
  hint: string;
  progress: number | null;
  tone: "accent" | "green" | "neutral";
  layout: Layout;
}) {
  const barColor =
    tone === "accent" ? "var(--color-cart-accent)" : tone === "green" ? "#22D17F" : "rgba(255,255,255,0.5)";

  const sizeCls =
    layout === "hero"
      ? "text-[22px]"
      : layout === "stacked"
        ? "text-[40px]"
        : "text-[26px] lg:text-[30px]";

  const padCls = layout === "hero" ? "rounded-xl p-3" : "rounded-2xl p-4";

  return (
    <div className={`border border-cart-line bg-cart-bg-elev ${padCls}`}>
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3 lg:text-[10px] lg:tracking-[0.16em]">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: barColor, boxShadow: tone === "green" ? "0 0 6px rgba(34,209,127,0.6)" : "none" }}
        />
        {label}
      </div>
      <div className={`mt-1.5 font-sans font-semibold leading-none tracking-[-0.035em] text-white lg:mt-2 ${sizeCls}`}>
        <CountUp to={to} format={format} />
      </div>
      {layout !== "hero" ? (
        <div className="mt-1.5 text-[11px] leading-snug text-cart-ink-3 lg:mt-2 lg:text-[12px]">{hint}</div>
      ) : null}
      {typeof progress === "number" && (
        <div className={`overflow-hidden rounded-full bg-white/5 ${layout === "hero" ? "mt-2 h-0.5" : "mt-2.5 h-1 lg:mt-3"}`}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: barColor }} />
        </div>
      )}
    </div>
  );
}

export function PanelDemo({ layout = "grid" }: { layout?: Layout }) {
  const stacked = layout === "stacked";
  const hero = layout === "hero";
  const scans = stacked ? SCANS.slice(0, 4) : SCANS.slice(0, hero ? 3 : SCANS.length);
  const showDetails = !hero;

  return (
    <div
      className={`rounded-2xl border border-cart-line-strong bg-cart-bg ${
        stacked ? "p-3" : hero ? "p-3.5" : "p-4 lg:p-5"
      }`}
    >
      <div className="flex items-center gap-2.5 lg:gap-3">
        <div
          className={`grid shrink-0 place-items-center rounded-xl font-sans font-semibold text-white ${
            hero ? "size-9 text-[15px]" : "size-11 text-[17px]"
          }`}
          style={{
            background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 45%, #FF4D5E 100%)",
            boxShadow: "0 8px 24px -10px rgba(124,58,237,0.55)",
          }}
        >
          E
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex gap-2 ${stacked ? "flex-col items-start" : "flex-wrap items-center"}`}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] lg:text-[10px]"
              style={{ background: "rgba(34,209,127,0.15)", color: "#22D17F" }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: "#22D17F", boxShadow: "0 0 8px #22D17F" }}
              />
              EN VIVO
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-cart-ink-3 lg:text-[10.5px] lg:tracking-[0.14em]">
              sáb, 11 jul · 10:00 p. m.
            </span>
          </div>
          <h3
            className={`mt-0.5 font-sans font-semibold leading-[1.15] tracking-[-0.02em] text-white lg:mt-1 ${
              hero ? "text-[15px]" : "text-[16px] lg:text-[17px]"
            }`}
          >
            Evento Demo Pasape
          </h3>
        </div>
      </div>

      <div
        className={`mt-3 grid gap-2 lg:mt-4 lg:gap-3 ${
          stacked ? "grid-cols-1" : "grid-cols-3"
        }`}
      >
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} layout={layout} />
        ))}
      </div>

      {showDetails ? (
        <div className={`mt-3 grid gap-3 ${stacked ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
            <header className="flex items-center justify-between border-b border-cart-line px-4 py-2.5 lg:py-3">
              <div>
                <h4 className="text-[12px] font-semibold tracking-[-0.01em] text-white lg:text-[13px]">Promotores</h4>
                <p className="text-[10px] text-cart-ink-3 lg:text-[10.5px]">vendido · validado · ingreso</p>
              </div>
              <span className="text-[10px] text-cart-ink-4 lg:text-[11px]">Ver links →</span>
            </header>
            <div className="divide-y divide-cart-line">
              {PROMOTERS.map((p) => (
                <div key={p.code} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 lg:py-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-[11px] font-semibold text-cart-ink-2">
                    {p.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold tracking-[-0.01em] text-white lg:text-[13px]">
                        {p.name}
                      </span>
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: "#22D17F", boxShadow: "0 0 6px #22D17F88" }}
                      />
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-cart-ink-3 lg:text-[10.5px]">
                      {p.code} · 0% asistencia
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 text-right lg:gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-white lg:text-[12px]">{p.sold}</span>
                    <span className="font-mono text-[11px] font-semibold text-[#22D17F] lg:text-[11.5px]">{p.validated}</span>
                    <span className="font-mono text-[10.5px] text-cart-ink-3 lg:text-[11.5px]">{p.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
            <header className="flex items-center justify-between border-b border-cart-line px-4 py-2.5 lg:py-3">
              <div className="flex items-center gap-2">
                <span className="relative grid size-4 place-items-center">
                  <span className="absolute size-3 animate-ping rounded-full bg-cart-accent/40" />
                  <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent-glow-strong)]" />
                </span>
                <h4 className="text-[12px] font-semibold tracking-[-0.01em] text-white lg:text-[13px]">Accesos en vivo</h4>
              </div>
              <span className="text-[10px] text-cart-ink-4 lg:text-[10.5px]">últimos 10</span>
            </header>
            <ul className="divide-y divide-cart-line">
              {scans.map((t) => (
                <li key={t} className="flex items-center justify-between gap-3 px-4 py-2 lg:py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: "#22D17F", boxShadow: "0 0 6px #22D17F88" }}
                    />
                    <span className="text-[11px] font-medium text-white lg:text-[12px]">Válido</span>
                  </div>
                  <span className="font-mono text-[10px] text-cart-ink-3 lg:text-[10.5px]">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
