import { PanelDemo } from "./panel-demo";
import { BrowserFrame } from "./browser-frame";

/** Celular en móvil; panel web compacto en desktop (columna del hero). */
export function HeroPreview() {
  return (
    <div className="hero-preview reveal in">
      <div className="hero-preview-in-anim">
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
