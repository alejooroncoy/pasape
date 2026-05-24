export function Logo() {
  return (
    <a
      href="#top"
      aria-label="Pasape — Inicio"
      className="inline-flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-[-0.01em] text-ink"
    >
      <span
        aria-hidden="true"
        className="relative inline-grid size-7 place-items-center overflow-hidden rounded-sm bg-gradient-to-br from-accent to-accent-2 text-sm font-bold tracking-[-0.02em] text-white shadow-[0_0_14px_var(--color-accent-glow),0_1px_0_rgba(255,255,255,0.18)_inset] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_50%)] after:content-['']"
      >
        <span className="relative z-10">P</span>
      </span>
      <span>Pasape</span>
    </a>
  );
}
