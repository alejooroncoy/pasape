import { SectionHeader } from "./ui/section-header";
import { PanelDemo } from "./panel-demo";
import { BrowserFrame } from "./browser-frame";

export function PanelReporte() {
  return (
    <section id="panel" className="py-14 md:py-20">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Panel en vivo"
          title={
            <>
              Cómo va tu evento, <em>sin llamar a nadie.</em>
            </>
          }
          lede="Ventas, promotores y quién ya entró, actualizado al momento, no el reporte que alguien te arma a mano al día siguiente."
        />

        <div className="reveal relative mt-10">
          <div className="md:hidden">
            <BrowserFrame url="pasape.lat/org/events/evento-demo" device="phone">
              <PanelDemo layout="stacked" />
            </BrowserFrame>
          </div>
          <div className="hidden md:block">
            <BrowserFrame url="pasape.lat/org/events/evento-demo">
              <PanelDemo layout="grid" />
            </BrowserFrame>
          </div>
        </div>
        <p className="reveal mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-cart-ink-4">
          Así se ve tu evento en vivo · datos de un evento de prueba
        </p>
      </div>
    </section>
  );
}
