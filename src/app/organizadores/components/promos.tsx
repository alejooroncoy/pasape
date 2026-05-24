import { SectionHeader } from "./ui/section-header";

type Step = { label: string; strong?: boolean };
type Promo = {
  tag: string;
  title: string;
  steps: Step[];
  final: string;
  wide?: boolean;
};

const PROMOS: Promo[] = [
  {
    tag: "Promotores medidos en vivo",
    title: "Cada promotor con su link. Atribución sin discusión.",
    steps: [
      { label: "Cada promotor recibe su link único y su código" },
      {
        label:
          "Toda venta que entra por ahí queda atribuida automáticamente — sin que él reporte nada",
        strong: true,
      },
      {
        label:
          "En el panel ves su ranking en vivo: entradas vendidas, monto cobrado y qué combos movió",
      },
      {
        label:
          "Al cierre, cuánto le toca de comisión sale del mismo reporte — sin Excel ni capturas",
      },
    ],
    final: "Cero \"vendí más de lo que dice el sistema\"",
    wide: true,
  },
  {
    tag: "Grupo de 6 chicas",
    title: "Grupo entra completo, botella va de la casa.",
    steps: [
      { label: "Grupo de 6 chicas", strong: true },
      { label: "Promoción: botella gratis incluida" },
      { label: "QR con promo activada automáticamente" },
    ],
    final: "Sin revisar nada en puerta",
  },
  {
    tag: "Cumpleañero",
    title: "El cumpleañero entra como cumpleañero.",
    steps: [
      { label: "Compra con DNI" },
      { label: "DNI verificado vs. fecha de nacimiento", strong: true },
      { label: "Promo activada sin que nadie revise" },
    ],
    final: 'Cero "oye, mi cumple es hoy"',
  },
  {
    tag: "Box para 8",
    title: "Cada amigo paga su parte. El box se confirma solo.",
    steps: [
      { label: "Tú armas un box para 8" },
      { label: "Cada amigo paga su parte por su QR", strong: true },
      { label: "Se confirma solo cuando completan" },
    ],
    final: "Sin chasquear el yape grupal",
  },
  {
    tag: "Combo 3x2",
    title: "Una compra, tres entradas, tres QR distintos.",
    steps: [
      { label: "Una persona compra el 3x2" },
      { label: "Pasape genera 3 QR separados", strong: true },
      { label: "Cada uno entra con el suyo" },
    ],
    final: "Sin reenviar capturas",
  },
];

export function Promos() {
  return (
    <section
      id="promos"
      className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-purple-deeper)_50%,var(--color-bg)_100%)] py-24 md:py-30 before:pointer-events-none before:absolute before:left-1/2 before:top-[30%] before:h-[500px] before:w-[800px] before:-translate-x-1/2 before:bg-[radial-gradient(ellipse,rgba(184,124,255,0.18),transparent_70%)] before:blur-[80px] before:content-['']"
    >
      <div className="relative z-[1] mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Promos que se gestionan solas"
          title={
            <>
              Arma tu promo una vez. <em>Pasape hace el resto.</em>
            </>
          }
          lede="Grupos, cumpleañeros, boxes y combos: las reglas las pones tú, la lógica la corre Pasape. Sin revisar capturas, sin contestar el mismo DM diez veces."
        />
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {PROMOS.map((p) => (
            <article
              key={p.tag}
              className={`reveal relative grid gap-[18px] overflow-hidden rounded-[18px] border bg-[linear-gradient(180deg,rgba(26,10,46,0.6),rgba(18,18,26,0.95))] p-6 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_var(--color-accent-glow)] ${
                p.wide
                  ? "border-accent/40 shadow-[0_16px_40px_-18px_var(--color-accent-glow)] hover:border-accent/60 md:col-span-2"
                  : "border-line-strong hover:border-accent/45"
              }`}
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                {p.tag}
              </span>
              <h3 className="m-0 text-balance font-display text-[22px] font-semibold leading-tight tracking-[-0.016em] text-ink">
                {p.title}
              </h3>
              <div className="grid gap-2.5 pt-1.5">
                {p.steps.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[20px_1fr] items-start gap-2.5 text-sm leading-snug text-ink-2"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-px font-mono font-bold text-accent"
                    >
                      {i === 0 ? "·" : "↳"}
                    </span>
                    <span>
                      {s.strong ? (
                        <b className="font-semibold text-ink">{s.label}</b>
                      ) : (
                        s.label
                      )}
                    </span>
                  </div>
                ))}
                <div className="mt-1.5 grid grid-cols-[14px_1fr] items-start gap-2.5 rounded-[10px] border border-accent/30 bg-accent/10 px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-[0.08em] text-accent">
                  <span aria-hidden="true" className="mt-px font-bold">
                    ✓
                  </span>
                  <span>{p.final}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
