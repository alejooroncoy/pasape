"use client";

import { BackBtn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { useMyEarnings } from "@/lib/promoters/hooks/usePromoter";
import { formatMoney } from "@/lib/_shared/format";

const Kpi = ({ n, k }: { n: string; k: string }) => (
  <div style={{ padding: "14px 16px", background: C.bg2, borderRadius: 16, boxShadow: `0 0 0 1px ${C.line} inset` }}>
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>{n}</div>
    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{k}</div>
  </div>
);

export default function PromoEarningsPage() {
  const { data, isLoading } = useMyEarnings();
  const total = data?.reduce((a, e) => a + e.commissionCents, 0) ?? 0;
  const top = data?.[0];
  const ticketsTotal = data?.reduce((a, e) => a + e.ticketsSold, 0) ?? 0;
  const avgCommission =
    data && data.length > 0
      ? Math.round(data.reduce((a, e) => a + e.commissionPct, 0) / data.length)
      : 0;

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>TUS GANANCIAS</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "12px 22px 32px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: C.dim }}>Acumulado total</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 80, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.95, marginTop: 8 }}>
          <span style={{ color: C.purple }}>{formatMoney(total).replace(/[^\d,]/g, "")}</span>
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: C.dim }}>{formatMoney(total).replace(/[\d,]/g, "")} · {data?.length ?? 0} {data?.length === 1 ? "noche" : "noches"}</div>

        {top && top.commissionCents > 0 && (
          <div
            style={{
              marginTop: 18,
              padding: "16px 18px",
              borderRadius: 18,
              background: C.yellowSoft,
              boxShadow: "0 0 0 1px rgba(255,206,59,0.3) inset",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 999, background: C.yellow, boxShadow: `0 0 10px ${C.yellow}` }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Pago pendiente: {formatMoney(top.commissionCents)}</div>
              <div style={{ fontSize: 12, color: C.dim }}>De {top.eventTitle}</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Kpi n={String(ticketsTotal)} k="Tus ventas" />
          <Kpi n={`${avgCommission}%`} k="Comisión media" />
        </div>

        <div style={{ marginTop: 22, fontSize: 11, color: C.dim, letterSpacing: "0.08em", fontWeight: 600 }}>HISTORIAL</div>
        {isLoading && <div style={{ padding: 16, color: C.dim }}>Cargando…</div>}
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {data?.map((e) => (
            <div
              key={e.eventId}
              style={{
                padding: "14px 16px",
                background: C.bg2,
                borderRadius: 16,
                boxShadow: `0 0 0 1px ${C.line} inset`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.eventTitle}
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                  {e.ticketsSold} ventas · {e.commissionPct}%
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {formatMoney(e.commissionCents)}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    background: e.payoutStatus === "paid" ? C.greenSoft : C.yellowSoft,
                    color: e.payoutStatus === "paid" ? C.green : C.yellow,
                  }}
                >
                  {e.payoutStatus === "paid" ? "PAGADO" : "PENDIENTE"}
                </div>
              </div>
            </div>
          ))}
          {data && data.length === 0 && (
            <div style={{ padding: 16, color: C.dim }}>Aún no tienes ganancias acumuladas.</div>
          )}
        </div>
      </div>
    </Phone>
  );
}
