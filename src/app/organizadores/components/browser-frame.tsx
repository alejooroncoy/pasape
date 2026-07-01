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
      <div className="phone-frame mx-auto w-full max-w-[min(340px,92vw)]">
        <div className="phone-frame-shell overflow-hidden rounded-[28px] border border-line-strong bg-bg-elev-2 shadow-[0_32px_64px_-28px_rgba(0,0,0,0.85),0_0_0_1px_rgba(184,124,255,0.12)]">
          <div className="browser-frame-grain" aria-hidden="true" />
          <div className="relative flex items-center justify-between border-b border-line bg-bg-elev/80 px-5 pb-2 pt-3">
            <span className="font-mono text-[11px] font-medium tabular-nums text-ink-3">9:41</span>
            <div className="absolute left-1/2 top-2 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-bg" aria-hidden="true" />
            <div className="flex items-center gap-1.5 text-ink-3" aria-hidden="true">
              <span className="h-2 w-3 rounded-[2px] border border-current opacity-70" />
              <span className="size-2 rounded-full border border-current opacity-70" />
            </div>
          </div>
          <div className="relative flex items-center gap-2 border-b border-line bg-bg-elev/50 px-3 py-2">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-ink-4">
              <rect x="2" y="4.5" width="6" height="4" rx="1" stroke="currentColor" />
              <path d="M3.2 4.5V3a1.8 1.8 0 0 1 3.6 0v1.5" stroke="currentColor" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-center font-mono text-[11px] text-ink-3">{url}</span>
          </div>
          <div className="relative max-h-[min(72vh,640px)] overflow-y-auto bg-bg p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
          <div className="flex justify-center border-t border-line bg-bg-elev/40 py-2" aria-hidden="true">
            <span className="h-1 w-28 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-bg-elev-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]">
      <div className="browser-frame-grain" aria-hidden="true" />
      <div className="relative flex items-center gap-3 border-b border-line bg-bg-elev/60 px-3.5 py-2.5">
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <div className="mx-auto flex min-w-0 max-w-[260px] flex-1 items-center justify-center gap-1.5 rounded-full bg-bg/60 px-3 py-1 text-[11px] text-ink-4">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-ink-4">
            <rect x="2" y="4.5" width="6" height="4" rx="1" stroke="currentColor" />
            <path d="M3.2 4.5V3a1.8 1.8 0 0 1 3.6 0v1.5" stroke="currentColor" />
          </svg>
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative bg-bg p-3 lg:p-4">{children}</div>
    </div>
  );
}
