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
    d: "Ventas, accesos, combos, promotores y base de asistentes para tu próxima fecha.",
  },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="border-y border-line bg-bg-elev/20 py-16 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Cómo funciona"
          title={
            <>
              Así funciona <em>de principio a fin.</em>
            </>
          }
        />

        <ol className="relative mt-14 grid list-none gap-0 p-0 md:grid-cols-5 md:gap-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[22px] top-6 bottom-6 hidden w-px bg-gradient-to-b from-accent/50 via-line to-transparent md:left-[calc(10%+22px)] md:block lg:hidden"
          />
          {STEPS.map((s, i) => (
            <li
              key={s.t}
              className="reveal group relative grid grid-cols-[56px_1fr] items-start gap-[22px] border-b border-line py-7 last:border-b-0 md:grid-cols-1 md:gap-4 md:rounded-[20px] md:border md:border-line-strong md:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent),var(--color-bg-elev)] md:p-6 md:transition-[transform,border-color,box-shadow] md:hover:-translate-y-1 md:hover:border-accent/35 md:hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.65)]"
            >
              <div className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-bg font-mono text-[13px] font-semibold tabular-nums text-ink-2 transition-[background-color,color,box-shadow,border-color] duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-white group-hover:shadow-[0_0_0_4px_rgba(184,124,255,0.18),0_0_18px_var(--color-accent-glow)] md:mx-0">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="md:pt-1">
                <h3 className="m-0 font-display text-[clamp(17px,2vw,20px)] font-semibold leading-snug tracking-[-0.014em] text-ink">
                  {s.t}
                </h3>
                <p className="m-0 mt-2 text-[14px] leading-normal text-ink-3">
                  {s.d}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
