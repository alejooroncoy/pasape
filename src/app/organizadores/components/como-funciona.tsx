import { SectionHeader } from "./ui/section-header";

const STEPS = [
  {
    t: "Crea tu evento",
    d: "Nombre, fecha, lugar, tipos de entrada y stock. Obtienes un link público.",
  },
  {
    t: "Comparte el link",
    d: "Por WhatsApp, Instagram, bio o donde tus asistentes te encuentren.",
  },
  {
    t: "Vende entradas y combos",
    d: "Cada entrada lleva su QR único. Los combos se reparten automáticamente.",
  },
  {
    t: "Valida en puerta",
    d: "Escanea desde la web. Si alguien no encuentra su QR, búscalo por DNI, nombre o teléfono.",
  },
  {
    t: "Revisa resultados",
    d: "Ventas, accesos, combos, referidos y base de asistentes para tu próxima fecha.",
  },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="py-24 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Cómo funciona"
          title={
            <>
              Así funciona <em>de principio a fin.</em>
            </>
          }
        />
        <div className="mt-12 grid border-t border-line">
          {STEPS.map((s, i) => (
            <div
              key={s.t}
              className="reveal group relative grid grid-cols-[56px_1fr] items-start gap-[22px] border-b border-line py-6 transition-[padding-left] duration-200 hover:pl-2"
            >
              <div className="relative z-10 grid size-11 place-items-center rounded-full border border-line-strong bg-bg-elev font-mono text-[13px] font-semibold tabular-nums text-ink-2 transition-[background-color,color,box-shadow] duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-white group-hover:shadow-[0_0_0_4px_rgba(184,124,255,0.18),0_0_18px_var(--color-accent-glow)]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="m-0 mt-2 font-display text-[clamp(18px,2.2vw,22px)] font-semibold leading-snug tracking-[-0.014em] text-ink">
                  {s.t}
                </h3>
                <p className="m-0 mt-1.5 text-[15px] leading-normal text-ink-3">
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
