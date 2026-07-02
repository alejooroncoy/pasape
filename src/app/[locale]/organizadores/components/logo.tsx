import { Logo as LogoIcon } from "@/components/brand/Logo";

export function Logo() {
  return (
    <a
      href="#top"
      aria-label="Pasape — Inicio"
      className="inline-flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-[-0.01em] text-ink"
    >
      <span aria-hidden="true" className="grid size-8 place-items-center">
        <LogoIcon className="size-full drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]" />
      </span>
      <span>Pasape</span>
    </a>
  );
}
