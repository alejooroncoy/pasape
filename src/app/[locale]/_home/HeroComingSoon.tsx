"use client";

import { useState } from "react";

export function HeroComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    try {
      await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setSubmitted(true);
  };

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
                <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-cart-accent bg-cart-accent px-3 py-1.5 text-xs tracking-[0.04em] text-white">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-white shadow-[0_0_6px_white]"
                  />
                  Próximamente
                </span>
                <span className="inline-flex items-center whitespace-nowrap rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs tracking-[0.04em] text-white backdrop-blur-md">
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
                Estamos curando los próximos eventos del finde. Suscríbete y te avisamos
                antes que nadie, sin spam.
              </p>
            </div>

            {/* Lado derecho: form newsletter como CTA visual */}
            <div className="flex max-w-[420px] flex-col gap-3 max-[900px]:w-full max-[900px]:max-w-none">
              {submitted ? (
                <div
                  role="status"
                  className="inline-flex items-center gap-3 rounded-full border border-cart-accent bg-cart-accent-soft px-5 py-3 text-cart-accent"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M5.5 9.2l2.3 2.3 4.7-4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  ¡Listo! Te avisamos cuando se libere el primer evento.
                </div>
              ) : (
                <form
                  onSubmit={submit}
                  className="flex w-full gap-2 rounded-full border border-cart-line-strong bg-cart-bg-elev/80 p-1.5 backdrop-blur-md max-[560px]:flex-col max-[560px]:rounded-[18px]"
                >
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.pe"
                    aria-label="Correo electrónico"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-cart-ink-4"
                  />
                  <button
                    type="submit"
                    className="rounded-full border-0 bg-cart-accent px-6 py-3 text-[14.5px] font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_22px_-6px_var(--color-cart-accent-glow-strong)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 max-[560px]:w-full"
                  >
                    Avísame
                  </button>
                </form>
              )}
              <p className="text-center text-[11.5px] tracking-wide text-cart-ink-4 max-[900px]:text-left">
                Te llega los viernes · Cero spam
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

