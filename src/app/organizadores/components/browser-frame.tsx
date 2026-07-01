import type { ReactNode } from "react";

/** Marco de navegador minimalista para presentar capturas/demos de producto real. */
export function BrowserFrame({
  url = "app.pasape.lat",
  children,
}: {
  url?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-strong bg-bg-elev-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-3 border-b border-line bg-bg-elev/60 px-3.5 py-2.5">
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
      <div className="bg-bg p-3 lg:p-4">{children}</div>
    </div>
  );
}
