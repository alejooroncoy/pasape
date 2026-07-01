import { Icon } from "./icons";
import { QrSquare } from "./qr-square";
import { SectionHeader } from "./ui/section-header";
import { FeatureCard } from "./ui/feature-card";

const FEATURES = [
  {
    tag: "Promotores",
    title: "Cada promotor con su link. Atribución sin discusión.",
    payoff: 'Cero "vendí más de lo que dice el sistema"',
    icon: <Icon name="link" width={18} height={18} />,
    accent: true,
    wide: true,
    visual: (
      <div className="rounded-xl border border-line bg-bg/50 p-3">
        <div className="space-y-2">
          {[
            ["Promotor 1", "24 ventas", "S/ 1,440"],
            ["Promotor 2", "18 ventas", "S/ 1,080"],
          ].map(([code, sales, rev]) => (
            <div
              key={code}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line pb-2 text-[12px] last:border-0 last:pb-0"
            >
              <span className="font-medium text-accent">{code}</span>
              <span className="font-mono text-ink-3">{sales}</span>
              <span className="font-mono tabular-nums text-ink">{rev}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: "Combo 2x1",
    title: "Dos entran, pagan uno. Dos QR listos.",
    payoff: "Sin cobrar mitad y mitad en puerta",
    icon: <Icon name="qr" width={18} height={18} />,
    visual: (
      <div className="flex gap-2">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-bg/40 px-2 py-2"
          >
            <div className="grid size-8 place-items-center rounded bg-white p-0.5">
              <QrSquare seedOffset={n} />
            </div>
            <span className="font-mono text-[10px] text-ink-3">QR {n}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "Combo 3x2",
    title: "Una compra, tres entradas, tres QR distintos.",
    payoff: "Sin reenviar capturas",
    icon: <Icon name="share" width={18} height={18} />,
    visual: (
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-line bg-bg/40 px-1.5 py-2"
          >
            <div className="grid size-7 place-items-center rounded bg-white p-0.5">
              <QrSquare seedOffset={n + 3} />
            </div>
            <span className="font-mono text-[9px] text-ink-4">{n}/3</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "Box",
    title: "Comprás el espacio, invitás por link. Cada uno con su QR.",
    payoff: "Sin capturas ni lista en el grupo",
    icon: <Icon name="users" width={18} height={18} />,
    visual: (
      <div className="rounded-lg border border-dashed border-accent/30 bg-accent/[0.06] px-3 py-2.5 text-center font-mono text-[11px] text-ink-2">
        Host paga → link de invitación → 4/8 en el box
      </div>
    ),
  },
  {
    tag: "Preventa",
    title: "Precio bajo al inicio. Sube solo cuando toca.",
    payoff: "Sin cambiar precios a mano en WhatsApp",
    icon: <Icon name="chart" width={18} height={18} />,
    visual: (
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-300">S/ 40</span>
        <span className="text-ink-4">→</span>
        <span className="rounded-md border border-line px-2 py-1 text-ink-3 line-through">S/ 60</span>
      </div>
    ),
  },
  {
    tag: "Entrada liberada",
    title: "Gratis hasta la hora que digas. Luego vuelve al precio.",
    payoff: 'Cero "¿ya no es gratis?"',
    icon: <Icon name="gift" width={18} height={18} />,
    visual: (
      <div className="flex items-center justify-between rounded-lg border border-line bg-bg/40 px-3 py-2 font-mono text-[11px]">
        <span className="text-ink-3">Hasta 23:00</span>
        <span className="font-semibold text-emerald-300">S/ 0</span>
      </div>
    ),
  },
] as const;

export function Promos() {
  const [hero, ...rest] = FEATURES;

  return (
    <section
      id="promos"
      className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-bg)_0%,var(--color-bg-purple-deeper)_45%,var(--color-bg)_100%)] py-24 md:py-30"
    >
      <div className="pointer-events-none absolute left-1/2 top-[20%] h-[520px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(184,124,255,0.14),transparent_70%)] blur-[90px]" />

      <div className="relative z-[1] mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Lo que ya puedes usar"
          title={
            <>
              Todo lo que armamos. <em>Listo para tu evento.</em>
            </>
          }
          lede="Combos, preventas, boxes y promotores — configurado una vez, corre solo. Sin capturas, sin Excel, sin el mismo DM diez veces."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
          <FeatureCard
            tag={hero.tag}
            title={hero.title}
            payoff={hero.payoff}
            icon={hero.icon}
            accent={hero.accent}
            wide
            visual={hero.visual}
            className="md:col-span-6"
          />

          {rest.map((f, i) => (
            <FeatureCard
              key={f.tag}
              tag={f.tag}
              title={f.title}
              payoff={f.payoff}
              icon={f.icon}
              visual={f.visual}
              className={`md:col-span-2 ${i >= 3 ? "md:col-span-3" : ""}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
