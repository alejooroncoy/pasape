/**
 * Réplica estática del panel real de organizador (mismos tokens `cart-*` que
 * /org/events/[slug]), con data de un evento de prueba — no una captura de
 * pantalla. Sin hooks, sin fetch: todo es prop estática para la landing.
 */

const KPIS = [
  { label: "Vendidas", value: "19", hint: "Sin aforo definido", tone: "accent" as const, progress: null },
  { label: "Ingresaron", value: "18", hint: "95% de las vendidas", tone: "green" as const, progress: 95 },
  { label: "Recaudado", value: "S/ 830", hint: "acumulado en la noche", tone: "neutral" as const, progress: null },
];

const PROMOTERS = [{ rank: 1, name: "Promotor 1", code: "PROMO-01", sold: 1, validated: 0, revenue: "S/ 30" }];

const SCANS = [
  "01:10:02 p. m.",
  "01:09:36 p. m.",
  "01:09:22 p. m.",
  "12:33:29 p. m.",
  "12:18:46 p. m.",
  "09:51:51 a. m.",
];

function KpiCard({
  label,
  value,
  hint,
  progress,
  tone,
  compact,
}: {
  label: string;
  value: string;
  hint: string;
  progress: number | null;
  tone: "accent" | "green" | "neutral";
  compact?: boolean;
}) {
  const barColor =
    tone === "accent" ? "var(--color-cart-accent)" : tone === "green" ? "#22D17F" : "rgba(255,255,255,0.5)";
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
        <span
          className="size-1.5 rounded-full"
          style={{ background: barColor, boxShadow: tone === "green" ? "0 0 6px rgba(34,209,127,0.6)" : "none" }}
        />
        {label}
      </div>
      <div
        className={`mt-2 whitespace-nowrap font-sans font-semibold leading-none tracking-[-0.035em] ${compact ? "text-[26px]" : "text-[36px] lg:text-[44px]"}`}
      >
        {value}
      </div>
      <div className="mt-2 truncate text-[11.5px] text-cart-ink-3">{hint}</div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: barColor }} />
        </div>
      )}
    </div>
  );
}

export function PanelDemo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-cart-line-strong bg-cart-bg p-4 lg:p-6">
      {/* Header del evento */}
      <div className="flex items-center gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl font-sans text-[17px] font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 45%, #FF4D5E 100%)",
            boxShadow: "0 8px 24px -10px rgba(124,58,237,0.55)",
          }}
        >
          E
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]"
              style={{ background: "rgba(34,209,127,0.15)", color: "#22D17F" }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: "#22D17F", boxShadow: "0 0 8px #22D17F" }}
              />
              EN VIVO
            </span>
            <span className="truncate text-[10.5px] font-medium uppercase tracking-[0.14em] text-cart-ink-3">
              sáb, 11 jul, 10:00 p m
            </span>
          </div>
          <h3 className="mt-1 truncate font-sans text-[18px] font-semibold leading-[1.1] tracking-[-0.02em] text-white">
            Evento Demo Pasape
          </h3>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 lg:gap-3">
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} compact={compact} />
        ))}
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Promotores */}
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
            <header className="flex items-center justify-between border-b border-cart-line px-4 py-3">
              <div>
                <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-white">Promotores</h4>
                <p className="text-[10.5px] text-cart-ink-3">vendido · validado · ingreso</p>
              </div>
              <span className="text-[11px] text-cart-ink-4">Ver links →</span>
            </header>
            <div className="divide-y divide-cart-line">
              {PROMOTERS.map((p) => (
                <div key={p.code} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-[11px] font-semibold text-cart-ink-2">
                    {p.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white">
                        {p.name}
                      </span>
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: "#22D17F", boxShadow: "0 0 6px #22D17F88" }}
                      />
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] text-cart-ink-3">
                      {p.code} · 0% asistencia
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2.5 text-right">
                    <span className="font-mono text-[12px] font-semibold text-white">{p.sold}</span>
                    <span className="font-mono text-[11.5px] font-semibold text-[#22D17F]">{p.validated}</span>
                    <span className="font-mono text-[11.5px] text-cart-ink-3">{p.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accesos en vivo */}
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev">
            <header className="flex items-center justify-between border-b border-cart-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative grid size-4 place-items-center">
                  <span className="absolute size-3 animate-ping rounded-full bg-cart-accent/40" />
                  <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent-glow-strong)]" />
                </span>
                <h4 className="text-[13px] font-semibold tracking-[-0.01em] text-white">Accesos en vivo</h4>
              </div>
              <span className="text-[10.5px] text-cart-ink-4">últimos 10</span>
            </header>
            <ul className="divide-y divide-cart-line">
              {SCANS.map((t) => (
                <li key={t} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: "#22D17F", boxShadow: "0 0 6px #22D17F88" }}
                    />
                    <span className="text-[12px] font-medium text-white">Válido</span>
                  </div>
                  <span className="font-mono text-[10.5px] text-cart-ink-3">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
