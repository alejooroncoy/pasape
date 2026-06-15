"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { BackBtn, C, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useGenerateInvite, usePendingApplications, useRealtimePromoterApplications } from "@/lib/promoters/hooks/usePromoter";

const CopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="6" y="6" width="11" height="11" rx="2.5" stroke={C.purple} strokeWidth="1.6" />
    <path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H6" stroke={C.purple} strokeWidth="1.6" />
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M11 5l-3-3-3 3M8 2v9M3 9v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9" stroke="#0A0A0F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Props = { params: Promise<{ slug: string }> };

const RoleTab = ({ label, sub, on }: { label: string; sub: string; on?: boolean }) => (
  <div
    style={{
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      textAlign: "center",
      background: on ? "#fff" : "transparent",
      color: on ? "#0A0A0F" : C.dim,
    }}
  >
    <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
    <div style={{ fontSize: 10, color: on ? "rgba(0,0,0,0.55)" : C.dimmer, marginTop: 2 }}>{sub}</div>
  </div>
);

const SettingRow = ({
  label,
  value,
  badge,
  highlight,
}: {
  label: string;
  value: string;
  badge?: string | number;
  highlight?: boolean;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px",
      marginBottom: 8,
      background: highlight ? C.purpleSoft : "rgba(255,255,255,0.03)",
      boxShadow: `0 0 0 1px ${highlight ? C.purpleEdge : C.line} inset`,
      borderRadius: 14,
    }}
  >
    <span style={{ fontSize: 13, color: C.dim }}>{label}</span>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}>{value}</span>
      {badge !== undefined && (
        <div
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            background: C.red,
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge}
        </div>
      )}
    </div>
  </div>
);

export default function OrgInviteLinkPage({ params }: Props) {
  const { slug } = use(params);
  const generate = useGenerateInvite();
  const pending = usePendingApplications(slug);
  useRealtimePromoterApplications(slug);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!generate.data && !generate.isPending) {
      generate.mutate({ eventSlug: slug, commissionPct: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const baseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const fullUrl = generate.data ? `${baseUrl}${generate.data.url}` : "";
  const pretty = fullUrl.replace(/^https?:\/\//, "");

  const onCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard?.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const onShare = async () => {
    if (!fullUrl) return;
    if (navigator.share) await navigator.share({ url: fullUrl, title: "Sé promotor" }).catch(() => {});
    else onCopy();
  };

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>INVITAR POR LINK</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "14px 22px 32px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Compártelo en stories.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.4 }}>
          Quien le dé clic pedirá ser promotor. Tú apruebas a quién dejas entrar.
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 0,
            padding: 4,
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            boxShadow: `0 0 0 1px ${C.line} inset`,
          }}
        >
          <RoleTab label="Promotor" sub="15% comisión" on />
          <RoleTab label="Co-organizador" sub="acceso total" />
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 22,
            background: "linear-gradient(180deg, rgba(124,58,237,0.22), rgba(20,12,40,0.4))",
            boxShadow: `0 0 0 1.5px ${C.purpleEdge} inset, 0 20px 60px -20px rgba(124,58,237,0.35)`,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.14em", color: C.purple, fontWeight: 700, marginBottom: 12 }}>
            ◆ LINK DE PROMOTOR
          </div>
          <button
            type="button"
            onClick={onCopy}
            style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 14,
              padding: "14px 16px",
              fontFamily: FONT_MONO,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              width: "100%",
              color: "#fff",
              border: 0,
              cursor: "pointer",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {generate.isPending ? "Generando…" : copied ? "¡copiado!" : pretty || "—"}
            </span>
            <CopyIcon />
          </button>
          <button
            type="button"
            onClick={onShare}
            style={{
              marginTop: 10,
              height: 50,
              width: "100%",
              border: 0,
              borderRadius: 14,
              background: "#fff",
              color: "#0A0A0F",
              fontFamily: FONT_DISPLAY,
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <ShareIcon /> Compartir el link
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <SettingRow label="Vence" value="al cerrar el evento" />
          <SettingRow label="Aprobación" value="manual · uno por uno" highlight />
          <Link href={`/org/events/${slug}/invite/requests`} style={{ textDecoration: "none", color: "inherit" }}>
            <SettingRow
              label="Solicitudes"
              value={`${pending.data?.length ?? 0} pendientes`}
              badge={pending.data?.length || undefined}
            />
          </Link>
        </div>
      </div>
    </Phone>
  );
}
