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
          <Eyebrow withDot>Pilotos abiertos para eventos seleccionados</Eyebrow>
          <h1 className="reveal in m-0 mt-7 max-w-[12ch] text-balance font-display text-[clamp(44px,6.8vw,80px)] font-semibold leading-[0.98] tracking-[-0.035em] text-ink [&_em]:font-serif [&_em]:font-normal [&_em]:italic [&_em]:tracking-[-0.02em] [&_em]:text-accent [&_em]:[text-shadow:0_0_32px_var(--color-accent-glow)]">
            Vende entradas.
            <br />
            <em>Sin el caos.</em>
          </h1>
          <p className="reveal in mt-6 max-w-[42ch] text-pretty text-[clamp(16px,1.5vw,18px)] leading-normal text-ink-2">
            Combos, preventas y boxes sin responder un solo DM. Mide a tus
            promotores en tiempo real desde el panel.
          </p>

          <div className="reveal in mt-9 flex w-full max-w-[320px] flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Button
              href={waHref}
              target="_blank"
              aria-label="Quiero probar Pasape — hablar por WhatsApp"
              leadingIcon={<Icon name="whatsapp" width={18} height={18} />}
              className="w-full justify-center sm:w-auto"
            >
              Quiero probar Pasape
            </Button>
            <Button href="#promos" variant="ghost" className="w-full justify-center text-sm sm:w-auto">
              Ver qué incluye
            </Button>
          </div>
          <p className="reveal in mt-5 font-serif text-[17px] italic text-ink-3">
            Sin app <span className="not-italic text-accent opacity-80 mx-2">·</span> Sin listas{" "}
            <span className="not-italic text-accent opacity-80 mx-2">·</span> 100% web
          </p>
        </div>
      </div>
    </section>
  );
}
