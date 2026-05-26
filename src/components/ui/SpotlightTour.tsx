"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useCompleteTour, useOnboardingState } from "@/lib/identity/hooks/useOnboardingState";

export type SpotlightStep = {
  selector: string;
  title: string;
  body: string;
};

type Props = {
  tourId: string;
  steps: SpotlightStep[];
  /** Optional label shown in the pill. Defaults to "Tour". */
  label?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_GAP = 14;

const getRect = (selector: string): Rect | null => {
  if (typeof document === "undefined") return null;
  const els = document.querySelectorAll(selector);
  for (const node of Array.from(els)) {
    const el = node as HTMLElement;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
  }
  return null;
};

export function SpotlightTour({ tourId, steps, label = "Tour" }: Props) {
  const { data, isLoading } = useOnboardingState();
  const completeMut = useCompleteTour();

  const alreadyDone = !!data?.completedTours?.includes(tourId);

  const [mounted, setMounted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [closed, setClosed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter steps whose target exists in the DOM.
  const visibleSteps = useMemo(() => {
    if (!mounted) return [] as SpotlightStep[];
    void tick; // re-evaluate when DOM may have changed
    return steps.filter((s) => getRect(s.selector) !== null);
  }, [steps, mounted, tick]);

  // Retry a few times in case the page is still hydrating.
  useEffect(() => {
    if (!mounted || alreadyDone || closed) return;
    if (visibleSteps.length > 0) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTick((t) => t + 1);
      if (n >= 6) window.clearInterval(id);
    }, 300);
    return () => window.clearInterval(id);
  }, [mounted, alreadyDone, closed, visibleSteps.length]);

  const activeStep = visibleSteps[stepIdx];

  // Compute / re-compute target rect when active step changes.
  const recompute = useCallback(() => {
    if (!activeStep) {
      setRect(null);
      return;
    }
    setRect(getRect(activeStep.selector));
  }, [activeStep]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    if (!activeStep) return;
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [activeStep, recompute]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!activeStep || closed || alreadyDone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeStep, closed, alreadyDone]);

  const finish = useCallback(() => {
    setClosed(true);
    completeMut.mutate(tourId);
  }, [completeMut, tourId]);

  const isLast = stepIdx >= visibleSteps.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      finish();
    } else {
      setStepIdx((i) => i + 1);
    }
  }, [isLast, finish]);

  // ESC closes (and marks done).
  useEffect(() => {
    if (!activeStep || closed || alreadyDone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStep, closed, alreadyDone, finish]);

  if (!mounted) return null;
  if (isLoading) return null;
  if (alreadyDone) return null;
  if (closed) return null;
  if (visibleSteps.length === 0) return null;
  if (!activeStep || !rect) return null;

  const tooltipPos = computeTooltipPosition(rect);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="spotlight-tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="pointer-events-none fixed inset-0 z-[120]"
        aria-modal="true"
        role="dialog"
      >
        {/* Capa clickeable invisible para cerrar al tocar fuera. SIN blur —
            el blur antes oscurecía también el target, anulando el spotlight.
            El dim viene del box-shadow del spotlight (cutout puro). */}
        <div className="pointer-events-auto absolute inset-0" onClick={next} />

        {/* Spotlight: rect transparente sobre el target con box-shadow gigante que
            pinta todo lo demás oscuro. El target queda SHARP, en sus colores
            originales — patrón Mobbin Frame. */}
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.6 }}
          className="pointer-events-none absolute"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            borderRadius: SPOTLIGHT_RADIUS,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 1.5px rgba(184,124,255,0.5), 0 0 0 6px rgba(124,58,237,0.18)",
          }}
        />

        {/* Tooltip */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.6 }}
          className="pointer-events-auto absolute"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            width: TOOLTIP_WIDTH,
          }}
        >
          <div className="relative rounded-2xl border border-cart-line bg-cart-bg-elev p-4 shadow-2xl">
            {/* Pointer triangle */}
            <Pointer placement={tooltipPos.placement} offsetX={tooltipPos.pointerOffsetX} />

            {/* Close button */}
            <button
              type="button"
              aria-label="Cerrar tour"
              onClick={finish}
              className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-white"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 1l8 8M9 1l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <span className="inline-flex items-center rounded-full bg-cart-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-accent">
              {label}
            </span>

            <h3 className="mt-2 pr-6 text-[15px] font-semibold tracking-[-0.01em] text-white">
              {activeStep.title}
            </h3>
            <p className="mt-1 text-[12.5px] leading-snug text-cart-ink-2">{activeStep.body}</p>

            <div className="mt-3.5 flex items-center justify-between">
              <span className="font-mono text-[11px] text-cart-ink-3">
                {stepIdx + 1} of {visibleSteps.length}
              </span>
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-cart-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-black transition hover:brightness-110"
              >
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

type TooltipPos = {
  top: number;
  left: number;
  placement: "top" | "bottom";
  pointerOffsetX: number;
};

const computeTooltipPosition = (rect: Rect): TooltipPos => {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  const targetCenterX = rect.left + rect.width / 2;
  // Estimated tooltip height; safe upper bound. Used only to choose placement.
  const tooltipHeightGuess = 170;

  const spaceBelow = vh - (rect.top + rect.height);
  const placement: "top" | "bottom" =
    spaceBelow >= tooltipHeightGuess + TOOLTIP_GAP || rect.top < tooltipHeightGuess + TOOLTIP_GAP
      ? "bottom"
      : "top";

  // Clamp horizontally so the tooltip stays within 8px of viewport edges.
  let left = targetCenterX - TOOLTIP_WIDTH / 2;
  left = Math.max(8, Math.min(left, vw - TOOLTIP_WIDTH - 8));

  const top =
    placement === "bottom"
      ? rect.top + rect.height + TOOLTIP_GAP
      : rect.top - tooltipHeightGuess - TOOLTIP_GAP;

  // Pointer x relative to tooltip's left edge — try to point at target center.
  const pointerOffsetX = Math.max(16, Math.min(TOOLTIP_WIDTH - 16, targetCenterX - left));

  return { top, left, placement, pointerOffsetX };
};

function Pointer({
  placement,
  offsetX,
}: {
  placement: "top" | "bottom";
  offsetX: number;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: offsetX - 7,
    width: 14,
    height: 8,
    pointerEvents: "none",
  };
  if (placement === "bottom") {
    return (
      <span
        aria-hidden
        style={{ ...baseStyle, top: -8 }}
        className="block"
      >
        <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
          <path
            d="M7 0L0 8h14L7 0z"
            fill="var(--color-cart-bg-elev)"
            stroke="var(--color-cart-line)"
            strokeWidth="1"
          />
          {/* Cover the bottom border line so the triangle merges into the card */}
          <rect x="1" y="7.5" width="12" height="1.5" fill="var(--color-cart-bg-elev)" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden style={{ ...baseStyle, bottom: -8 }} className="block">
      <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
        <path
          d="M7 8L0 0h14L7 8z"
          fill="var(--color-cart-bg-elev)"
          stroke="var(--color-cart-line)"
          strokeWidth="1"
        />
        <rect x="1" y="-1" width="12" height="1.5" fill="var(--color-cart-bg-elev)" />
      </svg>
    </span>
  );
}
