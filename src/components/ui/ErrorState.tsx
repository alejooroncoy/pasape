import type { ReactNode } from "react";

type Props = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export const ErrorState = ({ title, body, action }: Props) => (
  <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
    <h2 className="text-lg font-medium text-(--color-danger)">{title}</h2>
    {body && <p className="max-w-sm text-sm text-(--color-fg-muted)">{body}</p>}
    {action}
  </div>
);
