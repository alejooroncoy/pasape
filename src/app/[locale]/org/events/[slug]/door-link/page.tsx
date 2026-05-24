"use client";

import { use, useState } from "react";
import { C, Dot, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useDoorLink } from "@/lib/events/hooks/useDoorLink";
import { BackBtn } from "../_components";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgDoorLinkPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const door = useDoorLink(slug);
  const [copied, setCopied] = useState(false);

  const ev = event.data?.event;
  const url = door.data?.url ?? "";
  const code = door.data?.code ?? "";

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>ACCESO PORTERO</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "20px 22px 0", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            marginBottom: 24,
            background: "rgba(255,255,255,0.04)",
            boxShadow: `0 0 0 1px ${C.line} inset`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #4B1F9A, #7C3AED)",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>
              {ev?.title ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: C.dim }}>{ev?.venue ?? ""}</div>
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          Link para tu
          <br />
          portero.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 22, lineHeight: 1.5 }}>
          Compartí este link con quien va a escanear. Lo abre y ya tiene acceso. Te avisamos por
          email cuando alguien lo use.
        </div>

        <div
          style={{
            borderRadius: 18,
            padding: "16px 18px",
            background: C.bg2,
            boxShadow: "0 0 0 1px rgba(124,58,237,0.35) inset",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.dim,
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            LINK DEL PORTERO
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              letterSpacing: "0.02em",
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}
          >
            {url ? (
              <>
                {url.replace(code, "")}
                <span style={{ color: C.purple }}>{code}</span>
              </>
            ) : (
              <span style={{ color: C.dim }}>Generando…</span>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!url}
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: 0,
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 12,
                cursor: url ? "pointer" : "not-allowed",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset",
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a
              href={
                url
                  ? `https://wa.me/?text=${encodeURIComponent(
                      `Link para escanear en la puerta: ${url}`,
                    )}`
                  : undefined
              }
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                background: "rgba(37,211,102,0.14)",
                color: "#25D366",
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                textDecoration: "none",
                boxShadow: "0 0 0 1px rgba(37,211,102,0.25) inset",
                pointerEvents: url ? "auto" : "none",
                opacity: url ? 1 : 0.5,
              }}
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 14,
            background: C.bg2,
            boxShadow: `0 0 0 1px ${C.line} inset`,
          }}
        >
          <Dot color={C.green} />
          <div style={{ flex: 1, fontSize: 12, color: C.dim }}>
            El link rota cada hora por seguridad. Generar otro lo invalida.
          </div>
        </div>
      </div>
    </Phone>
  );
}
