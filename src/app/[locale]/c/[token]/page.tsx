"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/_shared/api-client";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { Btn, C, FONT_DISPLAY, GoogleBtn } from "@/components/design";
import {
  PromoBody,
  PromoCallout,
  PromoEyebrow,
  PromoGlow,
  PromoStatusIcon,
} from "@/components/promoters/PromoInviteUI";
import { PromoInviteShell } from "@/components/promoters/PromoInviteShell";

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
  already_claimed: "Tu cuenta ya está activada. Anda a tu panel de promotor.",
  claimed_by_another:
    "Este link pertenece a otra cuenta Google. Si fuiste vos, inicia sesión con esa cuenta. Si crees que es un error, contactá al organizador.",
  missing_whatsapp:
    "Le falta el WhatsApp al promotor en el pool. Pedile al organizador que lo complete.",
  unauthenticated: "Iniciá sesión con Google primero para activar tu link.",
};

const friendly = (code: string) =>
  ERROR_COPY[code] ?? "Algo no salió bien. Probá de nuevo en unos minutos.";

function ClaimCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        padding: 28,
        background: "linear-gradient(180deg, rgba(124,58,237,0.12), rgba(18,18,26,0.95))",
        boxShadow: `0 0 0 1px ${C.purpleEdge} inset, 0 30px 60px -30px rgba(124,58,237,0.35)`,
      }}
    >
      {children}
    </div>
  );
}

export default function PromoterClaimPage({ params }: { params: Params }) {
  const { token } = use(params);
  const router = useRouter();
  const me = useCurrentUser();
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoActivated, setAutoActivated] = useState(false);

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

  useEffect(() => {
    if (autoActivated) return;
    if (phase !== "preview") return;
    if (me.isLoading) return;
    if (!me.data?.user) return;
    setAutoActivated(true);
    void activate();
  }, [autoActivated, phase, me.isLoading, me.data, activate]);

  const signInWithGoogle = useCallback(async () => {
    setPhase("signing-in");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/c/${token}`)}`,
        },
      });
      if (oauthErr) throw oauthErr;
    } catch (e) {
      setError(friendly((e as Error).message));
      setPhase("error");
    }
  }, [token]);

  const isLogged = !!me.data?.user;

  return (
    <PromoInviteShell>
      <PromoGlow tone="purple" />
      <div className="relative z-1 flex min-h-full flex-col justify-center px-[22px] py-8">
        <div>
          {phase === "loading" && (
            <ClaimCard>
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                  <PromoStatusIcon variant="loading" />
                </div>
                <div style={{ fontSize: 14, color: C.dim }}>Cargando tu invitación…</div>
              </div>
            </ClaimCard>
          )}

          {phase === "error" && (
            <ClaimCard>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                  <PromoStatusIcon variant="error" />
                </div>
                <PromoEyebrow color={C.red}>◆ No se pudo activar</PromoEyebrow>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    marginTop: 10,
                  }}
                >
                  No pudimos activar tu cuenta
                </div>
                <PromoBody>{error}</PromoBody>
                {isLogged && (
                  <div style={{ marginTop: 20 }}>
                    <Btn kind="secondary" onClick={() => router.push("/promo" as never)}>
                      Ir a mi panel
                    </Btn>
                  </div>
                )}
              </div>
            </ClaimCard>
          )}

          {(phase === "preview" || phase === "signing-in" || phase === "activating" || phase === "success") &&
            preview && (
              <ClaimCard>
                <PromoEyebrow>{preview.organizationName}</PromoEyebrow>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.05,
                    marginTop: 8,
                  }}
                >
                  Hola <span style={{ color: C.purple }}>{preview.promoterName.split(" ")[0]}</span> 👋
                </div>
                <PromoBody maxWidth={999}>
                  <b style={{ color: "#fff" }}>{preview.organizationName}</b> te agregó como promotor
                  {preview.primaryEventTitle && (
                    <>
                      {" "}
                      de <b style={{ color: "#fff" }}>{preview.primaryEventTitle}</b>
                    </>
                  )}
                  . Vas a ganar{" "}
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "#fff" }}>
                    {preview.defaultCommissionPct}%
                  </span>{" "}
                  por entrada vendida con tu link.
                </PromoBody>

                <PromoCallout tone="purple">
                  Toca el botón de abajo para activar tu acceso. La próxima vez entrás directo sin link.
                </PromoCallout>

                <div style={{ marginTop: 22 }}>
                  {phase === "preview" && !isLogged && (
                    <>
                      <div
                        style={{
                          marginBottom: 10,
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          color: C.dimmer,
                          textTransform: "uppercase",
                        }}
                      >
                        Para entrar a tu panel
                      </div>
                      <GoogleBtn onClick={signInWithGoogle} />
                    </>
                  )}

                  {phase === "signing-in" && (
                    <Btn kind="secondary" disabled>
                      Abriendo Google…
                    </Btn>
                  )}

                  {(phase === "activating" || phase === "success") && (
                    <Btn kind={phase === "success" ? "green" : "primary"} disabled>
                      {phase === "activating" ? "Activando tu rol…" : "Listo, te llevamos a tu panel"}
                    </Btn>
                  )}
                </div>
              </ClaimCard>
            )}
        </div>
      </div>
    </PromoInviteShell>
  );
}
