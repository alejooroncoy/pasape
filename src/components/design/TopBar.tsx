import type { ReactNode } from "react";
import { C, FONT_DISPLAY } from "./tokens";

type Props = { title: string; right?: ReactNode; hello?: string };

export const TopBar = ({ title, right, hello }: Props) => (
  <div style={{ padding: "6px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div>
      {hello && (
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
          {hello}
        </div>
      )}
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
    </div>
    {right}
  </div>
);
