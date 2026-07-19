"use client";

import { useEffect, useState, type ReactElement, type SVGProps } from "react";
import { motion } from "motion/react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  HeartIcon,
  HomeIcon,
  TicketIcon,
  UserIcon,
} from "@/app/[locale]/_home/icons";
import { useHasNewTickets } from "@/lib/identity/hooks/useNotifications";

// Nav inferior persistente para el comprador en móvil/tablet (oculto en ≥lg,
// donde manda el rail lateral). Navega por ruta y resalta el tab activo.
// Componente único compartido por todas las superficies del comprador
// (home, tickets, perfil, favoritos) — micro-animaciones centralizadas aquí.
//
// Login: los tabs protegidos navegan normal a su página aunque no haya sesión.
// Cada página muestra su LoginGate con `next`, de modo que tras el login con
// Google (round-trip que saca de la app) el usuario vuelve EXACTO a su destino.
// Un drawer aquí perdería ese destino, así que a propósito no se usa.
type Tab = {
  id: string;
  label: string;
  href: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
};

const TABS: Tab[] = [
  { id: "home", label: "Inicio", href: "/", Icon: HomeIcon },
  { id: "tickets", label: "Mis entradas", href: "/tickets", Icon: TicketIcon },
  { id: "favs", label: "Favoritos", href: "/favorites", Icon: HeartIcon },
  { id: "me", label: "Cuenta", href: "/profile", Icon: UserIcon },
];

function activeId(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/tickets")) return "tickets";
  if (pathname.startsWith("/favorites")) return "favs";
  if (pathname.startsWith("/profile") || pathname.startsWith("/account")) return "me";
  return "";
}

export function UserTabbar() {
  const pathname = usePathname();
  const active = activeId(pathname);
  const hasNewTickets = useHasNewTickets();
  const [useCompactBrowserDock, setUseCompactBrowserDock] = useState(false);
  const [keyboardIsOpen, setKeyboardIsOpen] = useState(false);

  // Safari de iOS 26 sube los elementos `fixed` sobre su barra de URL Liquid
  // Glass. Conservamos los accesos, pero en Safari web los presentamos como un
  // dock compacto; la app instalada y los demás navegadores usan el tabbar
  // completo de Pasape.
  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateDockFormat = () => {
      const safariNavigator = navigator as Navigator & { standalone?: boolean };
      const isStandalone = standaloneQuery.matches || safariNavigator.standalone === true;
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setUseCompactBrowserDock(isIOS && !isStandalone);
    };

    standaloneQuery.addEventListener("change", updateDockFormat);
    updateDockFormat();

    return () => standaloneQuery.removeEventListener("change", updateDockFormat);
  }, []);

  // En iOS Safari el teclado reduce el *visual viewport*, pero los elementos
  // `position: fixed` pueden seguir anclados al layout viewport. Es justo lo
  // que deja el tabbar flotando sobre el contenido. Al escribir no es una
  // navegación útil, así que lo retiramos hasta que el viewport vuelva a su
  // tamaño normal.
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const isTextControlFocused = () => {
      const element = document.activeElement;
      return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement ||
        (element instanceof HTMLElement && element.isContentEditable)
      );
    };

    const updateKeyboardState = () => {
      const keyboardHeight = window.innerHeight - visualViewport.height;
      setKeyboardIsOpen(isTextControlFocused() && keyboardHeight > 140);
    };

    // Safari puede notificar el cambio del viewport después del focusout.
    const updateAfterFocusChange = () => window.setTimeout(updateKeyboardState, 150);

    visualViewport.addEventListener("resize", updateKeyboardState);
    visualViewport.addEventListener("scroll", updateKeyboardState, { passive: true });
    window.addEventListener("resize", updateKeyboardState);
    document.addEventListener("focusin", updateKeyboardState);
    document.addEventListener("focusout", updateAfterFocusChange);
    updateKeyboardState();

    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardState);
      visualViewport.removeEventListener("scroll", updateKeyboardState);
      window.removeEventListener("resize", updateKeyboardState);
      document.removeEventListener("focusin", updateKeyboardState);
      document.removeEventListener("focusout", updateAfterFocusChange);
    };
  }, []);

  if (keyboardIsOpen) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className={
        "fixed z-[70] block backdrop-blur-xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(24px)_saturate(150%)] lg:hidden " +
        (useCompactBrowserDock
          ? "bottom-2 left-1/2 w-[calc(100%-32px)] max-w-[390px] -translate-x-1/2 rounded-[22px] border border-cart-line-strong bg-cart-bg/90 px-2 py-1.5 shadow-[0_12px_30px_-12px_rgba(28,16,67,0.45)]"
          : "inset-x-0 bottom-0 border-t border-cart-line bg-cart-bg/95 px-1 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-1.5")
      }
    >
      <div className="mx-auto grid max-w-[540px] grid-cols-4">
        {TABS.map(({ id, label, href, Icon }) => {
          const isOn = active === id;
          const dot = id === "tickets" && hasNewTickets;
          return (
            <Link
              key={id}
              href={href as never}
              aria-current={isOn ? "page" : undefined}
              className="group relative flex flex-col items-center justify-center gap-0.5 px-0.5 py-1"
            >
              {/* Indicador activo que se desliza entre tabs (layoutId) */}
              {isOn && (
                <motion.span
                  layoutId="tabbar-active"
                  aria-hidden
                  className={
                    useCompactBrowserDock
                      ? "absolute inset-x-1 top-0 h-full rounded-[15px] bg-cart-accent/12"
                      : "absolute -top-2 h-[3px] w-7 rounded-b bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent)]"
                  }
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}

              {/* Ícono en contenedor de tamaño fijo → todos los tabs quedan
                  perfectamente centrados pese a íconos de distinto peso. */}
              <motion.span
                animate={{ scale: isOn ? 1.06 : 1, y: isOn ? -1 : 0 }}
                whileTap={{ scale: 0.86 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                className={
                  "relative z-10 grid size-[22px] place-items-center transition-colors " +
                  (isOn ? "text-cart-accent" : "text-cart-ink-3 group-hover:text-cart-ink")
                }
              >
                <Icon />
                {dot && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-0.5 size-[7px] rounded-full bg-cart-accent shadow-[0_0_6px_var(--color-cart-accent)]"
                  />
                )}
              </motion.span>

              <span
                className={
                  (useCompactBrowserDock ? "sr-only " : "text-[10px] font-medium leading-none ") +
                  "transition-colors " +
                  (isOn ? "text-cart-accent" : "text-cart-ink-3")
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
