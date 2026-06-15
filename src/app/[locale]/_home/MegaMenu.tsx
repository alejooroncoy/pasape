"use client";

import { ArrowRightIcon } from "./icons";
import type { EventCategory } from "@/server/events/domain/Event";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import { CATEGORIES } from "./categories";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectCategory: (cat: EventCategory | null) => void;
};

export function MegaMenu({ open, onClose, onSelectCategory }: Props) {
  const events = useBrowseEvents();
  const featured = events.data?.[0];

  return (
    <div
      id="cart-mega"
      onClick={onClose}
      aria-hidden={!open}
      className={`absolute inset-x-0 top-full border-y border-cart-line bg-cart-bg-elev shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] transition-[opacity,transform,visibility] duration-200 ${
        open
          ? "visible translate-y-0 opacity-100"
          : "invisible -translate-y-1.5 opacity-0"
      }`}
    >
      <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
        <div className="grid grid-cols-[1.4fr_1fr] gap-10 py-8 max-[900px]:grid-cols-1 max-[900px]:gap-6">
          {/* Categorías reales */}
          <div onClick={(e) => e.stopPropagation()}>
            <h6 className="mb-4 text-[11.5px] font-medium uppercase tracking-[0.08em] text-cart-ink-4">
              Categorías
            </h6>
            <div className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
              {CATEGORIES.map(({ id, label, Icon, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { onSelectCategory(id); onClose(); }}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-cart-line hover:bg-cart-bg-elev-2"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 transition-colors"
                    style={{ color }}
                  >
                    <Icon width={18} height={18} />
                  </span>
                  <span className="text-[15px] font-medium text-cart-ink-2 transition-colors group-hover:text-white">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Panel destacado */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col justify-between border-l border-cart-line pl-10 max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:pl-0 max-[900px]:pt-6"
          >
            {featured ? (
              <>
                <div>
                  <h6 className="font-serif italic text-sm text-cart-accent">Destacado</h6>
                  <p className="mt-1.5 max-w-[26ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.015em] text-white">
                    {featured.title}
                  </p>
                  {featured.venue && (
                    <p className="mt-1 text-[13px] text-cart-ink-3">{featured.venue}</p>
                  )}
                </div>
                <a
                  href={`/events/${featured.slug}`}
                  className="mt-3.5 inline-flex items-center gap-2 self-start border-b border-cart-accent pb-1 text-sm font-medium text-cart-accent"
                >
                  Ver entradas
                  <ArrowRightIcon className="w-3 h-3" />
                </a>
              </>
            ) : (
              <p className="text-[13px] text-cart-ink-4 italic">Cargando…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
