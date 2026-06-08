export function HeroComingSoon() {
  return (
    <section className="relative pt-[clamp(20px,3vw,36px)]">
      {/* Big radial glow above hero (matches .hero::before del design) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-0 h-[600px] w-[1100px] -translate-x-1/2 blur-[60px]"
        style={{
          background:
            "radial-gradient(closest-side, var(--color-cart-accent-soft), transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
        <article
          className="relative aspect-[16/9] overflow-hidden rounded-[28px] border border-cart-line-strong shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] max-[900px]:aspect-auto max-[900px]:min-h-[520px]"
          style={{ background: "var(--color-cart-bg-purple)" }}
        >
          {/* Scrim igual al design — degradado vertical + horizontal sutil */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,10,15,0) 0%, rgba(10,10,15,0.1) 40%, rgba(10,10,15,0.85) 100%), linear-gradient(90deg, rgba(10,10,15,0.7) 0%, rgba(10,10,15,0.1) 50%, transparent 100%)",
            }}
          />

          {/* Body — posición absoluta abajo izquierda, layout flex con CTA a la derecha */}
          <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-6 p-[clamp(24px,4vw,56px)] max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-4">
            <div className="max-w-[60%] max-[900px]:max-w-full">
              <div className="mb-4 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-cart-accent/60 bg-cart-accent/15 px-3 py-1.5 text-xs tracking-[0.04em] text-cart-accent">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_6px_var(--color-cart-accent)]"
                  />
                  Lima · 2026
                </span>
              </div>

              <h1 className="m-0 max-w-[14ch] font-sans text-[clamp(34px,5.6vw,84px)] font-semibold leading-[0.96] tracking-[-0.03em] text-balance">
                Los mejores eventos
                <br />
                de Lima,{" "}
                <em
                  className="font-serif italic font-normal text-cart-accent"
                  style={{ textShadow: "0 0 32px var(--color-cart-accent-glow)" }}
                >
                  en un solo lugar.
                </em>
              </h1>

              <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.55] text-cart-ink-2">
                Encuentra y compra entradas para los mejores eventos de la ciudad, sin colas ni
                complicaciones.
              </p>
            </div>

            {/* CTA — explorar eventos */}
            <div className="flex flex-col gap-3 max-[900px]:w-full">
              <a
                href="#eventos"
                className="inline-flex items-center gap-2.5 rounded-full border-0 bg-cart-accent px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_22px_-6px_var(--color-cart-accent-glow-strong)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 max-[560px]:w-full max-[560px]:justify-center"
              >
                Explorar eventos
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 3v10M3 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
