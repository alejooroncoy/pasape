"use client";

import type { ReactNode } from "react";
import { Nav } from "@/app/[locale]/organizadores/components/nav";
import { SiteFooter } from "@/app/[locale]/organizadores/components/footer";

export function BlogChrome({ children }: { children: ReactNode }) {
  return (
    <div className="home-light cart-grain relative min-h-screen overflow-x-hidden bg-cart-bg font-sans text-cart-ink">
      <Nav variant="resources" />
      <main className="pt-[68px]">{children}</main>
      <SiteFooter />
    </div>
  );
}
