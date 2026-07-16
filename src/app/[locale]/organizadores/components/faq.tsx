import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";
import { FAQS } from "./faq-data";

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
            <details
              key={f.q}
              className="group reveal border-b border-cart-line md:border-b-0"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_24px] items-center gap-4 rounded-xl py-5 font-sans text-[clamp(16px,1.8vw,19px)] font-medium leading-snug tracking-[-0.012em] text-cart-ink transition-colors hover:text-cart-accent marker:content-[''] md:px-3 md:hover:bg-cart-bg-elev-2">
                <span>{f.q}</span>
                <span className="inline-flex text-cart-ink-3 transition-[transform,color] duration-200 group-open:rotate-90 group-open:text-cart-accent">
                  <Icon name="arrow-right" width={18} height={18} />
                </span>
              </summary>
              <p className="m-0 max-w-[52ch] text-pretty px-0 pb-5 text-[15px] leading-relaxed text-cart-ink-3 md:px-3 md:pb-6">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
