import { Button } from "./ui/button";
import { Eyebrow } from "./ui/eyebrow";
import { Icon } from "./icons";
import { HeroPreview } from "./hero-preview";

export function Hero({ waHref }: { waHref: string }) {
  return (
    <section
      id="top"
      className="hero relative isolate overflow-visible pt-28 pb-16 md:min-h-dvh md:py-24"
    >
      <div className="hero-bleed" aria-hidden="true" />
      <div className="hero-noise-spill" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1160px] grid-cols-1 items-center gap-14 px-[22px] md:grid-cols-2 md:gap-12 md:px-8 lg:gap-16">
        <div className="text-center md:text-left">
          <Eyebrow withDot>Pilotos abiertos para eventos seleccionados</Eyebrow>
          <h1 className="reveal in m-0 mt-7 max-w-[12ch] text-balance font-display text-[clamp(44px,6.8vw,80px)] font-semibold leading-[0.98] tracking-[-0.035em] text-ink md:mx-0 [&_em]:font-serif [&_em]:font-normal [&_em]:italic [&_em]:tracking-[-0.02em] [&_em]:text-accent [&_em]:[text-shadow:0_0_32px_var(--color-accent-glow)]">
            Vende entradas.
            <br />
            <em>Sin el caos.</em>
          </h1>
          <p className="reveal in mx-auto mt-6 max-w-[42ch] text-pretty text-[clamp(16px,1.5vw,18px)] leading-normal text-ink-2 md:mx-0">
            Combos, preventas y boxes sin responder un solo DM. Mide a tus
            promotores en tiempo real desde el panel.
          </p>

          <div className="reveal in mt-9 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <Button
              href={waHref}
              target="_blank"
              aria-label="Quiero probar Pasape — hablar por WhatsApp"
              leadingIcon={<Icon name="whatsapp" width={18} height={18} />}
            >
              Quiero probar Pasape
            </Button>
            <Button href="#promos" variant="ghost" className="text-sm">
              Ver qué incluye
            </Button>
          </div>
          <p className="reveal in mt-5 font-serif text-[17px] italic text-ink-3 md:text-left">
            Sin app <span className="not-italic text-accent opacity-80 mx-2">·</span> Sin listas{" "}
            <span className="not-italic text-accent opacity-80 mx-2">·</span> 100% web
          </p>
        </div>

        <div className="reveal in flex justify-center md:justify-end">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}
