"use client";

import { ArrowRightIcon } from "./icons";

const COLS = [
  {
    title: "Música",
    items: [
      ["Conciertos", "68"],
      ["Cumbia", "14"],
      ["Reggaetón", "22"],
      ["Jazz & Blues", "9"],
      ["K-Pop", "6"],
      ["Electrónica", "17"],
    ],
  },
  {
    title: "Noche",
    items: [
      ["DJ Sets", "42"],
      ["After-office", "19"],
      ["Karaoke", "8"],
      ["Open mic", "5"],
      ["Rooftop", "11"],
    ],
  },
  {
    title: "Cultura",
    items: [
      ["Teatro", "12"],
      ["Comedia", "14"],
      ["Cine", "24"],
      ["Arte & expo", "31"],
      ["Charlas", "7"],
    ],
  },
  {
    title: "Comida & deporte",
    items: [
      ["Gastronomía", "42"],
      ["Cata de vino", "9"],
      ["Pisco & mixología", "11"],
      ["Carreras & runs", "8"],
      ["Deportes", "19"],
    ],
  },
];

export function MegaMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
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
                {col.items.map(([label, count]) => (
                  <li key={label}>
                    <a
                      href="#"
                      className="inline-flex justify-between gap-3 whitespace-nowrap py-1 text-[14.5px] text-cart-ink-2 transition-colors hover:text-cart-accent"
                    >
                      {label}
                      <span className="text-[12.5px] text-cart-ink-4">{count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col justify-between border-l border-cart-line pl-8 max-[1024px]:col-span-full max-[1024px]:flex-row max-[1024px]:items-center max-[1024px]:justify-between max-[1024px]:border-l-0 max-[1024px]:border-t max-[1024px]:pl-0 max-[1024px]:pt-6"
          >
            <div>
              <h6 className="font-serif italic text-sm text-cart-accent">
                Destacado de la semana
              </h6>
              <p className="mt-1.5 max-w-[26ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.015em] text-white">
                Festival <em className="font-serif italic font-normal text-cart-accent">Verano del Mar</em>
                {" "}· 9 artistas en Costa Verde.
              </p>
            </div>
            <a
              href="#"
              className="mt-3.5 inline-flex items-center gap-2 self-start border-b border-cart-accent pb-1 text-sm font-medium text-cart-accent"
            >
              Ver entradas
              <ArrowRightIcon className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
