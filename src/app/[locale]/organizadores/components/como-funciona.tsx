import { SectionHeader } from "./ui/section-header";

const STEPS = [
  {
    t: "Arma tu evento en minutos",
    d: "Entradas, preventa, boxes y cortesías listos para compartir por WhatsApp, Instagram o tu bio.",
  },
  {
    t: "Vende sin perder el hilo",
    d: "Cada comprador paga desde el celular y recibe su QR al toque. Cada promotor y cada canal quedan atribuidos solos.",
  },
  {
    t: "Entra a la puerta sin buscar nombres",
    d: "Escaneas el QR desde el celular del portero, sabes quién ya entró y cierras el evento con el reporte ya armado.",
  },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="border-y border-cart-line bg-cart-bg py-14 md:py-20">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Cómo funciona"
          title={
            <>
              De la primera venta <em>hasta la puerta.</em>
            </>
          }
        />

        <ol className="relative mt-10 grid list-none gap-0 p-0 md:grid-cols-3 md:gap-5">
          {STEPS.map((s, i) => (
            <li
              key={s.t}
              className="reveal group relative grid grid-cols-[56px_1fr] items-start gap-[22px] border-b border-cart-line py-7 last:border-b-0 md:grid-cols-1 md:gap-4 md:rounded-[20px] md:border md:border-cart-line-strong md:bg-cart-bg-elev md:p-6 md:transition-colors md:hover:border-cart-accent/35"
            >
              <div className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full border border-cart-line-strong bg-cart-bg font-mono text-[13px] font-semibold tabular-nums text-cart-ink-2 transition-colors duration-200 group-hover:border-cart-accent group-hover:bg-cart-accent group-hover:text-white md:mx-0">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="md:pt-1">
                <h3 className="m-0 font-sans text-[clamp(17px,2vw,20px)] font-semibold leading-snug tracking-[-0.014em] text-cart-ink">
                  {s.t}
                </h3>
                <p className="m-0 mt-2 text-[14px] leading-normal text-cart-ink-3">
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
