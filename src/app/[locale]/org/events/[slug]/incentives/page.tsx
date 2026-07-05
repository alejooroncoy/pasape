"use client";

import { use } from "react";
import { Btn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { Link } from "@/i18n/navigation";
import { useEventIncentives } from "@/lib/promoters/incentives/hooks/useIncentives";
import { BackBtn } from "../_components";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgIncentivesListPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const list = useEventIncentives(slug);

  const items = list.data ?? [];
  const active = items.filter((i) => i.active).length;
  const withUnlocks = items.filter((i) => i.unlockedCount > 0).length;

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>INCENTIVOS</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "8px 22px 110px", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
          }}
        >
          Motiva a tu
          <br />
          equipo.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.4 }}>
          {active} metas activas · {withUnlocks} con desbloqueos
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {list.isLoading ? (
            <div style={{ padding: 18, fontSize: 13, color: C.dim, textAlign: "center" }}>
              Cargando…
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 22,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                boxShadow: `0 0 0 1px ${C.line} inset`,
                fontSize: 13,
                color: C.dim,
                textAlign: "center",
              }}
            >
              Todavía no hay incentivos. Crea el primero.
            </div>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: `${C.purple}22`,
                    boxShadow: `0 0 0 1px ${C.purple}55 inset`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    color: C.purple,
                  }}
                >
                  PR
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>
                    {it.reward}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                    al llegar a {it.goalValue}{" "}
                    {it.goalKind === "tickets_sold"
                      ? "ventas"
                      : it.goalKind === "revenue_cents"
                        ? "cents"
                        : "referidos"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {it.unlockedCount}
                  </div>
                  <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.04em" }}>
                    DESBLOQUEARON
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 32, left: 22, right: 22 }}>
        <Link
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          href={`/org/events/${slug}/incentives/new` as any}
          style={{ textDecoration: "none" }}
        >
          <Btn>+ Agregar incentivo</Btn>
        </Link>
      </div>
    </Phone>
  );
}
