import { PanelDemo } from "./panel-demo";
import { BrowserFrame } from "./browser-frame";

/** Celular en móvil; panel web compacto en desktop (columna del hero). */
export function HeroPreview() {
  return (
    <div className="reveal in mx-auto w-full max-w-[min(320px,82vw)] lg:max-w-none">
      <div>
        <div className="lg:hidden">
          <BrowserFrame url="pasape.lat" device="phone">
            <PanelDemo layout="stacked" />
          </BrowserFrame>
        </div>
        <div className="hidden lg:block">
          <BrowserFrame url="pasape.lat/org/events/evento-demo">
            <PanelDemo layout="hero" />
          </BrowserFrame>
        </div>
      </div>
    </div>
  );
}
