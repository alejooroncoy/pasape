"use client";

import { useRef, useState } from "react";
import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";
import { FAQS } from "./faq-data";

/* El truco CSS-only de `grid-template-rows: 0fr -> 1fr` se queda pegado en
   el alto de una sola línea en este layout (limitación real del track
   sizing con `1fr` dentro de un contenedor de alto automático, no un typo).
   En vez de pelear con eso: medimos el alto real del contenido
   (`scrollHeight`) y animamos `max-height` a ese valor exacto — sencillo y
   siempre correcto, sin depender de cómo cada motor resuelva `fr`. */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState("0px");
  const contentRef = useRef<HTMLParagraphElement>(null);
  const panelId = `faq-panel-${q.length}-${q.slice(0, 8)}`;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setMaxHeight(next && contentRef.current ? `${contentRef.current.scrollHeight}px` : "0px");
  };

  return (
    <div className="reveal border-b border-cart-line md:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="grid w-full cursor-pointer grid-cols-[1fr_24px] items-center gap-4 rounded-xl border-0 bg-transparent py-5 text-left font-sans text-[clamp(16px,1.8vw,19px)] font-medium leading-snug tracking-[-0.012em] text-cart-ink transition-colors hover:text-cart-accent md:px-3 md:hover:bg-cart-bg-elev-2"
      >
        <span>{q}</span>
        <span
          className={`inline-flex text-cart-ink-3 transition-[transform,color] duration-200 ${
            open ? "rotate-90 text-cart-accent" : ""
          }`}
        >
          <Icon name="arrow-right" width={18} height={18} />
        </span>
      </button>
      <div
        id={panelId}
        style={{ maxHeight }}
        className="overflow-hidden transition-[max-height] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
      >
        <p
          ref={contentRef}
          className="m-0 max-w-[52ch] text-pretty px-0 pb-5 text-[15px] leading-relaxed text-cart-ink-3 md:px-3 md:pb-6"
        >
          {a}
        </p>
      </div>
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" className="border-t border-cart-line bg-cart-bg-elev py-14 md:py-20">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Preguntas frecuentes"
          title={
            <>
              Lo que <em>te estás preguntando.</em>
            </>
          }
        />
        <div className="mt-10 grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-x-10">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
