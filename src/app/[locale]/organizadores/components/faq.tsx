import { Icon } from "./icons";
import { SectionHeader } from "./ui/section-header";

export const FAQS = [
  {
    q: "¿Pasape es solo una ticketera?",
    a: "No. Pasape vende entradas, pero está pensado como sistema operativo del evento: pagos, QR, boxes, cortesías, promotores, reportes y control de acceso en un solo lugar.",
  },
  {
    q: "¿Cuánto cuesta el piloto?",
    a: "Sin costo fijo. Cobramos 10% por entrada de pago (mínimo S/3), y baja a 5% en la parte que supere S/300. Lo paga el comprador, tú recibes el 100% de tu precio.",
  },
  {
    q: "¿Necesito descargar una app?",
    a: "No. Pasape es 100% web. El organizador, staff y asistente pueden usarlo desde el navegador, en celular o laptop.",
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
    q: "¿Me ayuda a vender más?",
    a: "Pasape no garantiza ventas ni llena eventos por sí solo. Lo que sí hace es reducir fricción en la compra, ordenar tus canales y darte datos para decidir mejor.",
  },
  {
    q: "¿Cómo mido mis canales o promotores?",
    a: "Cada canal o promotor puede tener su link único y su código. Toda venta que entre por ahí queda atribuida, sin discutir. Y si no tienes promotores, vendes solo con el link de tu evento.",
  },
  {
    q: "¿Cómo se valida en puerta?",
    a: "Con la app del portero, que funciona incluso sin internet. Si alguien no encuentra su QR, el staff puede buscarlo por nombre o DNI.",
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
