import { QrSquare } from "./qr-square";

/** Mock de producto flotante — panel + ticket, inspirado en Luma/Linear. */
export function HeroPreview() {
  return (
    <div className="hero-preview reveal in" aria-hidden="true">
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["19", "Vendidas"],
            ["18", "Ingresaron"],
            ["S/830", "Recaudado"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl border border-line bg-bg/40 px-2.5 py-2">
              <div className="font-display text-lg font-semibold tabular-nums text-ink">{v}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-4">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
          {[["Promotor 1", "1"]].map(([name, qty]) => (
            <div key={name} className="flex items-center justify-between text-[11px] text-ink-2">
              <span className="text-accent">{name}</span>
              <span className="font-mono tabular-nums text-ink">{qty}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-preview-ticket">
        <div className="grid grid-cols-[52px_1fr] items-center gap-3">
          <div className="grid size-[52px] place-items-center rounded-lg bg-white p-1.5">
            <QrSquare seedOffset={4} />
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3">
              Entrada 2 / 3 · 3x2
            </div>
            <div className="mt-0.5 font-display text-[15px] font-semibold text-ink">Para Lucía</div>
            <div className="font-mono text-[11px] text-accent">PSP · 7K3M-A002</div>
          </div>
        </div>
      </div>
    </div>
  );
}
