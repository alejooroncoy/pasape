"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium tracking-wide text-cart-ink-2">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11.5px] text-cart-ink-3">{hint}</span> : null}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { readonly?: boolean };

export function TextInput({ className = "", readonly, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      readOnly={readonly}
      className={`w-full rounded-lg border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[14px] text-cart-ink placeholder:text-cart-ink-4 outline-none transition-colors focus:border-cart-accent/50 focus:bg-cart-bg-elev ${
        readonly ? "cursor-not-allowed text-cart-ink-3" : ""
      } ${className}`}
    />
  );
}

type TextAreaProps = Omit<InputHTMLAttributes<HTMLTextAreaElement>, "rows"> & { rows?: number };

export function TextArea({ className = "", rows = 3, ...rest }: TextAreaProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = rest as any;
  return (
    <textarea
      {...props}
      rows={rows}
      className={`w-full resize-none rounded-lg border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[14px] text-cart-ink placeholder:text-cart-ink-4 outline-none transition-colors focus:border-cart-accent/50 focus:bg-cart-bg-elev ${className}`}
    />
  );
}
