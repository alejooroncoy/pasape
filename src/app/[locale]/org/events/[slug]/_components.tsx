"use client";

import { C, FONT_DISPLAY } from "@/components/design";
import { Link, useRouter } from "@/i18n/navigation";

export const BackBtn = ({ href }: { href?: string }) => {
  const router = useRouter();
  const inner = (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M10 3L5 8l5 5"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
  if (href) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return <Link href={href as any}>{inner}</Link>;
  }
  return <button type="button" onClick={() => router.back()} style={{ border: 0, background: "transparent", padding: 0 }}>{inner}</button>;
};

type Tab = "panel" | "accesos" | "config";

export const LiveBottomNav = ({ slug, active }: { slug: string; active: Tab }) => {
  const items: Array<{ key: Tab; label: string; href: string }> = [
    { key: "panel", label: "Panel", href: `/org/events/${slug}` },
    { key: "accesos", label: "Accesos", href: `/org/events/${slug}/accesos` },
    { key: "config", label: "Configurar", href: `/org/events/${slug}/configurar` },
  ];
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "8px 18px 18px",
        background: "linear-gradient(to top, " + C.bg + " 70%, transparent)",
        display: "flex",
        gap: 6,
        flexShrink: 0,
      }}
    >
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key}
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            href={it.href as any}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              background: on ? C.purpleSoft : "rgba(255,255,255,0.04)",
              boxShadow: on
                ? `0 0 0 1px ${C.purpleEdge} inset`
                : `0 0 0 1px ${C.line} inset`,
              color: on ? "#fff" : C.dim,
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
};
