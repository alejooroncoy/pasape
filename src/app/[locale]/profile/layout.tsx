import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
