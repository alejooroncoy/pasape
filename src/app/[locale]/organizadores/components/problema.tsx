import type { ReactNode } from "react";
import { SectionHeader } from "./ui/section-header";

const PROBLEMAS: { text: ReactNode }[] = [
  {
    text: (
      <>
        Tienes entradas, boxes, cortesías y promotores, pero cada cosa termina
        en <span className="hl">un archivo o chat distinto</span>.
      </>
    ),
  },
  {
    text: (
      <>
        El comprador pregunta por precio, stock o QR porque la información no
        está clara en <span className="hl">un solo link de compra</span>.
      </>
    ),
  },
  {
    text: (
      <>
        Para saber cómo va el evento tienes que cruzar ventas, listas,
        promotores y pagos <span className="hl">a mano</span>.
      </>
    ),
  },
  {
    text: (
      <>
        En puerta necesitas validar rápido, ver quién ya entró y evitar que un
        QR o una lista <span className="hl">se use dos veces</span>.
      </>
    ),
  },
];

export function Problema() {
  return (
    <section
      id="problema"
      className="relative bg-bg pt-14 pb-16 md:pt-16 md:pb-20"
    >
      <div className="relative z-[2] mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="El problema"
          title={
            <>
              Tu evento necesita una operación clara, <em>no más parches.</em>
            </>
          }
          lede="Pasape no promete llenar tu evento. Te da la infraestructura para cobrar, emitir QR, ordenar invitados, medir canales y controlar accesos desde el mismo panel."
        />
        <div className="mt-10 grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-[18px]">
          {PROBLEMAS.map((p, i) => (
            <div
              key={i}
              className="reveal prob-card group relative grid grid-cols-[44px_1fr] items-start gap-5 overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0)),var(--color-bg-elev)] p-6 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_16px_40px_-16px_var(--color-accent-glow)]"
            >
              <span
                aria-hidden="true"
                className="font-serif text-[32px] italic leading-none text-accent [text-shadow:0_0_16px_var(--color-accent-glow)]"
              >
                “
              </span>
              <p className="m-0 text-pretty font-display text-[clamp(17px,1.9vw,20px)] font-medium leading-snug tracking-[-0.012em] text-ink">
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
