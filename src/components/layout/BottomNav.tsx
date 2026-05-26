"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/_shared/cn";

type Item = { href: string; label: string };

type Props = { items: Item[] };

export const BottomNav = ({ items }: Props) => {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 flex border-t border-(--color-border) bg-(--color-bg-elevated)/90 px-2 py-2 backdrop-blur">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={item.href as any}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              active ? "text-(--color-accent)" : "text-(--color-fg-muted)",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
