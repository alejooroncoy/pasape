"use client";

import { use, useState } from "react";
import { Btn, C, FONT_DISPLAY, FONT_MONO, Phone } from "@/components/design";
import { BackBtn } from "../../../_components";
import {
  useCommissionTiers,
  useCreateCommissionTier,
  useDeleteCommissionTier,
  type CreateTierInput,
} from "@/lib/promoters/tiers/hooks/useCommissionTiers";

type Params = Promise<{ slug: string; linkId: string; locale: string }>;

const REWARD_KINDS: Array<{ kind: CreateTierInput["rewardKind"]; label: string }> = [
  { kind: "cash", label: "Efectivo" },
  { kind: "bottle", label: "Botella" },
  { kind: "custom", label: "Otro" },
];

export default function OrgPromoterTiersPage({ params }: { params: Params }) {
  const { linkId } = use(params);
  const tiers = useCommissionTiers(linkId);
  const create = useCreateCommissionTier(linkId);
  const del = useDeleteCommissionTier(linkId);

  const [threshold, setThreshold] = useState(10);
  const [rewardKind, setRewardKind] = useState<CreateTierInput["rewardKind"]>("cash");
  const [rewardLabel, setRewardLabel] = useState("S/ 100");
  const [rewardAmountSoles, setRewardAmountSoles] = useState<number>(100);

  const items = tiers.data ?? [];

  const submit = async () => {
    const amountCents =
      rewardKind === "cash" ? Math.round((rewardAmountSoles || 0) * 100) : null;
    const finalLabel =
      rewardKind === "cash"
        ? `S/ ${rewardAmountSoles}`
        : rewardLabel.trim() || (rewardKind === "bottle" ? "Botella" : "Premio");
    await create.mutateAsync({
      thresholdCount: Math.max(1, threshold),
      rewardKind,
      rewardAmountCents: amountCents,
      rewardLabel: finalLabel,
    });
  };

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
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>HITOS</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "14px 22px 24px" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Hitos de comisión
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>
          Negocia escalones individuales con este promotor.
        </div>
      </div>

      <div style={{ padding: "0 22px 24px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tiers.isLoading ? (
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
              Sin hitos aún. Crea el primero abajo.
            </div>
          ) : (
            items.map((t) => {
              const unlocked = !!t.unlockedAt;
              return (
                <div
                  key={t.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: unlocked
                      ? `${C.green}14`
                      : "rgba(255,255,255,0.03)",
                    boxShadow: unlocked
                      ? `0 0 0 1px ${C.green}88 inset`
                      : `0 0 0 1px ${C.line} inset`,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      minWidth: 56,
                      padding: "6px 8px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.05)",
                      textAlign: "center",
                      fontFamily: FONT_MONO,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {t.thresholdCount}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>
                      {t.rewardLabel}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                      {unlocked ? "✓ Desbloqueado" : "Pendiente"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => del.mutate(t.id)}
                    disabled={del.isPending}
                    style={{
                      background: "transparent",
                      color: C.dim,
                      border: 0,
                      fontSize: 18,
                      cursor: "pointer",
                      padding: 6,
                    }}
                    aria-label="Eliminar hito"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            marginTop: 22,
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.03)",
            boxShadow: `0 0 0 1px ${C.line} inset`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.04em" }}>
            NUEVO HITO
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: C.dim }}>Al vender (entradas)</span>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) =>
                setThreshold(Math.max(1, Number(e.target.value) || 0))
              }
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: C.purpleSoft,
                boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 18,
                color: "#fff",
                border: 0,
                outline: "none",
              }}
            />
          </label>

          <div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>
              Tipo de recompensa
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {REWARD_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setRewardKind(k.kind)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    background:
                      rewardKind === k.kind
                        ? `${C.purple}22`
                        : "rgba(255,255,255,0.04)",
                    boxShadow:
                      rewardKind === k.kind
                        ? `0 0 0 1.5px ${C.purple} inset`
                        : `0 0 0 1px ${C.line} inset`,
                    fontSize: 13,
                    color: "#fff",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {rewardKind === "cash" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: C.dim }}>Monto en soles</span>
              <input
                type="number"
                min={0}
                value={rewardAmountSoles}
                onChange={(e) =>
                  setRewardAmountSoles(Math.max(0, Number(e.target.value) || 0))
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#fff",
                  border: 0,
                  outline: "none",
                }}
              />
            </label>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: C.dim }}>Descripción</span>
              <input
                type="text"
                value={rewardLabel}
                onChange={(e) => setRewardLabel(e.target.value)}
                placeholder={rewardKind === "bottle" ? "Botella de ron" : "Premio"}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                  fontSize: 14,
                  color: "#fff",
                  border: 0,
                  outline: "none",
                }}
              />
            </label>
          )}

          <Btn onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Guardando…" : "+ Agregar hito"}
          </Btn>
          {create.error && (
            <div style={{ fontSize: 12, color: C.red }}>
              {(create.error as Error).message}
            </div>
          )}
        </div>
      </div>
    </Phone>
  );
}
