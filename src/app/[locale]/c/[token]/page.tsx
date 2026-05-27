"use client";

import { use, useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/_shared/api-client";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { GoogleBtn } from "@/components/design";

type Params = Promise<{ token: string; locale: string }>;

type PreviewData = {
  orgPromoterId: string;
  organizationName: string;
  promoterName: string;
  whatsapp: string;
  defaultCommissionPct: number;
  primaryEventSlug: string | null;
  primaryEventTitle: string | null;
  alreadyClaimed: boolean;
};

type ClaimResponse = {
  context: PreviewData;
  redirectTo: string;
};

type Phase = "loading" | "preview" | "signing-in" | "activating" | "success" | "error";

const ERROR_COPY: Record<string, string> = {
  not_found:
    "Este link no existe o ya fue usado. Pídele a tu organizador que te reenvíe la invitación.",
  invalid_token: "El link parece corrupto. Volvé a tocar el botón del WhatsApp.",
  token_expired_or_used:
    "El link caducó o ya fue usado. Pídele a tu organizador que te reenvíe la invitación.",
  already_claimed:
    "Tu cuenta ya está activada. Anda a tu panel de promotor.",
  claimed_by_another:
    "Este link pertenece a otra cuenta Google. Si fuiste vos, inicia sesión con esa cuenta. Si crees que es un error, contactá al organizador.",
  missing_whatsapp:
    "Le falta el WhatsApp al promotor en el pool. Pedile al organizador que lo complete.",
  unauthenticated: "Iniciá sesión con Google primero para activar tu link.",
};

const friendly = (code: string) =>
  ERROR_COPY[code] ?? "Algo no salió bien. Probá de nuevo en unos minutos.";

export default function PromoterClaimPage({ params }: { params: Params }) {
  const { token } = use(params);
  const router = useRouter();
  const me = useCurrentUser();
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoActivated, setAutoActivated] = useState(false);

  // Paso 1: cargar preview.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<PreviewData>(`/api/promoter-claim/${token}`);
        if (cancelled) return;
        setPreview(data);
        setPhase("preview");
      } catch (e) {
        if (cancelled) return;
        setError(friendly((e as Error).message));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Paso 2: consumir token (usuario ya autenticado con Google).
  const activate = useCallback(async () => {
    setPhase("activating");
    setError(null);
    try {
      const claim = await api.post<ClaimResponse>("/api/promoter-claim", { token });
      setPhase("success");
      setTimeout(() => router.push(claim.redirectTo as never), 700);
    } catch (e) {
      setError(friendly((e as Error).message));
      setPhase("error");
    }
  }, [token, router]);

  // Auto-activar: si el usuario ya está logueado al cargar (volvió de OAuth o
  // ya tenía sesión), procedemos sin que tenga que tocar otro botón.
  useEffect(() => {
    if (autoActivated) return;
    if (phase !== "preview") return;
    if (me.isLoading) return;
    if (!me.data?.user) return;
    setAutoActivated(true);
    void activate();
  }, [autoActivated, phase, me.isLoading, me.data, activate]);

  // Iniciar OAuth de Google con redirect de vuelta a esta misma URL.
  const signInWithGoogle = useCallback(async () => {
    setPhase("signing-in");
    try {
      const supabase = createSupabaseBrowserClient();
      const back = window.location.href;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/c/${token}`)}`,
        },
      });
      if (oauthErr) throw oauthErr;
      // Browser navega a Google; volverá a esta misma URL después del callback.
    } catch (e) {
      setError(friendly((e as Error).message));
      setPhase("error");
    }
  }, [token]);

  const isLogged = !!me.data?.user;

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-cart-bg px-5 py-10 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(184,124,255,0.18), transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[440px]"
      >
        {phase === "loading" && (
          <div className="rounded-3xl border border-cart-line bg-cart-bg-elev px-6 py-10 text-center">
            <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-cart-line border-t-cart-accent" />
            <div className="text-[14px] text-cart-ink-3">Cargando tu invitación…</div>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center">
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-red-500/15 text-red-300">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-[15px] font-semibold">No pudimos activar tu cuenta</div>
            <p className="mt-2 text-[13px] leading-relaxed text-cart-ink-3">{error}</p>
            {isLogged && (
              <button
                type="button"
                onClick={() => router.push("/promo" as never)}
                className="mt-4 inline-flex rounded-full bg-cart-bg-elev-2 px-4 py-2 text-[12.5px] font-semibold text-cart-ink-2 transition hover:text-white"
              >
                Ir a mi panel
              </button>
            )}
          </div>
        )}

        {(phase === "preview" || phase === "signing-in" || phase === "activating" || phase === "success") &&
          preview && (
            <div
              className="relative overflow-hidden rounded-3xl border border-cart-line-strong p-7 shadow-[0_30px_60px_-30px_rgba(184,124,255,0.4)]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(184,124,255,0.10), rgba(20,12,40,0.4))",
                boxShadow:
                  "inset 0 0 0 1px rgba(184,124,255,0.25), 0 30px 60px -30px rgba(184,124,255,0.4)",
              }}
            >
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-accent">
                {preview.organizationName}
              </div>
              <h1 className="font-sans text-[28px] font-semibold leading-[1.05] tracking-[-0.025em]">
                Hola{" "}
                <span className="text-cart-accent">
                  {preview.promoterName.split(" ")[0]}
                </span>{" "}
                👋
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-cart-ink-2">
                <b className="text-white">{preview.organizationName}</b> te agregó como
                promotor
                {preview.primaryEventTitle && (
                  <>
                    {" "}
                    de <b className="text-white">{preview.primaryEventTitle}</b>
                  </>
                )}
                . Vas a ganar{" "}
                <span className="font-mono font-semibold text-white">
                  {preview.defaultCommissionPct}%
                </span>{" "}
                por entrada vendida con tu link.
              </p>

              <div className="mt-6">
                {phase === "preview" && !isLogged && (
                  <>
                    <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                      Para entrar a tu panel
                    </div>
                    <GoogleBtn onClick={signInWithGoogle} />
                    <p className="mt-3 text-center text-[11.5px] text-cart-ink-3">
                      Usa la cuenta Google que prefieras — la próxima vez entrás directo sin link.
                    </p>
                  </>
                )}

                {phase === "signing-in" && (
                  <div className="flex h-14 items-center justify-center gap-2 rounded-full bg-cart-bg-elev-2 text-[14px] text-cart-ink-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-cart-ink-4 border-t-white" />
                    Abriendo Google…
                  </div>
                )}

                {(phase === "activating" || phase === "success") && (
                  <button
                    type="button"
                    disabled
                    className={
                      "flex h-14 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white transition-all " +
                      (phase === "success"
                        ? "bg-[#22D17F] shadow-[0_14px_36px_-8px_rgba(34,209,127,0.5)]"
                        : "bg-cart-accent shadow-[0_14px_36px_-8px_var(--color-cart-accent-glow-strong)] opacity-90")
                    }
                  >
                    {phase === "activating" && (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Activando tu rol…
                      </>
                    )}
                    {phase === "success" && (
                      <>
                        <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M3 7l3 3 5-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Listo, te llevamos a tu panel
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
      </motion.div>
    </div>
  );
}
