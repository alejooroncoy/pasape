"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackBtn, Btn, C, CloseBtn, FONT_DISPLAY, FONT_MONO, OtpRow, Phone, StepDots } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useSmsSignIn } from "@/lib/identity/hooks/useFirebaseAuth";

export default function AuthOtpPage() {
  return (
    <Suspense fallback={null}>
      <AuthOtpInner />
    </Suspense>
  );
}

function AuthOtpInner() {
  const searchParams = useSearchParams();
  const isOrganizerIntent = searchParams.get("intent") === "organizer";
  const [code, setCode] = useState("");
  const { confirmCode, pending, error } = useSmsSignIn();
  const router = useRouter();

  const submit = async () => {
    const ok = await confirmCode(code);
    if (!ok) return;
    router.replace(
      isOrganizerIntent ? "/auth/onboarding?intent=organizer" : "/auth/onboarding",
    );
  };

  return (
    <div className="pasape-canvas">
      <Phone>
        <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BackBtn />
          <StepDots step={1} of={2} />
          <CloseBtn />
        </div>

        <div style={{ padding: "28px 22px 0" }}>
          <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
            PASO 2 DE 2
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
            Código que<br />te llegó.
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 30, lineHeight: 1.5 }}>
            Mandamos un SMS con tu código.
          </div>

          <OtpRow value={code} onChange={setCode} />

          {error && (
            <div style={{ marginTop: 16, fontFamily: FONT_MONO, fontSize: 12, color: C.red, textAlign: "center" }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 32, left: 22, right: 22 }}>
          <Btn onClick={() => void submit()} disabled={pending || code.length !== 6}>
            {pending ? "Validando…" : "Confirmar →"}
          </Btn>
        </div>
      </Phone>
    </div>
  );
}
