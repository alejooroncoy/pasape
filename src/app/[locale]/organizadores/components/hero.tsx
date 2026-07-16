import { Button } from "./ui/button";
import { Eyebrow } from "./ui/eyebrow";
import { Icon } from "./icons";
import { HeroPreview } from "./hero-preview";

export function Hero({ waHref }: { waHref: string }) {
  return (
    <section
      id="top"
      className="relative z-[1] w-full max-w-dvw isolate overflow-hidden pt-28 pb-16 lg:flex lg:min-h-dvh lg:items-center lg:py-24"
    >
      <div className="relative z-10 mx-auto grid w-full max-w-[1160px] items-center gap-12 px-[22px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8">
        <div className="mx-auto flex max-w-[640px] flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <Eyebrow withDot>Para fiestas, raves y eventos universitarios</Eyebrow>
          <h1 className="reveal in m-0 mt-7 max-w-[15ch] text-balance font-sans text-[clamp(40px,6.8vw,72px)] font-semibold leading-[0.98] tracking-[-0.03em] text-cart-ink [&_em]:font-serif [&_em]:font-normal [&_em]:italic [&_em]:tracking-[-0.02em] [&_em]:text-cart-accent">
            Deja el Excel.
            <br />
            <em>Entra con QR.</em>
          </h1>
          <p className="reveal in mt-6 max-w-[46ch] text-pretty text-[clamp(16px,1.5vw,18px)] leading-normal text-cart-ink-2">
            Hoy vendes por WhatsApp, cobras por Yape y en la puerta alguien
            busca nombres en una lista de cientos. Con Pasape, en cambio,
            compartes un link, cada entrada llega con su QR y en la puerta ya
            sabes quién entró y quién no.
          </p>

          <div className="reveal in mt-9 flex w-full max-w-[320px] flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
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
              Ver cómo funciona
            </Button>
          </div>
          <p className="reveal in mt-5 font-serif text-[17px] italic text-cart-ink-3">
            Compra por link <span className="not-italic text-cart-accent opacity-80 mx-2">·</span> QR único{" "}
            <span className="not-italic text-cart-accent opacity-80 mx-2">·</span> Sabes quién entró
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}
