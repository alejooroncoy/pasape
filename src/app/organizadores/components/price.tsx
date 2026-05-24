import { Button } from "./ui/button";
import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

export function Price({ waHref }: { waHref: string }) {
  return (
    <section id="precio" className="py-24 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Precio"
          title={
            <>
              Tú no pagas. <em>El comprador asume el servicio.</em>
            </>
          }
          lede="Sin costo fijo ni implementación. Y si entras al piloto ahora, va S/0 — buscamos eventos seleccionados para validar juntos."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.1fr] md:gap-[22px]">
          {/* Plan Free */}
          <div className="reveal relative grid gap-4 overflow-hidden rounded-3xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0)),var(--color-bg-elev)] p-9 md:p-11">
            <div className="relative z-[1] flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3">
                Plan Free
              </span>
              <span className="rounded-full border border-line-strong bg-transparent px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                Lo paga el comprador
              </span>
            </div>
            <h3 className="relative z-[1] m-0 flex items-baseline gap-2 text-balance font-display text-[clamp(56px,9vw,96px)] font-semibold leading-none tracking-[-0.045em] text-ink">
              10
              <span className="self-center text-[0.28em] font-medium tracking-[-0.02em] text-ink-3">
                %
              </span>
            </h3>
            <p className="relative z-[1] m-0 -mt-2 text-sm tracking-[0.01em] text-ink-3">
              Por entrada · sin costo fijo
            </p>
            <p className="relative z-[1] m-0 max-w-[48ch] text-base leading-normal text-ink-2">
              Cargo al <b className="font-semibold text-ink">comprador</b>, no
              al local. Tú defines tu precio y recibes siempre el{" "}
              <b className="font-semibold text-ink">100% de ese monto</b>. El
              cargo de Pasape se suma aparte para el comprador, con tope de{" "}
              <b className="font-semibold text-ink">S/15 por transacción</b>.
            </p>
          </div>

          {/* Pilot */}
          <div className="reveal relative grid gap-4 overflow-hidden rounded-3xl border border-accent/45 bg-[linear-gradient(135deg,var(--color-bg-purple-deep)_0%,#240846_100%)] p-9 shadow-[0_0_0_1px_rgba(184,124,255,0.2),0_30px_60px_-20px_var(--color-accent-glow)] before:pointer-events-none before:absolute before:right-[-50%] before:top-[-50%] before:size-[400px] before:bg-[radial-gradient(closest-side,rgba(184,124,255,0.3),transparent_70%)] before:blur-[40px] before:content-[''] md:p-11">
            <div className="relative z-[1] flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Ahora mismo · Pilotos 2026
              </span>
              <span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset,0_0_18px_var(--color-accent-glow)]">
                Sin costo
              </span>
            </div>
            <h3 className="relative z-[1] m-0 flex items-baseline gap-2 text-balance font-display text-[clamp(56px,9vw,96px)] font-semibold leading-none tracking-[-0.045em] text-ink [text-shadow:0_0_32px_var(--color-accent-glow)]">
              <span className="self-start mt-[0.5em] text-[0.45em] font-medium text-ink-3">
                S/
              </span>
              0
              <span className="self-center text-[0.28em] font-medium tracking-[-0.02em] text-ink-2">
                durante el piloto
              </span>
            </h3>
            <p className="relative z-[1] m-0 max-w-[48ch] text-base leading-normal text-ink-2">
              Buscamos{" "}
              <b className="font-semibold text-ink">eventos seleccionados</b>{" "}
              para validar juntos. Sin costo, sin letra chica.
            </p>
            <div className="relative z-[1] mt-2">
              <Button
                href={waHref}
                target="_blank"
                aria-label="Postular mi evento — hablar por WhatsApp"
                leadingIcon={<Icon name="whatsapp" width={18} height={18} />}
                trailingIcon={
                  <Icon name="arrow-right" width={16} height={16} />
                }
              >
                Postular mi evento
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
