"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ticket, Compass, Share2, MoreVertical, Download } from "lucide-react";
import { useInstallNudge } from "@/lib/pwa/useInstallNudge";

// Aviso de "guarda la app" para quien abre el link de WhatsApp en el navegador
// in-app (WebView en Android, SFSafariViewController en iOS): ese contexto no
// garantiza que el Service Worker ni el login con Google sobrevivan a la
// próxima apertura. Instalar en pantalla de inicio es la única vía confiable.
// Ver AGENTS.md / memoria "wallet-offline-asistente" para el porqué completo.
export function InstallNudge({ className = "" }: { className?: string }) {
  const {
    show,
    platform,
    canPromptNative,
    androidLikelyInWebview,
    androidPromptConsumed,
    promptInstall,
    dismiss,
  } = useInstallNudge();
  const [expanded, setExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!show || !platform) return null;

  const onPrimaryAction = async () => {
    if (platform === "android" && canPromptNative) {
      setInstalling(true);
      await promptInstall();
      setInstalling(false);
      return; // aceptado o rechazado: el diálogo nativo ya se usó, no hay más que hacer acá
    }
    if (androidPromptConsumed) {
      dismiss(); // ya vio el diálogo nativo de Chrome — no hay nada más que ofrecer
      return;
    }
    setExpanded((v) => !v);
  };

  const primaryLabel =
    platform === "android" && canPromptNative
      ? installing
        ? "Instalando…"
        : "Instalar app"
      : androidPromptConsumed
        ? "Entendido"
        : expanded
          ? "Ocultar"
          : "Ver cómo";

  return (
    <div
      className={
        "rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 " + className
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-cart-accent-soft text-cart-accent">
          <Ticket size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-cart-ink">Guarda tu entrada para la puerta</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-cart-ink-3">
            Sin este paso, tu QR no abre si no hay señal esa noche.
          </p>
        </div>
      </div>

      {/* Acción principal a la derecha: en una mano, el pulgar recorre el borde
          derecho/inferior de la pantalla — es la zona que le sale natural,
          la izquierda le exige estirarse. "Ahora no" queda a propósito del
          otro lado: sigue accesible, pero no compite por el mismo gesto. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full px-2 py-2.5 text-[12px] font-medium text-cart-ink-4 transition hover:text-cart-ink-2"
        >
          Ahora no
        </button>
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={installing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2.5 text-[13px] font-semibold text-cart-bg transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
        >
          {platform === "android" && canPromptNative && <Download size={14} strokeWidth={2.4} />}
          {primaryLabel}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 space-y-2.5 border-t border-cart-line pt-3.5">
              {platform === "ios" ? (
                <>
                  <Step icon={<Compass size={14} strokeWidth={2} />}>
                    Sal de WhatsApp: toca el ícono de <b>brújula</b> para abrir esto en Safari.
                  </Step>
                  <Step icon={<Share2 size={14} strokeWidth={2} />}>
                    En Safari, toca <b>Compartir</b> y elige «Agregar a pantalla de inicio».
                  </Step>
                </>
              ) : (
                <>
                  <Step icon={<MoreVertical size={14} strokeWidth={2} />}>
                    Toca <b>⋮</b> y elige «Abrir en Chrome».
                  </Step>
                  <Step icon={<Download size={14} strokeWidth={2} />}>
                    En Chrome, toca <b>«Instalar»</b> cuando aparezca.
                  </Step>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solo Android sin señal de estar en Chrome real: aclara por qué el botón
          de arriba no instaló nada directamente. */}
      {platform === "android" && androidLikelyInWebview && !expanded && (
        <p className="mt-2 text-[11px] text-cart-ink-4">Esto se abrió dentro de WhatsApp — toca «Ver cómo».</p>
      )}
      {/* Ya vio y usó el diálogo nativo de Chrome (lo aceptó o lo cerró): no
          hay una segunda oportunidad automática esta sesión — solo indicamos
          cómo instalarla a mano después, sin instrucciones de "salir a Chrome"
          que no aplican (ya está ahí). */}
      {androidPromptConsumed && (
        <p className="mt-2 text-[11px] text-cart-ink-4">
          Puedes instalarla luego desde el menú ⋮ de Chrome → «Instalar app».
        </p>
      )}
    </div>
  );
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-cart-ink-3">
        {icon}
      </span>
      <p className="text-[12px] leading-snug text-cart-ink-2">
        {children}
      </p>
    </div>
  );
}
