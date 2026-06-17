import type { ReactNode } from "react";
import { UserHeader } from "../_home/UserHeader";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { UserTabbar } from "@/components/layout/UserTabbar";

export default function FavoritesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-cart-bg">
      <UserHeader />
      <div className="mx-auto flex w-full max-w-[1440px]">
        <UserSidebar />
        <main className="min-w-0 flex-1 pb-[72px] lg:pb-0 lg:pt-6">{children}</main>
      </div>
      <UserTabbar />
    </div>
  );
}
