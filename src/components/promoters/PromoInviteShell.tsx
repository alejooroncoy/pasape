"use client";

import type { ReactNode } from "react";
import { C, FONT_BODY } from "@/components/design/tokens";

type Props = {
  children: ReactNode;
};

/**
 * Shell del flujo de invitación de promotores.
 * · Mobile: ocupa el viewport (como app nativa).
 * · Desktop (lg+): tarjeta centrada con borde y sombra — no mockup de celular.
 */
export const PromoInviteShell = ({ children }: Props) => (
  <div className="flex min-h-dvh w-full items-stretch justify-center bg-bg text-white lg:items-center lg:bg-[radial-gradient(ellipse_at_50%_20%,rgba(124,58,237,0.12),transparent_55%)] lg:p-10">
    <div
      className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-bg lg:min-h-[640px] lg:max-h-[min(88dvh,760px)] lg:rounded-[28px] lg:border lg:border-white/10 lg:shadow-[0_40px_80px_-40px_rgba(124,58,237,0.35)]"
      style={{ fontFamily: FONT_BODY, color: C.text }}
    >
      {/* min-h-0 + overflow-y-auto: en desktop la tarjeta tiene max-height; sin esto el contenido queda recortado. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  </div>
);

/** Barra de acción inferior integrada en la tarjeta. */
export const PromoInviteFooter = ({ children }: { children: ReactNode }) => (
  <div
    className="sticky bottom-0 z-2 px-[22px] pb-7 pt-4"
    style={{ background: `linear-gradient(to top, ${C.bg} 72%, transparent)` }}
  >
    {children}
  </div>
);
