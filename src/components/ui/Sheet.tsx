"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/_shared/cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  side?: "bottom" | "right";
};

export const Sheet = ({ open, onOpenChange, title, children, side = "bottom" }: Props) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-(--color-bg-elevated) p-6 shadow-2xl",
          side === "bottom"
            ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl"
            : "right-0 top-0 h-full w-full max-w-md rounded-l-3xl",
        )}
      >
        {title && (
          <Dialog.Title className="text-lg font-semibold text-(--color-fg)">{title}</Dialog.Title>
        )}
        <Dialog.Description className="sr-only">{title ?? "Pasape"}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
