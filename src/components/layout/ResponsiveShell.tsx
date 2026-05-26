import type { ReactNode } from "react";
import { AppShellMobile } from "./AppShellMobile";
import { AppShellDesktop } from "./AppShellDesktop";

type NavItem = { href: string; label: string };

type Props = {
  children: ReactNode;
  navItems?: NavItem[];
  desktopHeader?: ReactNode;
  desktopSidebarFooter?: ReactNode;
};

export const ResponsiveShell = ({ children, navItems, desktopHeader, desktopSidebarFooter }: Props) => (
  <>
    <AppShellMobile navItems={navItems}>{children}</AppShellMobile>
    <AppShellDesktop navItems={navItems} header={desktopHeader} sidebarFooter={desktopSidebarFooter}>
      {children}
    </AppShellDesktop>
  </>
);
