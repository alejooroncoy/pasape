import type { ReactNode } from "react";

type Props = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export const EmptyState = ({ title, body, action }: Props) => (
  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center lg:px-5">
    <h2 className="text-[14px] font-semibold text-(--color-fg)">{title}</h2>
    {body && (
      <p className="max-w-[400px] text-[12.5px] text-(--color-fg-muted)">{body}</p>
    )}
    {action}
  </div>
);
