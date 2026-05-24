import { Button } from "./ui/button";
import { Eyebrow } from "./ui/eyebrow";
import { Icon } from "./icons";

export function Hero({ waHref }: { waHref: string }) {
  return (
    <section
      id="top"
      className="hero relative isolate flex min-h-dvh items-center justify-center overflow-visible py-22 text-center md:py-24"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[1160px] flex-col items-center px-[22px] text-center md:px-8">
        <div className="flex flex-col items-center text-center">
          <Eyebrow withDot>Pilotos abiertos para eventos seleccionados</Eyebrow>
          <h1 className="reveal in m-0 mx-auto mt-7 max-w-[14ch] text-balance font-display text-[clamp(48px,7.6vw,96px)] font-semibold leading-none tracking-[-0.035em] text-ink [&_em]:font-serif [&_em]:font-normal [&_em]:italic [&_em]:tracking-[-0.02em] [&_em]:text-accent [&_em]:[text-shadow:0_0_32px_var(--color-accent-glow)]">
            Vende entradas.
            <br />
            <em>Más fácil. Más rápido.</em>
          </h1>
          <p className="reveal in mx-auto mt-7 max-w-[46ch] text-pretty text-[clamp(16px,1.5vw,18px)] font-normal leading-normal text-ink-2">
            Promos, combos y grupos sin responder un solo DM. Y cuando
            quieras, mide a tus promotores en tiempo real.
          </p>
          <div className="reveal in mt-9 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-3.5">
            <Button
              href={waHref}
              target="_blank"
              aria-label="Quiero probar Pasape — hablar por WhatsApp"
              leadingIcon={<Icon name="whatsapp" width={18} height={18} />}
            >
              Quiero probar Pasape
            </Button>
          </div>
          <p className="reveal in mt-6 font-serif text-[18px] italic text-ink-3">
            Sin app <span className="not-italic text-accent opacity-80 mx-2">·</span> Sin listas{" "}
            <span className="not-italic text-accent opacity-80 mx-2">·</span> Sin caos
          </p>
        </div>
      </div>
    </section>
  );
}
