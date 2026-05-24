"use client";

import { Suspense, use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { C, FONT_DISPLAY, Phone } from "@/components/design";
import { useOrgBySlug, useOrgEvents } from "@/lib/events/hooks/useOrgPublic";

type Params = Promise<{ slug: string; locale: string }>;

const COLOR_PAIRS: Array<[string, string]> = [
  ["#4B1F9A", "#FF4D5E"],
  ["#FF4D5E", "#FFCE3B"],
  ["#7C3AED", "#22D17F"],
  ["#22D17F", "#4B1F9A"],
];

export default function OrgPublicPage(props: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <OrgPublicInner {...props} />
    </Suspense>
  );
}

function OrgPublicInner({ params }: { params: Params }) {
  const { slug } = use(params);
  const org = useOrgBySlug(slug);
  const events = useOrgEvents(slug);
  const search = useSearchParams();

  useEffect(() => {
    const code = search.get("promo");
    if (!code || !events.data) return;
    for (const e of events.data) {
      try {
        window.localStorage.setItem(`pasape:promo:${e.slug}`, code);
      } catch {}
    }
  }, [search, events.data]);

  const initial = (org.data?.name ?? "·").charAt(0).toUpperCase();
  const list = events.data ?? [];

  return (
    <Phone>
      {/* Cover */}
      <div
        style={{
          position: "relative",
          height: 200,
          flexShrink: 0,
          background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 110%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(60% 50% at 30% 30%, rgba(255,255,255,0.3), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.5), transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: "linear-gradient(to bottom, transparent, " + C.bg + ")",
          }}
        />
      </div>

      <div style={{ padding: "0 18px", flex: 1, overflowY: "auto", paddingBottom: 32 }}>
        {/* Logo + follow row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 14,
            marginTop: -34,
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              background: "#fff",
              padding: 6,
              boxShadow: "0 0 0 3px " + C.bg + ", 0 16px 30px -10px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: 32,
              color: "#0A0A0F",
              letterSpacing: "-0.04em",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <button
            type="button"
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: 0,
              background: C.purple,
              color: "#fff",
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.04em",
              boxShadow: "0 8px 20px -4px rgba(124,58,237,0.5)",
              marginBottom: 6,
              cursor: "pointer",
            }}
          >
            + SEGUIR
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            {org.data?.name ?? (org.isLoading ? "Cargando…" : "Página no encontrada")}
          </div>
          {org.data && (
            <div
              style={{
                fontSize: 12,
                color: C.dim,
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span>@{org.data.slug}</span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 999,
                  background: C.dim,
                }}
              />
              <span>{org.data.timezone.split("/")[1] ?? org.data.timezone}</span>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.dim,
              letterSpacing: "0.08em",
              fontWeight: 600,
            }}
          >
            {list.length} EVENTO{list.length === 1 ? "" : "S"} PRÓXIMOS
          </div>
          <div style={{ fontSize: 11, color: C.dim }}>orden: + cerca</div>
        </div>

        {events.isLoading ? (
          <div style={{ padding: 18, fontSize: 13, color: C.dim, textAlign: "center" }}>
            Cargando eventos…
          </div>
        ) : list.length === 0 ? (
          <div
            style={{
              padding: 22,
              borderRadius: 16,
              background: C.bg2,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              fontSize: 13,
              color: C.dim,
              textAlign: "center",
            }}
          >
            Aún no hay eventos públicos.
          </div>
        ) : (
          list.map((e, i) => {
            const [c1, c2] = COLOR_PAIRS[i % COLOR_PAIRS.length];
            const featured = i === 0;
            const date = new Intl.DateTimeFormat("es-PE", {
              timeZone: e.timezone,
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(e.startsAt));
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 12px",
                  marginBottom: 8,
                  background: featured
                    ? `linear-gradient(135deg, ${c1}22, ${c2}11)`
                    : C.bg2,
                  boxShadow: featured
                    ? `0 0 0 1px ${c1}66 inset`
                    : `0 0 0 1px ${C.line} inset`,
                  borderRadius: 16,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage:
                        "radial-gradient(60% 50% at 30% 30%, rgba(255,255,255,0.3), transparent 60%)",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 600,
                      fontSize: 14,
                      lineHeight: 1.2,
                    }}
                  >
                    {e.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.purple,
                      marginTop: 4,
                      fontWeight: 600,
                    }}
                  >
                    {date}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{e.venue ?? ""}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Phone>
  );
}
