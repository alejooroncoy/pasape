"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";

export default function OrgCreateSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[100dvh] place-items-center bg-cart-bg text-cart-ink-3">
          Cargando…
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("slug") ?? "";
  const initialStatus = (params.get("status") === "draft" ? "draft" : "published") as
    | "draft"
    | "published";
  const [status, setStatus] = useState<"draft" | "published">(initialStatus);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const publishNow = async () => {
    if (!slug || publishing) return;
    setPublishError(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/events/${slug}/publish`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "publish_failed");
      }
      setStatus("published");
    } catch (e) {
      setPublishError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const isLive = status === "published";

  const [origin, setOrigin] = useState("pasape.lat");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.host);
  }, []);

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/events/${slug}` : `https://${origin}/events/${slug}`),
    [slug, origin],
  );
  const shareLabel = useMemo(() => `${origin}/events/${slug}`, [origin, slug]);

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };

  const whatsapp = () => {
    const text = encodeURIComponent(`Estoy en Pasape — consigue tu entrada aquí: ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-cart-bg text-white">
      {/* Halo de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 12%, rgba(184,124,255,0.32), transparent 70%), radial-gradient(45% 35% at 85% 80%, rgba(168,85,247,0.18), transparent 70%)",
        }}
      />
      {/* Grano sutil estilo iOS */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <Confetti />

      {/* Topbar: cerrar */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 pt-5 lg:px-10 lg:pt-8">
        <div className="flex items-center gap-2 text-[13px] font-medium tracking-[0.18em] text-cart-ink-3">
          <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_10px_var(--color-cart-accent-glow-strong)]" />
          PASAPE
        </div>
        <button
          type="button"
          onClick={() => router.push("/org")}
          aria-label="Cerrar"
          className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev/70 backdrop-blur transition hover:border-cart-line-strong hover:bg-cart-bg-elev lg:size-10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* MOBILE LAYOUT — estilo iOS, centrado vertical */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-[460px] flex-col justify-center px-5 pb-8 pt-4 lg:hidden">
        <Hero variant="mobile" isLive={isLive} />
        <ShareCard
          shareLabel={shareLabel}
          copied={copied}
          onCopy={copy}
          variant="mobile"
          isLive={isLive}
        />

        <div className="mt-8 flex flex-col gap-3">
          {isLive ? (
            <button
              type="button"
              onClick={whatsapp}
              className="relative flex h-[58px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl text-[15.5px] font-semibold tracking-[-0.01em] text-[#062315]"
              style={{
                background: "linear-gradient(180deg, #2EE584 0%, #25D366 100%)",
                boxShadow:
                  "0 14px 32px -10px rgba(37,211,102,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset",
              }}
            >
              <WhatsAppIcon />
              Compartir por WhatsApp
            </button>
          ) : (
            <button
              type="button"
              onClick={publishNow}
              disabled={publishing}
              className="relative flex h-[58px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-cart-accent text-[15.5px] font-semibold tracking-[-0.01em] text-white shadow-[0_14px_32px_-10px_var(--color-cart-accent-glow-strong)] disabled:opacity-60"
            >
              {publishing ? "Publicando…" : "Publicar ahora"}
            </button>
          )}
          {publishError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
              No pudimos publicar — intenta de nuevo o desde el panel.
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push("/org")}
            className="flex h-[52px] items-center justify-center rounded-2xl border border-cart-line bg-cart-bg-elev/80 text-[14.5px] font-medium text-cart-ink-2 backdrop-blur transition hover:border-cart-line-strong hover:text-white"
          >
            {isLive ? "Ir a mi panel" : "Seguir editando"}
          </button>
        </div>
      </div>

      {/* DESKTOP LAYOUT — estilo web */}
      <div className="relative z-10 mx-auto hidden w-full max-w-[1120px] px-10 pb-16 lg:flex lg:min-h-[calc(100dvh-96px)] lg:items-center">
        <div className="grid w-full grid-cols-[1.05fr_1fr] items-center gap-12">
          <div>
            <Hero variant="desktop" isLive={isLive} />

            <div className="mt-10 flex items-center gap-3">
              {isLive ? (
                <button
                  type="button"
                  onClick={whatsapp}
                  className="relative flex h-[56px] items-center gap-2.5 overflow-hidden rounded-full px-7 text-[15px] font-semibold tracking-[-0.01em] text-[#062315] transition hover:-translate-y-[1px]"
                  style={{
                    background: "linear-gradient(180deg, #2EE584 0%, #25D366 100%)",
                    boxShadow:
                      "0 18px 40px -12px rgba(37,211,102,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset",
                  }}
                >
                  <WhatsAppIcon />
                  Compartir por WhatsApp
                </button>
              ) : (
                <button
                  type="button"
                  onClick={publishNow}
                  disabled={publishing}
                  className="relative flex h-[56px] items-center gap-2.5 overflow-hidden rounded-full bg-cart-accent px-7 text-[15px] font-semibold tracking-[-0.01em] text-white shadow-[0_18px_40px_-12px_var(--color-cart-accent-glow-strong)] transition hover:-translate-y-[1px] disabled:opacity-60"
                >
                  {publishing ? "Publicando…" : "Publicar ahora"}
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push("/org")}
                className="flex h-[56px] items-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev/70 px-7 text-[14.5px] font-medium text-cart-ink-2 backdrop-blur transition hover:border-cart-line-strong hover:text-white"
              >
                {isLive ? "Ir a mi panel" : "Seguir editando"}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {publishError && (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
                No pudimos publicar — intenta de nuevo o desde el panel del evento.
              </div>
            )}

            <div className="mt-10 flex items-center gap-2 text-[13px] text-cart-ink-3">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L7 10.2l-3.4 1.8.7-3.8L1.5 5.5l3.8-.5L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              {isLive
                ? "Cada promotor recibió su link único por WhatsApp."
                : "Tu evento está guardado. Solo aparecerá en la cartelera cuando lo publiques."}
            </div>
          </div>

          <ShareCard
            shareLabel={shareLabel}
            copied={copied}
            onCopy={copy}
            variant="desktop"
            isLive={isLive}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Hero
// ============================================================
function Hero({ variant, isLive }: { variant: "mobile" | "desktop"; isLive: boolean }) {
  const isDesktop = variant === "desktop";
  const accent = isLive ? "text-cart-accent" : "text-cart-ink-2";
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] backdrop-blur " +
          (isLive
            ? "border-[#22D17F]/40 bg-[#22D17F]/12 text-[#22D17F]"
            : "border-cart-line-strong bg-white/5 text-cart-ink-2")
        }
      >
        <span
          className={
            "size-1.5 rounded-full " +
            (isLive
              ? "bg-[#22D17F] shadow-[0_0_8px_rgba(34,209,127,0.7)]"
              : "bg-cart-ink-3")
          }
        />
        {isLive ? "EN VIVO · PUBLICADO" : "GUARDADO COMO BORRADOR"}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={
          isDesktop
            ? "mt-5 font-sans text-[64px] font-semibold leading-[0.95] tracking-[-0.045em]"
            : "mt-4 font-sans text-[42px] font-semibold leading-[0.95] tracking-[-0.04em]"
        }
      >
        {isLive ? (
          <>
            Tu evento
            <br />
            está en vivo.
            <span className={"ml-1 " + accent}>🎉</span>
          </>
        ) : (
          <>
            Casi listo —<br />
            te falta un clic.
          </>
        )}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={
          isDesktop
            ? "mt-5 max-w-[460px] text-[16.5px] leading-[1.55] text-cart-ink-2"
            : "mt-3 text-[14.5px] leading-[1.55] text-cart-ink-2"
        }
      >
        {isLive
          ? "Le mandamos su link a cada promotor por WhatsApp. Comparte el tuyo donde quieras."
          : "Lo guardamos en borrador. Publícalo cuando estés lista y aparecerá en la cartelera al instante."}
      </motion.p>
    </div>
  );
}

// ============================================================
// Share card
// ============================================================
function ShareCard({
  shareLabel,
  copied,
  onCopy,
  variant,
  isLive,
}: {
  shareLabel: string;
  copied: boolean;
  onCopy: () => void;
  variant: "mobile" | "desktop";
  isLive: boolean;
}) {
  const isDesktop = variant === "desktop";

  return (
    <motion.div
      initial={{ opacity: 0, y: isDesktop ? 24 : 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.25, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={
        isDesktop
          ? "relative overflow-hidden rounded-[28px] border border-cart-line-strong bg-cart-bg-elev/85 p-7 backdrop-blur-xl"
          : "relative mt-8 overflow-hidden rounded-[22px] border border-cart-line bg-cart-bg-elev/80 p-4 backdrop-blur-xl"
      }
      style={{
        boxShadow: isDesktop
          ? "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset"
          : "0 20px 50px -15px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* halo interno */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px"
        style={{
          background:
            "radial-gradient(60% 80% at 100% 0%, rgba(184,124,255,0.18), transparent 60%)",
        }}
      />

      {isDesktop && (
        <div className="relative mb-5 flex items-center justify-between">
          <div className="text-[12px] font-medium tracking-[0.18em] text-cart-ink-3">
            {isLive ? "COMPARTE TU EVENTO" : "TU EVENTO (PRIVADO)"}
          </div>
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-cart-ink-4" />
            <span className="size-2 rounded-full bg-cart-ink-4" />
            <span
              className={
                "size-2 rounded-full " +
                (isLive ? "bg-cart-accent" : "bg-cart-ink-3")
              }
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onCopy}
        className={
          isDesktop
            ? "group relative flex w-full items-center gap-4 rounded-2xl border border-cart-line bg-cart-bg-elev-2/80 p-4 text-left transition hover:border-cart-line-strong"
            : "group relative flex w-full items-center gap-3 rounded-xl border border-cart-line bg-cart-bg-elev-2/80 p-3 text-left transition active:scale-[0.99]"
        }
      >
        <div className="grid size-11 flex-shrink-0 place-items-center rounded-xl bg-cart-accent-soft text-cart-accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M8.5 12.5l-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-cart-ink-3">
            {copied ? "Copiado al portapapeles" : "Tu link público"}
          </div>
          <div
            className={
              isDesktop
                ? "truncate font-mono text-[15px] font-semibold text-white"
                : "truncate font-mono text-[13.5px] font-semibold text-white"
            }
          >
            {shareLabel}
          </div>
        </div>
        <div
          className={
            "grid size-10 flex-shrink-0 place-items-center rounded-xl border transition " +
            (copied
              ? "border-[#22D17F]/40 bg-[#22D17F]/15 text-[#22D17F]"
              : "border-cart-line bg-cart-bg-elev text-cart-ink-2 group-hover:border-cart-line-strong group-hover:text-white")
          }
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2.5" y="2.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            </svg>
          )}
        </div>
      </button>

      {isDesktop && (
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          <Stat
            label="Promotores"
            value={isLive ? "Notificados" : "En espera"}
            tone={isLive ? "accent" : "neutral"}
          />
          <Stat
            label="Estado"
            value={isLive ? "Live" : "Borrador"}
            tone={isLive ? "green" : "neutral"}
          />
          <Stat
            label="Visibilidad"
            value={isLive ? "Pública" : "Privada"}
            tone={isLive ? "neutral" : "neutral"}
          />
        </div>
      )}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "accent" | "green" | "neutral";
}) {
  const dot =
    tone === "accent"
      ? "bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent-glow-strong)]"
      : tone === "green"
        ? "bg-[#22D17F] shadow-[0_0_8px_rgba(34,209,127,0.6)]"
        : "bg-cart-ink-4";
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev-2/60 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-cart-ink-3">
        <span className={`size-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-white">{value}</div>
    </div>
  );
}

// ============================================================
// Confetti
// ============================================================
function Confetti() {
  const items = useMemo(
    () =>
      [
        ["14%", "18%", "#B87CFF", 0, 6],
        ["72%", "22%", "#FFCE3B", 0.3, 5],
        ["22%", "62%", "#22D17F", 0.6, 7],
        ["80%", "58%", "#FF4D5E", 0.2, 5],
        ["50%", "10%", "#ffffff", 0.5, 4],
        ["32%", "36%", "#B87CFF", 0.7, 6],
        ["90%", "32%", "#ffffff", 0.4, 5],
        ["8%", "44%", "#FFCE3B", 0.15, 5],
        ["62%", "70%", "#B87CFF", 0.8, 6],
        ["44%", "82%", "#22D17F", 0.45, 4],
      ] as Array<[string, string, string, number, number]>,
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {items.map(([l, t, c, d, s], i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0.6, 1], scale: [0.4, 1, 0.85, 1], y: [0, -6, 0] }}
          transition={{
            delay: d,
            duration: 2.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute rounded-full"
          style={{
            left: l,
            top: t,
            width: s,
            height: s,
            background: c,
            boxShadow: `0 0 12px ${c}`,
          }}
        />
      ))}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="#062315" aria-hidden>
      <path d="M16.6 3.4A9 9 0 0 0 2 12.1l-1 4.9 5-1.3a9 9 0 0 0 4 1h0a9 9 0 0 0 9-9 9 9 0 0 0-2.4-4.3zm-6.6 13a7.5 7.5 0 0 1-3.8-1l-.3-.2-2.9.8.8-2.8-.2-.3a7.5 7.5 0 1 1 6.4 3.5zm4.1-5.6c-.2-.1-1.3-.7-1.5-.8s-.4-.1-.5.1-.5.7-.6.8-.3.1-.5 0a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2 0-.2 0-.3-.1-.4l-.6-1.5c-.2-.4-.3-.3-.5-.3h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.8c0 1 .8 2.1 1 2.3a8.5 8.5 0 0 0 3.5 3.2c2 .8 2 .5 2.4.5a2 2 0 0 0 1.3-1c.2-.4.2-.7.1-.7-.1-.1-.2-.2-.4-.3z" />
    </svg>
  );
}
