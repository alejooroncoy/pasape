import { Button } from "./ui/button";
import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

export function FormSection({ waHref }: { waHref: string }) {
  return (
    <section
      id="form"
      className="relative overflow-hidden border-t border-line bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,124,255,0.18),transparent_60%),linear-gradient(180deg,var(--color-bg-purple-deeper)_0%,var(--color-bg)_100%)] py-16 pb-24 md:py-30 md:pb-28 before:pointer-events-none before:absolute before:bottom-[-200px] before:left-1/2 before:h-[400px] before:w-[800px] before:-translate-x-1/2 before:bg-[radial-gradient(ellipse,rgba(184,124,255,0.25),transparent_70%)] before:blur-[80px] before:content-['']"
    >
      <div className="relative z-[1] mx-auto w-full max-w-[760px] px-[22px] text-center md:px-8">
        <SectionHeader
          align="center"
          eyebrow="¿Tienes una fiesta próxima?"
          title={
            <>
              Probemos Pasape <em>sin costo fijo.</em>
            </>
          }
          lede="Escríbenos por WhatsApp y vemos si tu evento calza para el piloto. Te respondemos directo, sin formularios largos."
        />

        <div className="mt-9 flex w-full flex-col items-center gap-3.5">
          <Button
            href={waHref}
            target="_blank"
            aria-label="Hablemos por WhatsApp"
            leadingIcon={<Icon name="whatsapp" width={20} height={20} />}
            trailingIcon={<Icon name="arrow-right" width={16} height={16} />}
            className="w-full max-w-[320px] justify-center sm:max-w-none sm:w-auto"
          >
            Hablemos por WhatsApp
          </Button>
          <p className="mx-auto max-w-[36ch] text-center text-sm text-ink-3">
            Te respondemos por WhatsApp. Sin spam, sin llamadas frías.
          </p>
        </div>
      </div>
    </section>
  );
}
