import type { ReactNode } from "react";
import { SectionHeader } from "./ui/section-header";

const PROBLEMAS: { text: ReactNode }[] = [
  {
    text: (
      <>
        Vendes por WhatsApp y armas la lista de invitados en un Excel que{" "}
        <span className="hl">solo tú entiendes</span>.
      </>
    ),
  },
  {
    text: (
      <>
        En la puerta, alguien busca un nombre{" "}
        <span className="hl">en una lista de cientos</span> mientras la fila
        crece afuera.
      </>
    ),
  },
  {
    text: (
      <>
        Un pantallazo de Yape se puede reenviar, y no tienes forma de saber{" "}
        <span className="hl">quién ya entró</span>.
      </>
    ),
  },
  {
    text: (
      <>
        No sabes qué promotor trajo a quién, ni cuánto le debes al cierre —{" "}
        <span className="hl">todo queda a memoria</span>.
      </>
    ),
  },
];

export function Problema() {
  return (
    <section
      id="problema"
      className="relative bg-cart-bg pt-14 pb-16 md:pt-16 md:pb-20"
    >
      <div className="relative z-[2] mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="El problema de vender a mano"
          title={
            <>
              Tu evento crece, <em>pero tu Excel no.</em>
            </>
          }
          lede="No es que no sepas vender: las plataformas de ticketing dan por hecho que ya sabes usarlas. Pasape empieza donde tú ya estás — WhatsApp, Yape y una lista de invitados."
        />
        <div className="mt-10 grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-[18px]">
          {PROBLEMAS.map((p, i) => (
            <div
              key={i}
              className="reveal group relative grid grid-cols-[44px_1fr] items-start gap-5 rounded-2xl border border-cart-line bg-cart-bg-elev p-6 transition-colors duration-200 hover:border-cart-line-strong"
            >
              <span
                aria-hidden="true"
                className="font-serif text-[32px] italic leading-none text-cart-accent"
              >
                “
              </span>
              <p className="m-0 text-pretty font-sans text-[clamp(17px,1.9vw,20px)] font-medium leading-snug tracking-[-0.012em] text-cart-ink">
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
