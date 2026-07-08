import { Button } from "./ui/button";
import { Eyebrow } from "./ui/eyebrow";
import { Icon } from "./icons";

export function Hero({ waHref }: { waHref: string }) {
  return (
    <section
      id="top"
      className="hero relative w-full max-w-dvw isolate overflow-hidden pt-28 pb-16 lg:flex lg:min-h-dvh lg:items-center lg:py-24"
    >
      <div className="hero-bleed" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-[1160px] px-[22px] lg:px-8">
        <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
          <Eyebrow withDot>Sistema operativo para eventos</Eyebrow>
          <h1 className="reveal in m-0 mt-7 max-w-[13ch] text-balance font-display text-[clamp(44px,6.8vw,80px)] font-semibold leading-[0.98] tracking-[-0.035em] text-ink [&_em]:font-serif [&_em]:font-normal [&_em]:italic [&_em]:tracking-[-0.02em] [&_em]:text-accent [&_em]:[text-shadow:0_0_32px_var(--color-accent-glow)]">
            Vende entradas.
            <br />
            <em>Controla todo.</em>
          </h1>
          <p className="reveal in mt-6 max-w-[42ch] text-pretty text-[clamp(16px,1.5vw,18px)] leading-normal text-ink-2">
            Tickets, pagos, QR, boxes, cortesías, reportes y control de acceso
            en un solo lugar. Pasape reduce la fricción de compra y ordena la
            operación para que llegues al día del evento con menos pendientes.
          </p>

          <div className="reveal in mt-9 flex w-full max-w-[320px] flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Button
              href={waHref}
              target="_blank"
              aria-label="Quiero vender con Pasape — hablar por WhatsApp"
              leadingIcon={<Icon name="whatsapp" width={18} height={18} />}
              className="w-full justify-center sm:w-auto"
            >
              Quiero vender con Pasape
            </Button>
            <Button href="#promos" variant="ghost" className="w-full justify-center text-sm sm:w-auto">
              Ver el sistema
            </Button>
          </div>
          <p className="reveal in mt-5 font-serif text-[17px] italic text-ink-3">
            Compra web <span className="not-italic text-accent opacity-80 mx-2">·</span> QR único{" "}
            <span className="not-italic text-accent opacity-80 mx-2">·</span> Panel en vivo
          </p>
        </div>
      </div>
    </section>
  );
}
