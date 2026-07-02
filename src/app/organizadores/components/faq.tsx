import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

export const FAQS = [
  {
    q: "¿Necesito descargar una app?",
    a: "No. Pasape es 100% web. El organizador, staff y asistente pueden usarlo desde el navegador, en celular o laptop.",
  },
  {
    q: "¿Cuánto cuesta el piloto?",
    a: "Sin costo fijo. Solo cobramos 10% (tope S/15) por entrada pagada vendida por Pasape.",
  },
  {
    q: "¿Los pases gratis pagan comisión?",
    a: "No. Los QR gratuitos o pases de cortesía no pagan comisión.",
  },
  {
    q: "¿Cómo funcionan los combos?",
    a: "Una persona compra el combo y Pasape genera QR separados para cada amigo. Cada QR se valida por separado en puerta.",
  },
  {
    q: "¿Cómo mido a mis promotores?",
    a: "Cada promotor tiene su link único y su código. Toda venta que entre por ahí queda atribuida a él, sin discutir. Y si no tienes promotores, vendes solo con el link de tu evento.",
  },
  {
    q: "¿Cómo se valida en puerta?",
    a: "Desde web, escaneando el QR. Si alguien no encuentra su QR, el staff puede buscar por nombre, DNI o teléfono.",
  },
  {
    q: "¿Cualquiera puede publicar un evento?",
    a: "Puedes crear tu evento rápido, pero las ventas se activan después de una revisión simple de Pasape. Esto ayuda a evitar eventos falsos y proteger a compradores y organizadores.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-line bg-bg-elev/15 py-14 md:py-20">
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
              className="group reveal border-b border-line md:border-b-0"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_24px] items-center gap-4 rounded-xl py-5 font-display text-[clamp(16px,1.8vw,19px)] font-medium leading-snug tracking-[-0.012em] text-ink transition-colors hover:text-accent marker:content-[''] md:px-3 md:hover:bg-white/[0.03]">
                <span>{f.q}</span>
                <span className="inline-flex text-ink-3 transition-[transform,color] duration-200 group-open:rotate-90 group-open:text-accent">
                  <Icon name="arrow-right" width={18} height={18} />
                </span>
              </summary>
              <p className="m-0 max-w-[52ch] text-pretty px-0 pb-5 text-[15px] leading-relaxed text-ink-3 md:px-3 md:pb-6">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
