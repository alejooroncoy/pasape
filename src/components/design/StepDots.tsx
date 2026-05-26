import { C } from "./tokens";

type Props = { step: number; of: number };

export const StepDots = ({ step, of }: Props) => (
  <div style={{ display: "flex", gap: 6 }}>
    {Array.from({ length: of }).map((_, i) => {
      const active = i === step;
      const past = i < step;
      return (
        <div
          key={i}
          style={{
            width: active ? 20 : 6,
            height: 4,
            borderRadius: 999,
            background: active || past ? C.purple : "rgba(255,255,255,0.14)",
            boxShadow: active ? "0 0 10px rgba(124,58,237,0.7)" : "none",
            transition: "width .2s",
          }}
        />
      );
    })}
  </div>
);
