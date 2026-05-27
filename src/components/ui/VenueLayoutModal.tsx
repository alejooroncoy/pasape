"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  caption?: string;
};

export const VenueLayoutModal = ({ open, onOpenChange, url, caption }: Props) => {
  const [zoomed, setZoomed] = useState(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setZoomed(false);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[121] flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">Plano del local</Dialog.Title>

          {/* Top bar — close + zoom toggle */}
          <div
            className="flex shrink-0 items-center justify-between px-4 pt-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
          >
            <Dialog.Close
              aria-label="Cerrar plano"
              className="grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => setZoomed((v) => !v)}
              aria-label={zoomed ? "Reducir zoom" : "Ampliar zoom"}
              className="hidden size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 lg:grid"
            >
              {zoomed ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M5 7h4M11 11l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 5v4M5 7h4M11 11l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Image surface — native pinch-zoom on iOS via touch-action */}
          <div
            className="flex-1 overflow-auto"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => {
              // Click on backdrop (not image) closes
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={caption ?? "Plano del local"}
                onClick={() => setZoomed((v) => !v)}
                className={
                  "select-none transition-transform duration-200 ease-out " +
                  (zoomed
                    ? "max-w-none cursor-zoom-out lg:scale-[1.8]"
                    : "max-h-[80vh] max-w-full cursor-zoom-in object-contain")
                }
                draggable={false}
              />
            </div>
          </div>

          {/* Caption */}
          <div
            className="shrink-0 px-5 pb-5 text-center"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/60">
              {caption ?? "Ubicación referencial"}
            </p>
            <p className="mt-1 text-[11px] text-white/40 lg:hidden">
              Pellizca para hacer zoom
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
