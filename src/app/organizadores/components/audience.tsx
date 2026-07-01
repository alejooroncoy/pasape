import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

const AUDIENCE = [
  "Discotecas con combos, boxes y preventa",
  "Organizadores que manejan promotores y quieren medirlos",
  "Fiestas universitarias y por facultad",
  "Colectivos de eventos en Barranco y Miraflores",
  "Fiestas temáticas con preventa",
  "Organizadores independientes en Lima",
];

export function Audience() {
  return (
    <section id="para-quien" className="py-16 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Para quién es"
          title={
            <>
              Hecho para <em>quienes arman la noche en Lima.</em>
            </>
          }
        />
        <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3.5 lg:grid-cols-3">
          {AUDIENCE.map((a, i) => (
            <div
              key={a}
              className="reveal group relative grid grid-cols-[36px_1fr] items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0)),var(--color-bg-elev)] px-4 py-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent/40 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(184,124,255,0.06),transparent_60%)] before:opacity-0 before:transition-opacity hover:before:opacity-100 md:grid-cols-[40px_1fr_auto] md:gap-4 md:px-5 md:py-5"
            >
              <span className="relative z-10 font-serif text-[22px] italic leading-none text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="relative z-10 font-display text-[clamp(15px,1.7vw,17px)] font-medium leading-snug tracking-[-0.012em] text-ink">
                {a}
              </span>
              <span className="relative z-10 hidden text-ink-4 opacity-0 transition-[opacity,transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100 md:inline-flex">
                <Icon name="arrow-up-right" width={18} height={18} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
