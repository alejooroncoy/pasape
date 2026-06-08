"use client";

import { use } from "react";
import { BackBtn, C, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { useEventIncentives } from "@/lib/promoters/incentives/hooks/useIncentives";
import { usePromoterHome } from "@/lib/promoters/hooks/usePromoter";
import { useCommissionTiers } from "@/lib/promoters/tiers/hooks/useCommissionTiers";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

const accentFor = (i: number) => [C.purple, C.yellow, C.green, C.red][i % 4];

export default function PromoIncentivesPage({ params }: Props) {
  const { slug } = use(params);
  const incentives = useEventIncentives(slug);
  const home = usePromoterHome(slug);
  const progress = home.data?.soldCount ?? 0;
  const tiers = useCommissionTiers(home.data?.link.id);

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>TUS METAS</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "14px 22px 32px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Vende más,<br />gana más.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>
          Has vendido <strong style={{ color: "#fff" }}>{progress} entradas</strong> esta noche
        </div>

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          {incentives.data
            ?.filter((i) => i.audience === "promoter")
            .map((inc, idx) => {
              const accent = accentFor(idx);
              const pct = Math.min(1, progress / inc.goalValue);
              const remaining = Math.max(0, inc.goalValue - progress);
              const unlocked = inc.isUnlockedByMe;
              const active = !unlocked && progress > 0;
              const card = (
                <div
                  key={inc.id}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 18,
                    background: unlocked
                      ? `linear-gradient(135deg, ${accent}26, ${accent}06)`
                      : active
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(255,255,255,0.02)",
                    boxShadow: unlocked
                      ? `0 0 0 1.5px ${accent}88 inset, 0 0 24px -8px ${accent}99`
                      : active
                        ? `0 0 0 1px ${C.line2} inset`
                        : `0 0 0 1px ${C.line} inset`,
                    opacity: !unlocked && !active ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: unlocked ? accent : `${accent}22`,
                        boxShadow: unlocked ? `0 0 20px ${accent}80` : `0 0 0 1px ${accent}40 inset`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                      }}
                    >
                      🎁
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
                        {inc.reward}
                      </div>
                      <div style={{ fontSize: 12, color: unlocked ? accent : C.dim, fontWeight: unlocked ? 600 : 400, marginTop: 2 }}>
                        {unlocked
                          ? "✓ Conseguida — pídela al organizador"
                          : active
                            ? `Te faltan ${remaining} entradas`
                            : `Vende ${inc.goalValue} entradas`}
                      </div>
                    </div>
                  </div>

                  {!unlocked && (
                    <div>
                      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct * 100}%`,
                            background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                            boxShadow: active ? `0 0 10px ${accent}AA` : "none",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.dim, fontFamily: FONT_MONO }}>
                        <span>{progress}</span>
                        <span>{inc.goalValue}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
              return unlocked ? (
                <Link
                  key={inc.id}
                  href={`/promo/${slug}/incentives/${inc.id}/unlocked`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {card}
                </Link>
              ) : (
                card
              );
            })}
          {incentives.data && incentives.data.length === 0 && (
            <div style={{ padding: 16, color: C.dim }}>Aún no hay metas para este evento.</div>
          )}
        </div>

        {tiers.data && tiers.data.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                fontSize: 12,
                color: C.dim,
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              TUS HITOS NEGOCIADOS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tiers.data.map((t, idx) => {
                const accent = accentFor(idx);
                const unlocked = !!t.unlockedAt;
                const pct = Math.min(1, progress / t.thresholdCount);
                const remaining = Math.max(0, t.thresholdCount - progress);
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 16,
                      background: unlocked
                        ? `linear-gradient(135deg, ${accent}26, ${accent}06)`
                        : "rgba(255,255,255,0.03)",
                      boxShadow: unlocked
                        ? `0 0 0 1.5px ${accent}88 inset, 0 0 24px -8px ${accent}99`
                        : `0 0 0 1px ${C.line} inset`,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: unlocked ? accent : `${accent}22`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                        }}
                      >
                        {t.rewardKind === "cash"
                          ? "💵"
                          : t.rewardKind === "bottle"
                            ? "🍾"
                            : "🎁"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: FONT_DISPLAY,
                            fontWeight: 700,
                            fontSize: 15,
                          }}
                        >
                          {t.rewardLabel}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: unlocked ? accent : C.dim,
                            marginTop: 2,
                          }}
                        >
                          {unlocked
                            ? "✓ Conseguido"
                            : `Faltan ${remaining} ventas (${t.thresholdCount} en total)`}
                        </div>
                      </div>
                    </div>
                    {!unlocked && (
                      <div style={{ marginTop: 10 }}>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.06)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct * 100}%`,
                              background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 4,
                            fontSize: 10,
                            color: C.dim,
                            fontFamily: FONT_MONO,
                          }}
                        >
                          <span>{progress}</span>
                          <span>{t.thresholdCount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Phone>
  );
}
