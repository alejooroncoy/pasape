"use client";

import { use } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useEvent, useBrowseEvents } from "@/lib/events/hooks/useEvents";

type Props = { params: Promise<{ slug: string }> };

export default function BuyerSoldOutPage({ params }: Props) {
  const { slug } = use(params);
  const { data } = useEvent(slug);
  const browse = useBrowseEvents();
  const router = useRouter();

  const suggestions = (browse.data ?? [])
    .filter((e) => e.slug !== slug && e.status === "published")
    .slice(0, 3);

  return (
    <div className="home-light min-h-dvh bg-cart-bg text-cart-ink">
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3.5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-cart-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[12.5px] text-cart-ink-3">Agotado</span>
          <span className="size-9" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-5 pt-10 pb-16 lg:max-w-[520px]">
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-300">
          <span className="size-1.5 animate-pulse rounded-full bg-rose-400" />
          Agotado
        </span>

        <h1 className="mt-4 text-[36px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[42px]">
          Se acabaron las entradas
        </h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-cart-ink-2">
          <strong className="text-cart-ink">{data?.event.title ?? "Este evento"}</strong> está lleno. Si alguien transfiere su entrada te avisamos.
        </p>

        <button
          type="button"
          className="mt-6 w-full rounded-full border border-cart-line bg-cart-bg-elev py-3 text-[14px] font-semibold text-cart-ink transition hover:border-cart-accent"
        >
          Avísame si hay cupos
        </button>

        {suggestions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Prueba estos eventos
            </h2>
            <div className="mt-3 flex flex-col gap-2.5">
              {suggestions.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/events/${ev.slug}` as never}
                  className="group flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev p-3 transition hover:border-cart-line-strong"
                >
                  <div
                    className="size-14 flex-shrink-0 overflow-hidden rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 100%)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">
                      {ev.title}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-cart-ink-3">
                      {ev.venue ?? "Sin lugar definido"}
                    </div>
                  </div>
                  <span className="text-cart-ink-3 transition group-hover:text-cart-accent">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
