/** Captura real del panel de organizador — un solo elemento visual, sin mocks apilados. */
export function HeroPreview() {
  return (
    <div className="hero-preview reveal in">
      <div className="hero-preview-panel">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            Panel en vivo
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)] animate-pulse-live" />
            En vivo
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <img
            src="/marketing/panel-real.png"
            alt="Captura real del panel de organizador de Pasape con ventas e ingresos en vivo"
            width={1440}
            height={800}
            className="block h-[220px] w-full object-cover object-left-top"
          />
        </div>
      </div>
    </div>
  );
}
