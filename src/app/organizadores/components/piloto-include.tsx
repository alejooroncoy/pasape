import { SectionHeader } from "./ui/section-header";
import { CheckBadge } from "./ui/check-badge";

const GROUPS = [
  {
    label: "Venta",
    items: [
      "Página pública del evento con link compartible",
      "Entradas digitales con QR único",
      "Combos 2x1 y 3x2: una compra, varios QR",
      "Preventa y liberación gratis por fecha",
      "Boxes y mesas con invitación por link",
    ],
  },
  {
    label: "Puerta y control",
    items: [
      "Validación en puerta desde la web",
      "Búsqueda manual por nombre, DNI o teléfono",
      "Panel del organizador en vivo",
    ],
  },
  {
    label: "Promotores",
    items: [
      "Promotores con código o link de referido",
      "Top promotores y atribución de ventas",
      "Reporte simple del evento",
    ],
  },
] as const;

export function PilotoInclude() {
  return (
    <section id="piloto" className="border-y border-line bg-bg-elev/30 py-16 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Qué incluye el piloto"
          title={
            <>
              Todo listo para correr <em>tu próximo evento.</em>
            </>
          }
          lede="Sin costo fijo durante el piloto. Esto es lo que ya está construido y listo para usar."
        />

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {GROUPS.map((g) => (
            <div
              key={g.label}
              className="reveal rounded-[20px] border border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent),var(--color-bg-elev)] p-6"
            >
              <p className="m-0 mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                {g.label}
              </p>
              <ul className="m-0 grid list-none gap-0 p-0">
                {g.items.map((it) => (
                  <li
                    key={it}
                    className="grid grid-cols-[22px_1fr] items-start gap-3 border-t border-line py-3.5 text-[15px] leading-snug text-ink-2 first:border-t-0 first:pt-0"
                  >
                    <CheckBadge />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
