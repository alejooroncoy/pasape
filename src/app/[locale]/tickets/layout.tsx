import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { UserTabbar } from "@/components/layout/UserTabbar";

export default function TicketsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <div className="max-[560px]:pb-[72px]">{children}</div>
      <UserTabbar />
    </>
  );
}
