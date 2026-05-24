"use client";

import { use } from "react";
import { BackBtn, Bolt, Btn, C, CardBadge, FONT_DISPLAY, Phone, YapeBadge } from "@/components/design";
import { Link } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { formatDate, formatMoney } from "@/lib/_shared/format";

type Props = { params: Promise<{ slug: string }> };

export default function EventDetailPage({ params }: Props) {
  const { slug } = use(params);
  const { data, isLoading, error } = useEvent(slug);

  return (
    <Phone>
      {isLoading && <div style={{ padding: 28, color: C.dim }}>Cargando…</div>}
      {error && <div style={{ padding: 28, color: C.red }}>{(error as Error).message}</div>}

      {data && (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 340, overflow: "hidden" }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.5), transparent 60%)",
                }}
              />
              <div style={{ position: "absolute", bottom: 32, left: 22, right: 22, color: "#fff" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                  }}
                >
                  {formatDate(data.event.startsAt, data.event.timezone).toUpperCase()}
                </div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 36,
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    lineHeight: 0.95,
                    marginTop: 12,
                  }}
                >
                  {data.event.title}
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 40,
                  background: `linear-gradient(to bottom, transparent, ${C.bg})`,
                }}
              />
            </div>
          </div>

          <div style={{ position: "absolute", top: 16, left: 22, zIndex: 2 }}>
            <BackBtn />
          </div>

          <div style={{ marginTop: 340, padding: "4px 22px 110px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, color: C.dim }}>{data.event.venue ?? "Sin lugar definido"}</div>
                {data.ticketTypes.length > 0 && (
                  <div style={{ fontSize: 13, color: C.green, marginTop: 4 }}>
                    ● {data.ticketTypes.reduce((sum, tt) => sum + (tt.capacity - tt.sold), 0)} entradas disponibles
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: C.dim }}>DESDE</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700 }}>
                  {data.ticketTypes[0] ? formatMoney(data.ticketTypes[0].priceCents) : "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "12px 14px",
                borderRadius: 14,
                background: C.bg2,
                boxShadow: `0 0 0 1px ${C.line} inset`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <YapeBadge />
              <CardBadge />
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.dim }}>
                <Bolt /> Tu QR al instante
              </div>
            </div>

            {data.event.description && (
              <div
                style={{
                  marginTop: 14,
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.02)",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                  fontSize: 13,
                  color: C.dim,
                  lineHeight: 1.55,
                }}
              >
                {data.event.description}
              </div>
            )}

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.ticketTypes.map((tt) => {
                const remaining = tt.capacity - tt.sold;
                return (
                  <div
                    key={tt.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: C.bg2,
                      boxShadow: `0 0 0 1px ${C.line} inset`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>{tt.name}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>
                        {remaining > 0 ? `${remaining} disponibles` : "Agotado"}
                      </div>
                    </div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>
                      {formatMoney(tt.priceCents, tt.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, padding: "0 22px" }}>
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/events/${data.event.slug}/buy` as any}
              style={{ textDecoration: "none" }}
            >
              <Btn>Comprar entrada</Btn>
            </Link>
          </div>
        </>
      )}
    </Phone>
  );
}
