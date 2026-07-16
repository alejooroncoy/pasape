import type { Metadata } from "next";
import type { ReactNode } from "react";
import { UserZoneHeader } from "@/components/layout/UserZoneHeader";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { UserTabbar } from "@/components/layout/UserTabbar";
import { MobileOnlyGuard } from "@/components/layout/MobileOnlyGuard";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

export const metadata: Metadata = NOINDEX_METADATA;

export default function TicketsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="home-light min-h-dvh overflow-x-clip bg-cart-bg text-cart-ink">
      <MobileOnlyGuard />
      <UserZoneHeader />
      {/* Mismo max-w + padding que AppHeader (1320px, clamp(20px,4vw,56px)):
          así el rail queda justo debajo del logo en vez de desalineado, que
          es lo que se veía "raro" en desktop. */}
      <div className="mx-auto flex w-full max-w-[1320px] gap-6 px-[clamp(20px,4vw,56px)]">
        <UserSidebar />
        <main className="min-w-0 flex-1 pb-[72px] lg:pb-0 lg:pt-6">{children}</main>
      </div>
      <UserTabbar />
    </div>
  );
}
