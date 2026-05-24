import { WaIcon } from "./icons";
import { WA_HREF } from "./wa";

export function WaFloat() {
  return (
    <a
      href={WA_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar por WhatsApp"
      className="fixed bottom-5 right-5 z-[60] grid size-[52px] place-items-center rounded-full bg-cart-accent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_14px_38px_-8px_var(--color-cart-accent-glow-strong),0_0_24px_var(--color-cart-accent-glow)] transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 max-[560px]:hidden"
    >
      <WaIcon width={22} height={22} />
    </a>
  );
}
