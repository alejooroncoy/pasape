import type { ReactNode } from "react";

type Props = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export const EmptyState = ({ title, body, action }: Props) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <h2 className="text-lg font-medium text-(--color-fg)">{title}</h2>
    {body && <p className="max-w-sm text-sm text-(--color-fg-muted)">{body}</p>}
    {action}
  </div>
);
