"use client";

// Puente para el botón del WhatsApp "Invitar a mi box": Meta no permite que
// un botón de template enlace directo a wa.me, así que el botón apunta acá
// (dominio propio) y esta página redirige de inmediato a WhatsApp con el
// mensaje ya armado — mismo texto que BoxPanel.share() en /tickets/[id].
import { use, useEffect } from "react";
import { useBoxByToken } from "@/lib/boxes/hooks/useBoxes";
import { C } from "@/components/design";
import { Logo } from "@/components/brand/Logo";

type Props = { params: Promise<{ token: string }> };

export default function BoxShareRedirectPage({ params }: Props) {
  const { token } = use(params);
  const box = useBoxByToken(token);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const inviteUrl = `${origin}/box/${token}`;
  const waUrl = box.data
    ? `https://wa.me/?text=${encodeURIComponent(`Sumate a mi box en ${box.data.event.title}: ${inviteUrl}`)}`
    : null;

  useEffect(() => {
    if (waUrl) window.location.replace(waUrl);
  }, [waUrl]);

  return (
    <div className="home-light" style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column" }}>
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-3.5">
          <span className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
            <span className="grid size-8 place-items-center">
              <Logo className="size-full drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]" />
            </span>
            <span>Pasape</span>
          </span>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        {box.isLoading ? (
          <div style={{ color: C.dim, fontSize: 13.5 }}>Abriendo WhatsApp…</div>
        ) : box.error || !box.data ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.red, fontSize: 14 }}>Este link de BOX no es válido o expiró.</div>
          </div>
        ) : (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <div style={{ color: C.dim, fontSize: 13.5 }}>Abriendo WhatsApp…</div>
            {waUrl && (
              <a href={waUrl} style={{ color: "#25D366", fontSize: 13.5, fontWeight: 700 }}>
                ¿No se abrió? Toca acá
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
