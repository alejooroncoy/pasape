import { SectionHeader } from "./ui/section-header";

export function PanelReporte() {
  return (
    <section id="panel" className="py-24 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Panel en vivo"
          title={
            <>
              Tu fiesta en tiempo real. <em>No al día siguiente.</em>
            </>
          }
          lede="Ventas, accesos, combos y promotores corriendo en vivo. Al cierre tienes un reporte — no capturas sueltas ni un Excel a las 4 a.m."
        />

        <div
          aria-hidden="true"
          className="reveal relative mt-12 grid gap-[22px] overflow-hidden rounded-[22px] border border-line-strong bg-[linear-gradient(180deg,rgba(26,10,46,0.5),rgba(18,18,26,0.95))] p-7 tabular-nums text-ink shadow-[0_0_0_1px_rgba(184,124,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.6)] md:p-9 after:pointer-events-none after:absolute after:bottom-[-40%] after:right-[-20%] after:size-[360px] after:bg-[radial-gradient(closest-side,rgba(184,124,255,0.35),transparent_70%)] after:blur-[40px] after:content-['']"
        >
          <div className="relative z-[1] flex items-center justify-between gap-3.5 font-mono text-xs tracking-[0.04em] text-ink-3">
            <span>Open Air · La Azotea · Sáb 16 may · Barranco</span>
            <span className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-accent/40 bg-accent/[0.08] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <span className="size-[7px] rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)] animate-pulse-live" />
              En vivo
            </span>
          </div>

          <div className="relative z-[1] grid grid-cols-2 gap-[22px] md:grid-cols-4">
            {[
              ["Vendidas", "187"],
              ["Validadas", "94"],
              ["Combos", "42"],
              ["Ingresos", "S/ 11,220"],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1.5">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-3">
                  {label}
                </span>
                <span className="font-display text-[clamp(26px,4.4vw,34px)] font-semibold leading-none tracking-[-0.02em] text-ink">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="relative z-[1] grid gap-3 border-t border-dashed border-line pt-[18px]">
            {[
              ["General", "S/ 60", "120", false],
              ["Combo 3x2 · General", "S/ 60", "42", false],
              ["Box para 8", "S/ 480", "5", false],
              ["@diego_pe (promotor)", "—", "24", true],
              ["@valeisabela (promotor)", "—", "18", true],
            ].map(([label, price, qty, ref]) => (
              <div
                key={String(label)}
                className="grid grid-cols-[1fr_70px_50px] items-center gap-3.5 text-sm text-ink-2"
              >
                <span
                  className={
                    ref ? "font-medium text-accent" : ""
                  }
                >
                  {label}
                </span>
                <span className="text-right font-mono text-xs text-ink-3">
                  {price}
                </span>
                <span className="text-right font-mono font-semibold text-ink">
                  {qty}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
