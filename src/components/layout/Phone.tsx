import type { ReactNode } from "react";

export const Phone = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[44px] border border-(--color-border) bg-(--color-bg) shadow-2xl">
    {children}
  </div>
);
