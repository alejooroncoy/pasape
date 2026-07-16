import type { ReactNode } from "react";

type Props = {
  url?: string;
  children: ReactNode;
  /** `phone` = mock vertical tipo celular; `browser` = marco desktop */
  device?: "browser" | "phone";
};

/** Marco para presentar el demo del producto — celular en portrait o navegador. */
export function BrowserFrame({
  url = "pasape.lat",
  children,
  device = "browser",
}: Props) {
  if (device === "phone") {
    return (
      <div className="phone-frame mx-auto w-full max-w-[min(280px,80vw)]">
        <div className="phone-frame-shell overflow-hidden rounded-[26px] border border-cart-line-strong bg-cart-bg-elev-2 shadow-[0_24px_48px_-24px_rgba(20,16,38,0.3),0_0_0_1px_rgba(124,58,237,0.08)]">
          <div className="browser-frame-grain" aria-hidden="true" />
          <div className="relative flex items-center justify-between border-b border-cart-line bg-cart-bg-elev/80 px-4 pb-1.5 pt-2">
            <span className="font-mono text-[10px] font-medium tabular-nums text-cart-ink-3">9:41</span>
            <div className="absolute left-1/2 top-1.5 h-[16px] w-[64px] -translate-x-1/2 rounded-full bg-cart-bg" aria-hidden="true" />
            <div className="flex items-center gap-1.5 text-cart-ink-3" aria-hidden="true">
              <span className="h-2 w-3 rounded-[2px] border border-current opacity-70" />
              <span className="size-2 rounded-full border border-current opacity-70" />
            </div>
          </div>
          <div className="relative flex items-center gap-1.5 border-b border-cart-line bg-cart-bg-elev/50 px-3 py-1.5">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0 text-cart-ink-4">
              <rect x="2" y="4.5" width="6" height="4" rx="1" stroke="currentColor" />
              <path d="M3.2 4.5V3a1.8 1.8 0 0 1 3.6 0v1.5" stroke="currentColor" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-cart-ink-3">{url}</span>
          </div>
          <div className="relative bg-cart-bg p-2.5">
            {children}
          </div>
          <div className="flex justify-center border-t border-cart-line bg-cart-bg-elev/40 py-1.5" aria-hidden="true">
            <span className="h-1 w-20 rounded-full bg-cart-ink/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cart-line-strong bg-cart-bg-elev-2 shadow-[0_24px_48px_-24px_rgba(20,16,38,0.25)]">
      <div className="browser-frame-grain" aria-hidden="true" />
      <div className="relative flex items-center gap-3 border-b border-cart-line bg-cart-bg-elev/60 px-3.5 py-2.5">
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-cart-ink/15" />
          <span className="size-2.5 rounded-full bg-cart-ink/15" />
          <span className="size-2.5 rounded-full bg-cart-ink/15" />
        </div>
        <div className="mx-auto flex min-w-0 max-w-[260px] flex-1 items-center justify-center gap-1.5 rounded-full bg-cart-bg/60 px-3 py-1 text-[11px] text-cart-ink-4">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-cart-ink-4">
            <rect x="2" y="4.5" width="6" height="4" rx="1" stroke="currentColor" />
            <path d="M3.2 4.5V3a1.8 1.8 0 0 1 3.6 0v1.5" stroke="currentColor" />
          </svg>
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative bg-cart-bg p-3 lg:p-4">{children}</div>
    </div>
  );
}
