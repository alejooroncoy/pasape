"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackBtn, Btn, C, CloseBtn, FONT_DISPLAY, Phone, PhoneField, StepDots } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useSmsSignIn } from "@/lib/identity/hooks/useFirebaseAuth";

export default function AuthSmsPage() {
  return (
    <Suspense fallback={null}>
      <AuthSmsInner />
    </Suspense>
  );
}

function AuthSmsInner() {
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const [phone, setPhone] = useState("");
  const { sendCode, pending, error } = useSmsSignIn("recaptcha-sms");
  const router = useRouter();

  const submit = async () => {
    const e164 = `+51${phone}`;
    const ok = await sendCode(e164);
    if (!ok) return;
    const otpHref =
      intent === "organizer" ? "/auth/otp?intent=organizer" : "/auth/otp";
    router.push(otpHref);
  };

  return (
    <div className="pasape-canvas">
      <Phone>
        <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BackBtn />
          <StepDots step={0} of={2} />
          <CloseBtn />
        </div>

        <div style={{ padding: "28px 22px 0", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
            PASO 1 DE 2
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              marginBottom: 8,
            }}
          >
            Tu número<br />de celular.
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 30, lineHeight: 1.5 }}>
            Te mandamos un SMS con un código<br />de 6 dígitos.
          </div>

          <PhoneField value={phone} onChange={setPhone} autoFocus />

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4l5 4 5-4" stroke={C.dimmer} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke={C.dimmer} strokeWidth="1.2" fill="none" />
            </svg>
            <span style={{ fontSize: 11, color: C.dimmer }}>No es para WhatsApp — llega por SMS</span>
          </div>
        </div>

        <div id="recaptcha-sms" />

        <div style={{ position: "absolute", bottom: 32, left: 22, right: 22 }}>
          {error && <div style={{ marginBottom: 12, fontSize: 12, color: C.red }}>{error}</div>}
          <Btn onClick={() => void submit()} disabled={pending || phone.length < 9} suppressHydrationWarning>
            {pending ? "Enviando…" : "Enviar SMS →"}
          </Btn>
        </div>
      </Phone>
    </div>
  );
}
