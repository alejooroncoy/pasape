import { PanelDemo } from "./panel-demo";
import { BrowserFrame } from "./browser-frame";

/** Panel real en mock de celular — portrait, scroll vertical como en la app. */
export function HeroPreview() {
  return (
    <div className="hero-preview reveal in">
      <div className="hero-preview-in-anim">
        <BrowserFrame url="pasape.lat" device="phone">
          <PanelDemo layout="stacked" />
        </BrowserFrame>
      </div>
    </div>
  );
}
