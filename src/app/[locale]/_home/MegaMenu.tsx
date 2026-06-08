"use client";

import { ArrowRightIcon } from "./icons";
import type { EventCategory } from "@/server/events/domain/Event";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";

type CatKey = EventCategory | null;

const COLS: Array<{ title: string; items: Array<[string, CatKey]> }> = [
  {
    title: "Música",
    items: [
      ["Conciertos",   "musica"],
      ["Cumbia",       "musica"],
      ["Reggaetón",    "musica"],
      ["Jazz & Blues", "musica"],
      ["K-Pop",        "musica"],
      ["Electrónica",  "musica"],
    ],
  },
  {
    title: "Noche",
    items: [
      ["DJ Sets",      "dj_sets"],
      ["After-office", "after_office"],
      ["Karaoke",      null],
      ["Open mic",     null],
      ["Rooftop",      null],
    ],
  },
  {
    title: "Cultura",
    items: [
      ["Teatro",     "cultura"],
      ["Comedia",    "comedia"],
      ["Cine",       "cultura"],
      ["Arte & expo","cultura"],
      ["Charlas",    "cultura"],
    ],
  },
  {
    title: "Comida & deporte",
    items: [
      ["Gastronomía",      null],
      ["Cata de vino",     null],
      ["Pisco & mixología",null],
      ["Carreras & runs",  "deportes"],
      ["Deportes",         "deportes"],
    ],
  },
];

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
        <div className="grid grid-cols-[repeat(4,1fr)_1.3fr] gap-8 py-8 max-[1024px]:grid-cols-[repeat(2,1fr)_1.3fr] max-[1024px]:gap-6">
          {COLS.map((col) => (
            <div key={col.title} onClick={(e) => e.stopPropagation()}>
              <h6 className="mb-3 text-[11.5px] font-medium uppercase tracking-[0.08em] text-cart-ink-4">
                {col.title}
              </h6>
              <ul className="flex flex-col gap-2 list-none p-0 m-0">
                {col.items.map(([label, cat]) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => { onSelectCategory(cat); onClose(); }}
                      className="inline-flex w-full justify-between gap-3 whitespace-nowrap py-1 text-[14.5px] text-cart-ink-2 transition-colors hover:text-cart-accent"
                    >
                      {label}
                      {cat === null && (
                        <span className="text-[11px] text-cart-ink-4 italic">pronto</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Panel destacado */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col justify-between border-l border-cart-line pl-8 max-[1024px]:col-span-full max-[1024px]:flex-row max-[1024px]:items-center max-[1024px]:justify-between max-[1024px]:border-l-0 max-[1024px]:border-t max-[1024px]:pl-0 max-[1024px]:pt-6"
          >
            {featured ? (
              <>
                <div>
                  <h6 className="font-serif italic text-sm text-cart-accent">
                    Destacado
                  </h6>
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
