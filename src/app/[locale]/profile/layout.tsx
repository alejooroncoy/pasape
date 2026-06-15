import type { ReactNode } from "react";
import { UserHeader } from "../_home/UserHeader";
import { UserSidebar } from "@/components/layout/UserSidebar";
import { UserTabbar } from "@/components/layout/UserTabbar";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UserHeader />
      <div className="mx-auto w-full max-w-[1320px] lg:flex lg:gap-6 lg:px-6 lg:pt-6">
        <UserSidebar />
        <div className="min-w-0 flex-1 pb-[72px] lg:pb-12">{children}</div>
      </div>
      <UserTabbar />
    </>
  );
}
