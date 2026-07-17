import { Button } from "./ui/button";
import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

export function FormSection({ waHref }: { waHref: string }) {
  return (
    <section
      id="form"
      className="relative z-[1] overflow-hidden border-t border-cart-line py-14 pb-20 md:py-20 md:pb-24"
    >
      <div className="relative z-[1] mx-auto w-full max-w-[760px] px-[22px] text-center md:px-8">
        <SectionHeader
          align="center"
          eyebrow="¿Tienes una fecha próxima?"
          title={
            <>
              Vendamos tu próxima fecha <em>sin Excel.</em>
            </>
          }
          lede="Cuéntanos qué estás organizando — fiesta, concierto, charla, evento universitario — y vemos si Pasape encaja para tu venta y tu puerta."
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
          <p className="mx-auto max-w-[36ch] text-center text-sm text-cart-ink-3">
            Te respondemos por WhatsApp. Sin spam, sin llamadas frías.
          </p>
        </div>
      </div>
    </section>
  );
}
