"use client";

import { useEffect } from "react";
import { Btn, C, FONT_DISPLAY, GoogleBtn, Phone } from "@/components/design";
import { Link, useRouter } from "@/i18n/navigation";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

export default function AuthGateBuyerPage() {
  const router = useRouter();
  const { signIn, pending, error } = useGoogleSignIn();
  const me = useCurrentUser();

  useEffect(() => {
    if (!me.data?.user) return;
    if (!me.data.user.fullName) router.replace("/auth/onboarding");
    else router.replace("/");
  }, [me.data, router]);

  return (
    <div className="pasape-canvas">
      <Phone bg={C.bg}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(124,58,237,0.14) 0%, transparent 40%)",
          }}
        />

        <div style={{ padding: "10px 22px 0", position: "relative", zIndex: 1 }}>
          <div
            style={{
              borderRadius: 16,
              padding: "12px 14px",
              background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(124,58,237,0.06))",
              boxShadow: "0 0 0 1px rgba(124,58,237,0.28) inset",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 11,
                background: "linear-gradient(135deg, #4B1F9A, #7C3AED, #FF4D5E)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>
                Bienvenido a Pasape
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>Entrá para comprar entradas</div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: C.bg2,
            borderRadius: "26px 26px 0 0",
            boxShadow: "0 -1px 0 rgba(255,255,255,0.07), 0 -30px 60px -10px rgba(0,0,0,0.7)",
            padding: "0 22px 36px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 20px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.14)" }} />
          </div>

          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1, marginBottom: 6 }}>
            Identificate<br />para comprar.
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 22, lineHeight: 1.5 }}>
            Un toque con Google o tu número de celular.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <GoogleBtn onClick={() => void signIn()} disabled={pending} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: C.line }} />
              <span style={{ fontSize: 11, color: C.dimmer }}>o</span>
              <div style={{ flex: 1, height: 1, background: C.line }} />
            </div>
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={"/auth/sms" as any}
              style={{ display: "block", textDecoration: "none" }}
            >
              <Btn kind="secondary">Continuar con número de celular</Btn>
            </Link>
          </div>

          {error && <div style={{ marginTop: 12, fontSize: 12, color: C.red, textAlign: "center" }}>{error}</div>}

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.dimmer, lineHeight: 1.6 }}>
            Sin contraseña · sin email · 30 segundos
            <br />
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={"/org/signin" as any}
              style={{ color: C.purple, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              ¿Eres organizador? Entrá aquí
            </Link>
            <br />
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={"/tickets/recover" as any}
              style={{ color: C.purple, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Recuperar mis tickets
            </Link>
          </div>
        </div>
      </Phone>
    </div>
  );
}
