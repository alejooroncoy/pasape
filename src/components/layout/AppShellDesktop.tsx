import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/_shared/cn";

type NavItem = { href: string; label: string };

type Props = {
  children: ReactNode;
  navItems?: NavItem[];
  header?: ReactNode;
  sidebarFooter?: ReactNode;
};

export const AppShellDesktop = ({ children, navItems = [], header, sidebarFooter }: Props) => (
  <div className="hidden min-h-screen md:flex bg-(--color-bg)">
    <aside className="flex w-60 flex-col border-r border-(--color-border) bg-(--color-bg-elevated) px-4 py-5">
      <div className="mb-6 text-lg font-semibold tracking-tight">Pasape</div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={item.href as any}
            className={cn(
              "rounded-xl px-3 py-2 text-sm text-(--color-fg-muted) hover:bg-(--color-bg-card) hover:text-(--color-fg)",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto">{sidebarFooter}</div>
    </aside>
    <div className="flex flex-1 flex-col">
      {header && (
        <header className="flex h-14 items-center justify-between border-b border-(--color-border) bg-(--color-bg-elevated) px-6">
          {header}
        </header>
      )}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-8 py-6">{children}</main>
    </div>
  </div>
);
