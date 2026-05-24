"use client";

import { useState } from "react";
import { CompassIcon, HeartIcon, HomeIcon, TicketIcon, UserIcon } from "./icons";

const TABS = [
  { id: "home", label: "Inicio", Icon: HomeIcon },
  { id: "explore", label: "Explorar", Icon: CompassIcon },
  { id: "tickets", label: "Mis entradas", Icon: TicketIcon, dot: true },
  { id: "favs", label: "Favoritos", Icon: HeartIcon },
  { id: "me", label: "Cuenta", Icon: UserIcon },
];

export function MobileTabbar({ onTickets, onAccount }: {
  onTickets: () => void;
  onAccount: () => void;
}) {
  const [active, setActive] = useState("home");
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-[70] hidden border-t border-cart-line bg-cart-bg/90 backdrop-blur-xl backdrop-saturate-150 px-1 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] max-[560px]:block"
    >
      <div className="mx-auto grid max-w-[540px] grid-cols-5">
        {TABS.map(({ id, label, Icon, dot }) => {
          const isOn = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActive(id);
                if (id === "tickets") onTickets();
                if (id === "me") onAccount();
              }}
              className={`relative flex flex-col items-center gap-1 border-0 bg-transparent px-0.5 py-1.5 text-[10.5px] font-medium transition-colors ${
                isOn ? "text-cart-accent" : "text-cart-ink-3"
              }`}
            >
              {isOn && (
                <span
                  aria-hidden
                  className="absolute -top-2 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-b bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent)]"
                />
              )}
              <Icon />
              {label}
              {dot && (
                <span
                  aria-hidden
                  className="absolute top-1 right-[calc(50%-16px)] size-[7px] rounded-full bg-cart-accent shadow-[0_0_6px_var(--color-cart-accent)]"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
