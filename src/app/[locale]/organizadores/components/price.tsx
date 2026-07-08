import { Button } from "./ui/button";
import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

export function Price({ waHref }: { waHref: string }) {
  return (
    <section id="precio" className="py-14 md:py-20">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Precio"
          title={
            <>
              Empieza sin costo fijo. <em>Escala cuando vendas.</em>
            </>
          }
          lede="Pasape se alinea con tu venta: no pagas implementación ni mensualidad para lanzar. En pilotos seleccionados, validamos juntos la operación completa."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-[1fr_1.1fr] md:gap-[22px]">
          {/* Piloto primero en móvil */}
          <div className="reveal relative order-1 grid gap-5 overflow-hidden rounded-[22px] border border-accent/45 bg-[linear-gradient(135deg,var(--color-bg-purple-deep)_0%,#240846_100%)] p-6 shadow-[0_0_0_1px_rgba(184,124,255,0.2),0_30px_60px_-20px_var(--color-accent-glow)] before:pointer-events-none before:absolute before:right-[-50%] before:top-[-50%] before:size-[400px] before:bg-[radial-gradient(closest-side,rgba(184,124,255,0.3),transparent_70%)] before:blur-[40px] before:content-[''] md:order-2 md:rounded-3xl md:p-11">
            <div className="relative z-[1] flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent sm:tracking-[0.2em]">
                Ahora mismo · Pilotos 2026
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-accent px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset,0_0_18px_var(--color-accent-glow)]">
                Sin costo
              </span>
            </div>

            <div className="relative z-[1]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[clamp(22px,5vw,32px)] font-medium text-ink-3">S/</span>
                <span className="font-display text-[clamp(64px,18vw,96px)] font-semibold leading-none tracking-[-0.045em] text-ink [text-shadow:0_0_32px_var(--color-accent-glow)]">
                  0
                </span>
              </div>
              <p className="m-0 mt-2 text-[15px] text-ink-2">durante el piloto</p>
            </div>

            <p className="relative z-[1] m-0 text-[15px] leading-normal text-ink-2 md:text-base">
              Buscamos{" "}
              <b className="font-semibold text-ink">eventos seleccionados</b>{" "}
              para optimizar ventas, pagos, QR, accesos y reportes junto a
              organizadores reales.
            </p>

            <div className="relative z-[1]">
              <Button
                href={waHref}
                target="_blank"
                aria-label="Postular mi evento — hablar por WhatsApp"
                leadingIcon={<Icon name="whatsapp" width={18} height={18} />}
                trailingIcon={<Icon name="arrow-right" width={16} height={16} />}
                className="w-full justify-center sm:w-auto"
              >
                Quiero hacer un piloto
              </Button>
            </div>
          </div>

          {/* Plan Free */}
          <div className="reveal relative order-2 grid gap-5 overflow-hidden rounded-[22px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0)),var(--color-bg-elev)] p-6 md:order-1 md:rounded-3xl md:p-11">
            <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3 sm:tracking-[0.2em]">
                Plan Free
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-line-strong bg-transparent px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Lo paga el comprador
              </span>
            </div>

            <div>
              <h3 className="m-0 flex items-baseline gap-1 font-display text-[clamp(64px,18vw,96px)] font-semibold leading-none tracking-[-0.045em] text-ink">
                10
                <span className="text-[0.32em] font-medium tracking-[-0.02em] text-ink-3">%</span>
              </h3>
              <p className="m-0 mt-2 text-[15px] text-ink-3">Por entrada de pago · sin costo fijo</p>
            </div>

            <p className="m-0 text-[15px] leading-normal text-ink-2 md:text-base">
              Paga quien compra, no tú: recibes el{" "}
              <b className="font-semibold text-ink">100% de tu precio</b>. Pasape cobra aparte al
              comprador, desde <b className="font-semibold text-ink">S/3</b>, y baja a{" "}
              <b className="font-semibold text-ink">5%</b> en entradas de más de S/300.
            </p>
            <p className="m-0 text-[13px] leading-normal text-ink-3">
              En los pilotos 2026 el 10% aplica solo a{" "}
              <b className="font-medium text-ink-2">entradas de pago</b> — las entradas gratis
              no suman comisión.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
