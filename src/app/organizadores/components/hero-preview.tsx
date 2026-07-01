import { PanelDemo } from "./panel-demo";
import { BrowserFrame } from "./browser-frame";

/** El panel real de organizador (mismos componentes, data de prueba) — un solo elemento visual. */
export function HeroPreview() {
  return (
    <div className="hero-preview reveal in">
      <div className="hero-preview-in-anim">
        <BrowserFrame url="pasape.lat">
          <PanelDemo compact />
        </BrowserFrame>
      </div>
    </div>
  );
}
