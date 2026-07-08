"use client";

import type { CSSProperties, ReactNode } from "react";
import { CloseBtn, Dot } from "@/components/design";
import { C, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "@/components/design/tokens";

type GlowTone = "purple" | "yellow" | "green" | "neutral" | "error";

const GLOW: Record<GlowTone, string> = {
  purple: "radial-gradient(70% 50% at 50% 28%, rgba(124,58,237,0.38), transparent 72%)",
  yellow: "radial-gradient(70% 50% at 50% 28%, rgba(255,206,59,0.22), transparent 72%)",
  green: "radial-gradient(70% 50% at 50% 28%, rgba(34,209,127,0.2), transparent 72%)",
  neutral: "radial-gradient(70% 50% at 50% 28%, rgba(255,255,255,0.05), transparent 72%)",
  error: "radial-gradient(70% 50% at 50% 28%, rgba(255,77,94,0.14), transparent 72%)",
};

export const PromoGlow = ({ tone = "purple" }: { tone?: GlowTone }) => (
  <div
    aria-hidden
    style={{ position: "absolute", inset: 0, background: GLOW[tone], pointerEvents: "none" }}
  />
);

export const PromoHeroBanner = () => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260, overflow: "hidden" }}>
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 52%, #FF4D5E 108%)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(60% 50% at 30% 30%, rgba(255,255,255,0.22), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.4), transparent 60%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -1,
          left: 0,
          right: 0,
          height: 72,
          background: `linear-gradient(to bottom, transparent, ${C.bg})`,
        }}
      />
    </div>
  </div>
);

/** Columna centrada como en screenshots/promo-cart-migration (icono + copy). */
export const PromoStatusContent = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      width: "100%",
      maxWidth: 320,
      margin: "0 auto",
    }}
  >
    {children}
  </div>
);

export const PromoEyebrow = ({
  children,
  color = C.purple,
}: {
  children: ReactNode;
  color?: string;
}) => (
  <div
    style={{
      fontSize: 11,
      letterSpacing: "0.18em",
      color,
      fontWeight: 700,
      marginTop: 26,
    }}
  >
    {children}
  </div>
);

export const PromoTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontFamily: FONT_DISPLAY,
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: "-0.035em",
      lineHeight: 0.95,
      marginTop: 10,
      color: "#fff",
      ...style,
    }}
  >
    {children}
  </div>
);

export const PromoBody = ({ children, maxWidth = 280 }: { children: ReactNode; maxWidth?: number }) => (
  <div
    style={{
      fontSize: 14,
      color: C.dim,
      marginTop: 14,
      lineHeight: 1.5,
      maxWidth,
      marginLeft: "auto",
      marginRight: "auto",
    }}
  >
    {children}
  </div>
);

export const PromoCallout = ({ children, tone = "yellow" }: { children: ReactNode; tone?: "yellow" | "purple" }) => {
  const bg = tone === "yellow" ? C.yellowSoft : C.purpleSoft;
  const edge = tone === "yellow" ? "rgba(255,206,59,0.32)" : C.purpleEdge;
  const dot = tone === "yellow" ? C.yellow : C.purple;
  return (
    <div
      style={{
        marginTop: 18,
        padding: "12px 14px",
        borderRadius: 14,
        background: bg,
        boxShadow: `0 0 0 1px ${edge} inset`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
      }}
    >
      <span style={{ marginTop: 3, flexShrink: 0 }}>
        <Dot color={dot} />
      </span>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.88)", lineHeight: 1.45, textAlign: "left" }}>
        {children}
      </div>
    </div>
  );
};

export const PromoPill = ({ children, dotColor = C.yellow }: { children: ReactNode; dotColor?: string }) => (
  <div
    style={{
      marginTop: 26,
      padding: "10px 16px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      boxShadow: `0 0 0 1px ${C.line} inset`,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12,
      color: C.dim,
    }}
  >
    <Dot color={dotColor} />
    {children}
  </div>
);

type IconVariant = "waiting" | "success" | "rejected" | "error" | "loading";

const ICON_STYLES: Record<Exclude<IconVariant, "loading">, { bg: string; shadow: string; ring: string }> = {
  waiting: {
    bg: "linear-gradient(135deg, #FFCE3B, #FF9B3B)",
    shadow: "0 30px 60px -10px rgba(255,206,59,0.5)",
    ring: "0 0 0 6px rgba(255,206,59,0.12)",
  },
  success: {
    bg: "linear-gradient(135deg, #B084FF, #7C3AED 60%, #4B1F9A)",
    shadow: "0 30px 60px -10px rgba(124,58,237,0.7)",
    ring: "0 0 0 6px rgba(124,58,237,0.15)",
  },
  rejected: {
    bg: "linear-gradient(135deg, #6B7280, #4B5563)",
    shadow: "0 30px 60px -10px rgba(75,85,99,0.45)",
    ring: "0 0 0 6px rgba(107,114,128,0.12)",
  },
  error: {
    bg: "linear-gradient(135deg, #FF4D5E, #C41E3A)",
    shadow: "0 30px 60px -10px rgba(255,77,94,0.45)",
    ring: "0 0 0 6px rgba(255,77,94,0.12)",
  },
};

export const PromoStatusIcon = ({ variant }: { variant: IconVariant }) => {
  if (variant === "loading") {
    return (
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 36,
          background: "rgba(255,255,255,0.04)",
          boxShadow: `0 0 0 1px ${C.line} inset`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.12)",
            borderTopColor: C.purple,
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  const s = ICON_STYLES[variant];
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 36,
        background: s.bg,
        boxShadow: `${s.shadow}, ${s.ring}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: variant === "waiting" ? 8 : 0,
        flexShrink: 0,
      }}
    >
      {variant === "waiting" &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#1a1200",
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      {variant === "success" && (
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
          <path
            d="M10 24l10 10L38 14"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )}
      {(variant === "rejected" || variant === "error") && (
        <span style={{ fontSize: 36, fontWeight: 700, color: "#fff", lineHeight: 1 }}>✕</span>
      )}
    </div>
  );
};

export const PromoConfetti = () => (
  <>
    {(
      [
        ["12%", "18%", C.purple, 0],
        ["82%", "22%", C.green, 0.2],
        ["18%", "72%", C.yellow, 0.5],
        ["82%", "68%", C.red, 0.3],
        ["50%", "12%", "#fff", 0.6],
      ] as const
    ).map(([l, t, c, d], i) => (
      <div
        key={i}
        aria-hidden
        style={{
          position: "absolute",
          left: l,
          top: t,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: c,
          boxShadow: `0 0 12px ${c}`,
          animation: "pulse 1.6s ease-in-out infinite",
          animationDelay: `${d}s`,
        }}
      />
    ))}
  </>
);

export const PromoStatusLayout = ({
  glow = "purple",
  closeHref = "/",
  children,
  footer,
}: {
  glow?: GlowTone;
  closeHref?: string;
  children: ReactNode;
  footer?: ReactNode;
}) => (
  <>
    <PromoGlow tone={glow} />
    <div
      className="relative z-1 flex min-h-full flex-1 flex-col"
      style={{ padding: 22, minHeight: 0 }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
        <CloseBtn href={closeHref} />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "12px 0 24px",
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {children}
      </div>
      {footer && <div style={{ flexShrink: 0 }}>{footer}</div>}
    </div>
  </>
);

export const PromoLinkChip = ({
  prefix,
  code,
}: {
  prefix: string;
  code: string;
}) => (
  <div
    style={{
      marginTop: 22,
      padding: "14px 18px",
      borderRadius: 16,
      background: "rgba(0,0,0,0.4)",
      boxShadow: `0 0 0 1px ${C.line} inset`,
      fontFamily: FONT_MONO,
      fontSize: 13,
      fontWeight: 600,
      wordBreak: "break-all",
      width: "100%",
    }}
  >
    {prefix}
    <span style={{ color: C.purple }}>{code}</span>
  </div>
);

export const PromoGhostLink = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: "transparent",
      border: 0,
      color: C.dim,
      fontFamily: FONT_BODY,
      fontSize: 13,
      paddingBottom: 16,
      cursor: "pointer",
      width: "100%",
      textAlign: "center",
    }}
  >
    {children}
  </button>
);

export const PromoFeedback = ({
  variant,
  eyebrow,
  title,
  body,
  action,
  footer,
}: {
  variant: "loading" | "error";
  eyebrow: string;
  title: string;
  body?: string;
  action?: ReactNode;
  footer?: ReactNode;
}) => (
  <PromoStatusLayout
    glow={variant === "error" ? "error" : "purple"}
    closeHref="/"
    footer={footer}
  >
    <PromoStatusContent>
      <PromoStatusIcon variant={variant === "loading" ? "loading" : "error"} />
      <PromoEyebrow color={variant === "error" ? C.red : C.yellow}>{eyebrow}</PromoEyebrow>
      <PromoTitle>{title}</PromoTitle>
      {body && <PromoBody>{body}</PromoBody>}
      {action && <div style={{ marginTop: 20, width: "100%" }}>{action}</div>}
    </PromoStatusContent>
  </PromoStatusLayout>
);
