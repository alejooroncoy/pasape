import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export const Field = ({ label, hint, error, children }: FieldProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm text-(--color-fg-muted)">{label}</span>
    {children}
    {hint && !error && (
      <span className="text-xs text-(--color-fg-subtle)">{hint}</span>
    )}
    {error && <span className="text-xs text-(--color-danger)">{error}</span>}
  </label>
);
