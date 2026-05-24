import { AfterIcon, ComedyIcon, CultureIcon, DjIcon, MusicIcon, SportIcon } from "./icons";

const CATS = [
  { name: "Música", note: "Próximamente", Icon: MusicIcon },
  { name: "DJ Sets", note: "Próximamente", Icon: DjIcon },
  { name: "After-office", note: "Próximamente", Icon: AfterIcon },
  { name: "Comedia", note: "Próximamente", Icon: ComedyIcon },
  { name: "Cultura", note: "Próximamente", Icon: CultureIcon },
  { name: "Deportes", note: "Próximamente", Icon: SportIcon },
];

export function CategoriesSection() {
  return (
    <section id="categorias" className="relative pt-[clamp(56px,8vw,96px)]">
      <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
        <div className="mb-[clamp(20px,3vw,32px)] flex items-end justify-between gap-6 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-3.5">
          <div>
            <p className="m-0 mb-2 font-serif text-base italic font-normal text-cart-accent">
              Explora
            </p>
            <h2 className="m-0 font-sans text-[clamp(32px,4.4vw,52px)] font-semibold leading-none tracking-[-0.02em]">
              Por{" "}
              <em
                className="font-serif italic font-normal text-cart-accent"
                style={{ textShadow: "0 0 28px var(--color-cart-accent-glow)" }}
              >
                categoría
              </em>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3 max-[900px]:grid-cols-3 max-[560px]:grid-cols-2">
          {CATS.map(({ name, note, Icon }) => (
            <div
              key={name}
              className="group relative flex cursor-default flex-col gap-3.5 overflow-hidden rounded-[14px] border border-cart-line bg-cart-bg-elev px-[18px] py-[22px] opacity-90 transition-all duration-200 hover:-translate-y-0.5 hover:border-cart-accent/35 hover:opacity-100 hover:shadow-[0_16px_40px_-20px_var(--color-cart-accent-glow)]"
            >
              <span className="grid size-[38px] place-items-center rounded-[10px] border border-cart-line bg-cart-bg-elev-2 text-cart-accent">
                <Icon />
              </span>
              <div>
                <div className="text-[17px] font-semibold leading-[1.1] text-white">{name}</div>
                <div className="mt-0.5 font-serif text-sm italic text-cart-ink-3">{note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
