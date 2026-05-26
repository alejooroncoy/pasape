import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

type Props = {
  children: ReactNode;
  navItems?: { href: string; label: string }[];
};

export const AppShellMobile = ({ children, navItems }: Props) => (
  <div className="flex min-h-screen flex-col bg-(--color-bg) md:hidden">
    <main className="flex-1 overflow-y-auto">{children}</main>
    {navItems && <BottomNav items={navItems} />}
  </div>
);
