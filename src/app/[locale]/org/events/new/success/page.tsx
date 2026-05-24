"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Btn, C, CloseBtn, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useRouter } from "@/i18n/navigation";

export default function OrgCreateSuccessPage() {
  return (
    <Suspense fallback={<Phone><div style={{ padding: 28, color: C.dim }}>Cargando…</div></Phone>}>
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("slug") ?? "";

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `pasape.pe/${slug}`;
    return `${window.location.origin}/events/${slug}`;
  }, [slug]);

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
    const text = encodeURIComponent(`Me sumé a Pasape — agarrá tu entrada acá: ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <Phone>
      <style>{`@keyframes pulse {0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(80% 50% at 50% 20%, rgba(124,58,237,0.4), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <CloseBtn href="/org" />
      </div>

      <div
        style={{
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: "calc(100dvh - 50px)",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Confetti dots */}
          <div
            style={{
              position: "absolute",
              top: 60,
              left: 0,
              right: 0,
              height: 200,
              pointerEvents: "none",
            }}
          >
            {(
              [
                ["14%", "12%", C.purple, 0],
                ["72%", "22%", C.yellow, 0.3],
                ["18%", "70%", C.green, 0.6],
                ["80%", "60%", C.red, 0.2],
                ["50%", "8%", "#fff", 0.5],
                ["32%", "30%", C.purple, 0.7],
                ["90%", "32%", "#fff", 0.4],
              ] as Array<[string, string, string, number]>
            ).map(([l, t, c, d], i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: l,
                  top: t,
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: c,
                  boxShadow: `0 0 10px ${c}`,
                  animation: "pulse 1.6s ease-in-out infinite",
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </div>

          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.14em",
              color: C.purple,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            ◆ EVENTO PUBLICADO
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
            }}
          >
            Tu evento
            <br />
            está listo.<span style={{ color: C.purple }}> 🎉</span>
          </div>
          <div style={{ fontSize: 14, color: C.dim, marginTop: 12, lineHeight: 1.5 }}>
            Le mandamos su link a cada promotor por WhatsApp. Compartí el tuyo donde quieras.
          </div>

          <button
            type="button"
            onClick={copy}
            style={{
              marginTop: 24,
              padding: "14px 16px",
              borderRadius: 16,
              background: C.bg2,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              width: "100%",
              border: 0,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: C.dim,
                  letterSpacing: "0.06em",
                  marginBottom: 2,
                }}
              >
                {copied ? "COPIADO" : "TU LINK"}
              </div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#fff",
                }}
              >
                {shareUrl}
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect
                x="6"
                y="6"
                width="11"
                height="11"
                rx="2"
                stroke="#fff"
                strokeWidth="1.4"
              />
              <rect
                x="3"
                y="3"
                width="11"
                height="11"
                rx="2"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.4"
              />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 16 }}>
          <button
            type="button"
            onClick={whatsapp}
            style={{
              height: 60,
              borderRadius: 18,
              border: 0,
              background: "#25D366",
              color: "#062315",
              fontFamily: FONT_DISPLAY,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 12px 28px -8px rgba(37,211,102,0.5)",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="#062315">
              <path d="M16.6 3.4A9 9 0 0 0 2 12.1l-1 4.9 5-1.3a9 9 0 0 0 4 1h0a9 9 0 0 0 9-9 9 9 0 0 0-2.4-4.3zm-6.6 13a7.5 7.5 0 0 1-3.8-1l-.3-.2-2.9.8.8-2.8-.2-.3a7.5 7.5 0 1 1 6.4 3.5zm4.1-5.6c-.2-.1-1.3-.7-1.5-.8s-.4-.1-.5.1-.5.7-.6.8-.3.1-.5 0a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2 0-.2 0-.3-.1-.4l-.6-1.5c-.2-.4-.3-.3-.5-.3h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.8c0 1 .8 2.1 1 2.3a8.5 8.5 0 0 0 3.5 3.2c2 .8 2 .5 2.4.5a2 2 0 0 0 1.3-1c.2-.4.2-.7.1-.7-.1-.1-.2-.2-.4-.3z" />
            </svg>
            Compartir por WhatsApp
          </button>
          <Btn kind="secondary" onClick={() => router.push("/org")}>
            Ir a mi panel
          </Btn>
        </div>
      </div>
    </Phone>
  );
}
