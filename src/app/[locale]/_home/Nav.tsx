"use client";

import {
  AppHeader,
  HeaderActions,
  HeaderBrand,
  HeaderCity,
  HeaderSearch,
  MobileCategoryStrip,
  type NavUser,
} from "./AppHeader";
import type { EventCategory } from "@/server/events/domain/Event";

export type { NavUser };

type NavProps = {
  user: NavUser | null;
  onOpenDrawer: () => void;
  onOpenSignIn: () => void;
  onSearch: (q: string) => void;
  onSelectCategory: (cat: EventCategory | null) => void;
  selectedCategory: EventCategory | null;
};

// Header de la home — composición: marca + ciudad + buscador + acciones, con el
// strip de categorías (solo móvil) debajo. onOpenSignIn se conserva para
// compatibilidad aunque el modal de sign-in vive dentro de las acciones.
export function Nav({ user, onOpenDrawer, onSearch, onSelectCategory, selectedCategory }: NavProps) {
  return (
    <AppHeader
      below={
        <MobileCategoryStrip
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />
      }
    >
      <HeaderBrand />
      <HeaderCity />
      <HeaderSearch onSearch={onSearch} />
      <HeaderActions user={user} onOpenMenu={onOpenDrawer} />
    </AppHeader>
  );
}
