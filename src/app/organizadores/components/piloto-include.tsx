import { SectionHeader } from "./ui/section-header";
import { CheckBadge } from "./ui/check-badge";

const PILOTO_ITEMS = [
  "Página pública del evento con link compartible",
  "Entradas digitales con QR único",
  "Combos: una compra, varios QR",
  "Promos automáticas (grupo, cumpleaños, box, 3x2)",
  "Validación en puerta desde la web",
  "Búsqueda manual por nombre, DNI o teléfono",
  "Panel del organizador en vivo",
  "Promotores con código o link de referido",
  "Top promotores y atribución de ventas",
  "Reporte simple del evento",
];

export function PilotoInclude() {
  return (
    <section id="piloto" className="py-24 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Qué incluye el piloto"
          title={
            <>
              Todo listo para correr <em>tu próximo evento.</em>
            </>
          }
        />
        <ul className="reveal mt-12 grid list-none grid-cols-1 gap-0 border-t border-line p-0 md:grid-cols-2 md:gap-x-14">
          {PILOTO_ITEMS.map((it) => (
            <li
              key={it}
              className="grid grid-cols-[24px_1fr] items-center gap-3.5 border-b border-line py-[18px] text-base text-ink-2"
            >
              <CheckBadge />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
