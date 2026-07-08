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
              Decide con datos. <em>No al día siguiente.</em>
            </>
          }
          lede="Ventas, accesos, tickets, boxes, cortesías y promotores corriendo en vivo. Si una etapa no avanza, lo ves a tiempo y puedes actuar antes del cierre."
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
        <p className="reveal mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">
          Centro de control del organizador · evento de prueba
        </p>
      </div>
    </section>
  );
}
