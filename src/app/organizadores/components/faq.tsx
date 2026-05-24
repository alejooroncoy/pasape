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
    a: "Cada promotor tiene su link único y su código. Toda venta que entre por ahí queda atribuida a él. Al cierre ves cuánto vendió cada uno, sin discutir.",
  },
  {
    q: "¿Y si no tengo promotores?",
    a: "Activas el sistema de referidos. Tus asistentes invitan con su propio link y ganan puntos o beneficios. Tú decides la mecánica.",
  },
  {
    q: "¿Cómo se valida en puerta?",
    a: "Desde web, escaneando el QR. Si alguien no encuentra su QR, el staff puede buscar por nombre, DNI o teléfono.",
  },
  {
    q: "¿Cualquiera puede publicar un evento?",
    a: "Puedes crear tu evento rápido, pero las ventas se activan después de una revisión simple de Pasape. Esto ayuda a evitar eventos falsos y proteger a compradores y organizadores.",
  },
  {
    q: "¿Pasape reemplaza a Joinnus?",
    a: "Pasape está hecho para fiestas que necesitan combos, promotores medidos y orden en puerta. No es solo publicar entradas.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-24 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Preguntas frecuentes"
          title={
            <>
              Lo que <em>te estás preguntando.</em>
            </>
          }
        />
        <div className="mt-12 border-t border-line">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group reveal border-b border-line"
            >
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_24px] items-center gap-4 py-6 font-display text-[clamp(18px,2vw,21px)] font-medium leading-snug tracking-[-0.012em] text-ink transition-colors hover:text-accent marker:content-['']">
                <span>{f.q}</span>
                <span className="inline-flex text-ink-3 transition-[transform,color] duration-200 group-open:rotate-90 group-open:text-accent">
                  <Icon name="arrow-right" width={18} height={18} />
                </span>
              </summary>
              <p className="m-0 max-w-[64ch] text-pretty pb-6 text-base leading-relaxed text-ink-3">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
