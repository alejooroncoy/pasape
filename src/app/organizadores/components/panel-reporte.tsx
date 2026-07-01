import { SectionHeader } from "./ui/section-header";
import { PanelDemo } from "./panel-demo";
import { BrowserFrame } from "./browser-frame";

export function PanelReporte() {
  return (
    <section id="panel" className="py-16 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Panel en vivo"
          title={
            <>
              Tu fiesta en tiempo real. <em>No al día siguiente.</em>
            </>
          }
          lede="Ventas, accesos, combos y promotores corriendo en vivo. Al cierre tienes un reporte — no capturas sueltas ni un Excel a las 4 a.m."
        />

        <div className="reveal relative mt-12">
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
        <p className="reveal mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">
          El panel real de organizador · evento de prueba
        </p>
      </div>
    </section>
  );
}
