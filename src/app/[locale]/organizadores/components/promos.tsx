import { Icon } from "./icons";
import { QrSquare } from "./qr-square";
import { SectionHeader } from "./ui/section-header";
import { FeatureCard } from "./ui/feature-card";

const FEATURES = [
  {
    tag: "Promotores",
    title: "Cada promotor con su link. Sabes quién vendió qué.",
    payoff: "Ventas atribuidas por link, sin discutir comisión al cierre",
    icon: <Icon name="link" width={18} height={18} />,
    accent: true,
    wide: true,
    visual: (
      <div className="rounded-xl border border-cart-line bg-cart-bg/50 p-3">
        <div className="space-y-2">
          {[
            ["Promotor 1", "24 ventas", "S/ 1,440"],
            ["Promotor 2", "18 ventas", "S/ 1,080"],
          ].map(([code, sales, rev]) => (
            <div
              key={code}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-cart-line pb-2 text-[12px] last:border-0 last:pb-0"
            >
              <span className="font-medium text-cart-accent">{code}</span>
              <span className="font-mono text-cart-ink-3">{sales}</span>
              <span className="font-mono tabular-nums text-cart-ink">{rev}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: "Entradas y combos",
    title: "Una compra, varias entradas. Cada persona con su QR.",
    payoff: "Nadie comparte pantallazo de Yape: cada QR es único",
    icon: <Icon name="qr" width={18} height={18} />,
    visual: (
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-cart-line bg-cart-bg/40 px-1.5 py-2"
          >
            <div className="grid size-7 place-items-center rounded bg-white p-0.5">
              <QrSquare seedOffset={n + 3} />
            </div>
            <span className="font-mono text-[9px] text-cart-ink-4">{n}/3</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "Boxes y mesas",
    title: "Vende el box, el anfitrión invita a su grupo.",
    payoff: "El que paga reparte el acceso, tú solo validas en la puerta",
    icon: <Icon name="users" width={18} height={18} />,
    visual: (
      <div className="rounded-lg border border-dashed border-cart-accent/30 bg-cart-accent-soft px-3 py-2.5 text-center font-mono text-[11px] text-cart-ink-2">
        Host paga → link de invitación → 4/8 en el box
      </div>
    ),
  },
  {
    tag: "Preventa",
    title: "Sube el precio solo cuando tú lo decidas.",
    payoff: "Preventa, general y últimas entradas, sin cambiar nada a mano",
    icon: <Icon name="chart" width={18} height={18} />,
    visual: (
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-emerald-700">S/ 40</span>
        <span className="text-cart-ink-4">→</span>
        <span className="rounded-md border border-cart-line px-2 py-1 text-cart-ink-3 line-through">S/ 60</span>
      </div>
    ),
  },
  {
    tag: "Cortesías",
    title: "Invitados y prensa con QR, sin lista aparte.",
    payoff: "Nada de nombres sueltos en una libreta en la puerta",
    icon: <Icon name="gift" width={18} height={18} />,
    visual: (
      <div className="flex items-center justify-between rounded-lg border border-cart-line bg-cart-bg/40 px-3 py-2 font-mono text-[11px]">
        <span className="text-cart-ink-3">Hasta 23:00</span>
        <span className="font-semibold text-emerald-700">S/ 0</span>
      </div>
    ),
  },
] as const;

export function Promos() {
  const [hero, ...rest] = FEATURES;

  return (
    <section id="promos" className="relative bg-cart-bg-elev py-14 md:py-20">
      <div className="relative z-[1] mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Esto ya lo resuelves a mano"
          title={
            <>
              Lo que hoy haces con Excel y WhatsApp, <em>ahora con su propio link.</em>
            </>
          }
          lede="Sigues vendiendo igual — por WhatsApp, por Instagram, por tu promotor de confianza — pero cada venta llega con un link de compra, un QR por persona y un panel que te dice cómo va."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
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

          {rest.map((f) => (
            <FeatureCard
              key={f.tag}
              tag={f.tag}
              title={f.title}
              payoff={f.payoff}
              icon={f.icon}
              visual={f.visual}
              className="md:col-span-3"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
