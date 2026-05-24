"use client";

import { use } from "react";
import { BackBtn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { useDecideApplication, usePendingApplications } from "@/lib/promoters/hooks/usePromoter";

type Props = { params: Promise<{ slug: string }> };

export default function OrgPendingRequestsPage({ params }: Props) {
  const { slug } = use(params);
  const pending = usePendingApplications(slug);
  const decide = useDecideApplication(slug);
  const count = pending.data?.length ?? 0;

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>SOLICITUDES</div>
        <div
          style={{
            minWidth: 26,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            background: C.red,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count}
        </div>
      </div>
      <div style={{ padding: "8px 22px 32px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {count === 0 ? (
            <>Sin solicitudes<br />pendientes.</>
          ) : (
            <>
              {count} {count === 1 ? "persona quiere" : "personas quieren"}
              <br />
              ser tus <span style={{ color: C.purple }}>promotores.</span>
            </>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 1.4 }}>
          Entraron por tu link. Acepta solo a los que conozcas.
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.data?.map((req) => {
            const initial = req.applicantName[0]?.toUpperCase() ?? "?";
            const isPendingDecision = decide.isPending && decide.variables?.applicationId === req.id;
            return (
              <div
                key={req.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: C.purple,
                      color: "#fff",
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
                    }}
                  >
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>{req.applicantName}</div>
                    <div style={{ fontSize: 11, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {req.applicantHandle ?? "sin contacto"}
                    </div>
                  </div>
                </div>
                {req.message && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.03)",
                      fontSize: 11,
                      color: C.dim,
                      marginBottom: 10,
                    }}
                  >
                    {req.message}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    disabled={isPendingDecision}
                    onClick={() => decide.mutate({ applicationId: req.id, decision: "rejected" })}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 12,
                      border: 0,
                      background: "rgba(255,255,255,0.06)",
                      color: C.dim,
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={isPendingDecision}
                    onClick={() =>
                      decide.mutate({ applicationId: req.id, decision: "approved", commissionPct: 15 })
                    }
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 12,
                      border: 0,
                      background: C.purple,
                      color: "#fff",
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 13,
                      boxShadow: "0 8px 20px -4px rgba(124,58,237,0.5)",
                      cursor: "pointer",
                    }}
                  >
                    {isPendingDecision ? "…" : "Aceptar"}
                  </button>
                </div>
              </div>
            );
          })}
          {pending.data && pending.data.length === 0 && (
            <div style={{ padding: 16, color: C.dim }}>Aún no hay solicitudes.</div>
          )}
        </div>
      </div>
    </Phone>
  );
}
