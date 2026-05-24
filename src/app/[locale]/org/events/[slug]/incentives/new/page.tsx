"use client";

import { use, useState } from "react";
import { Btn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useCreateIncentive } from "@/lib/promoters/incentives/hooks/useIncentives";
import { BackBtn } from "../../_components";

type Params = Promise<{ slug: string; locale: string }>;

const PRESETS = [
  { reward: "Botella gratis 🍾", color: C.purple },
  { reward: "Pase VIP + 1 amigo 🎟", color: C.yellow },
  { reward: "Bono S/ 200 💵", color: C.green },
  { reward: "Backstage 🌟", color: C.red },
];

export default function OrgIncentiveCreatePage({ params }: { params: Params }) {
  const { slug } = use(params);
  const router = useRouter();
  const create = useCreateIncentive(slug);

  const [goalValue, setGoalValue] = useState(20);
  const [presetIdx, setPresetIdx] = useState(0);
  const reward = PRESETS[presetIdx].reward;

  const submit = async () => {
    await create.mutateAsync({
      audience: "promoter",
      name: reward,
      goalKind: "tickets_sold",
      goalValue,
      reward,
    });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    router.push(`/org/events/${slug}/incentives` as any);
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
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>NUEVO INCENTIVO</div>
        <div style={{ width: 38 }} />
      </div>
      <div style={{ padding: "22px 22px 110px", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            marginBottom: 22,
          }}
        >
          Si vende ___,
          <br />
          recibe ___.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: C.dim,
              marginBottom: 8,
              letterSpacing: "0.04em",
            }}
          >
            CUÁNDO LO GANA
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.04)",
              boxShadow: `0 0 0 1px ${C.line} inset`,
            }}
          >
            <div style={{ fontSize: 14, color: C.dim }}>Al vender</div>
            <input
              type="number"
              min={1}
              value={goalValue}
              onChange={(e) => setGoalValue(Math.max(1, Number(e.target.value) || 0))}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                background: C.purpleSoft,
                boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 22,
                color: "#fff",
                minWidth: 70,
                textAlign: "center",
                border: 0,
                outline: "none",
              }}
            />
            <div style={{ fontSize: 14, color: C.dim }}>entradas</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: C.dim,
              marginBottom: 8,
              letterSpacing: "0.04em",
            }}
          >
            QUÉ SE GANA
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PRESETS.map((p, i) => (
              <button
                key={p.reward}
                type="button"
                onClick={() => setPresetIdx(i)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background:
                    i === presetIdx ? `${p.color}22` : "rgba(255,255,255,0.04)",
                  boxShadow:
                    i === presetIdx
                      ? `0 0 0 1.5px ${p.color} inset`
                      : `0 0 0 1px ${C.line} inset`,
                  fontSize: 14,
                  color: "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                  border: 0,
                }}
              >
                {p.reward}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 22,
            padding: "12px 14px",
            borderRadius: 14,
            background: C.purpleSoft,
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.purple,
              fontWeight: 700,
            }}
          >
            VERÁ ASÍ:
          </span>
          <span style={{ fontSize: 13 }}>
            &ldquo;Te faltan <strong>X</strong> entradas para tu{" "}
            <strong>{reward}</strong>&rdquo;
          </span>
        </div>

        {create.error && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.red }}>
            {(create.error as Error).message}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", bottom: 32, left: 22, right: 22 }}>
        <Btn onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Guardando…" : "Guardar incentivo"}
        </Btn>
      </div>
    </Phone>
  );
}
