import type { ReactNode } from "react";
import { SectionHeader } from "./ui/section-header";

const PROBLEMAS: { text: ReactNode }[] = [
  {
    text: (
      <>
        ¿Cuántas veces respondiste <span className="hl">el mismo DM</span>{" "}
        explicando la promo de grupos?
      </>
    ),
  },
  {
    text: (
      <>
        Alguien compra un combo <span className="hl">3x2</span> y te pide
        reenviar las entradas de sus amigos. Las buscas, las reenvías, rezas
        para que no se pierdan en el chat.
      </>
    ),
  },
  {
    text: (
      <>
        Tus promotores dicen que vendieron{" "}
        <span className="hl">más de lo que vendieron</span>. Al cierre nadie
        sabe quién trajo a quién.
      </>
    ),
  },
  {
    text: (
      <>
        QR repetidos, nombres en lista y gente{" "}
        <span className="hl">sin batería</span> frenando la puerta.
      </>
    ),
  },
];

export function Problema() {
  return (
    <section
      id="problema"
      className="relative bg-bg pt-16 pb-24 md:pt-20 md:pb-30"
    >
      <div className="relative z-[2] mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="El problema"
          title={
            <>
              Organizar una fiesta no debería ser <em>un caos.</em>
            </>
          }
          lede="Entre WhatsApp, capturas, listas, combos y puerta — vender entradas en Lima se vuelve un trabajo aparte. Y cuando llega la noche, la mitad se cae por la grieta."
        />
        <div className="mt-14 grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-[18px]">
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
