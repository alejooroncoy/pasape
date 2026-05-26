"use client";

import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";

// ============================================================
// DatePicker — pill button + popover con mini-calendario.
// Value/onChange usan formato ISO "YYYY-MM-DD" (mismo que <input type="date">).
// ============================================================

type DatePickerProps = {
  value: string; // "YYYY-MM-DD" o ""
  onChange: (next: string) => void;
  placeholder?: string;
  /** Días no seleccionables antes de esta fecha (inclusive). Default: hoy. */
  minDate?: Date | null;
};

const DAYS_ES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const parseISO = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatPretty = (d: Date): string => {
  const day = d.getDate();
  const month = MONTHS_ES[d.getMonth()]!.slice(0, 3).toLowerCase();
  const year = d.getFullYear();
  const now = new Date();
  if (year === now.getFullYear()) return `${day} ${month}`;
  return `${day} ${month} ${year}`;
};

export function DatePicker({ value, onChange, placeholder = "Elegir fecha", minDate }: DatePickerProps) {
  const selected = parseISO(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());

  const min = minDate === null ? null : minDate ?? new Date(new Date().setHours(0, 0, 0, 0));

  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const offset = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    // Leading blanks: usar días del mes anterior para alinear sin huecos.
    for (let i = offset - 1; i >= 0; i--) {
      cells.push({
        date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), -i),
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d),
        inMonth: true,
      });
    }
    // Trailing para completar 6 filas × 7 = 42 cells.
    while (cells.length < 42) {
      const last = cells[cells.length - 1]!.date;
      cells.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return cells;
  }, [viewMonth]);

  const display = selected ? formatPretty(selected) : placeholder;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`flex w-full items-center gap-2.5 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 text-left text-[14px] transition hover:border-cart-line-strong ${
            selected ? "text-white" : "text-cart-ink-3"
          }`}
        >
          <CalendarIcon />
          <span className="flex-1 truncate">{display}</span>
        </button>
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild sideOffset={6} align="start" collisionPadding={12}>
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="z-50 w-[300px] rounded-2xl border border-cart-line-strong bg-cart-bg-elev p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]"
              >
                {/* Nav */}
                <div className="mb-2 flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                    className="grid size-8 place-items-center rounded-lg text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft />
                  </button>
                  <div className="text-[13.5px] font-semibold text-white tabular-nums">
                    {MONTHS_ES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                    className="grid size-8 place-items-center rounded-lg text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight />
                  </button>
                </div>

                {/* Dow header */}
                <div className="mb-1 grid grid-cols-7 gap-1 px-1 text-center text-[10.5px] font-semibold uppercase tracking-wider text-cart-ink-4">
                  {DAYS_ES.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-1 px-1">
                  {grid.map((cell, i) => {
                    const isSelected = selected ? sameDay(cell.date, selected) : false;
                    const isToday = sameDay(cell.date, new Date());
                    const disabled = min ? cell.date < min : false;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onChange(toISO(cell.date));
                          setOpen(false);
                        }}
                        className={`relative h-9 rounded-lg text-[13px] font-medium tabular-nums transition ${
                          isSelected
                            ? "bg-cart-accent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
                            : disabled
                            ? "text-cart-ink-4/40"
                            : cell.inMonth
                            ? "text-white hover:bg-cart-bg-elev-2"
                            : "text-cart-ink-4 hover:bg-cart-bg-elev-2"
                        }`}
                      >
                        {cell.date.getDate()}
                        {isToday && !isSelected && (
                          <span
                            aria-hidden
                            className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-cart-accent"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer: today shortcut */}
                <div className="mt-2 flex items-center justify-between border-t border-cart-line pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      onChange(toISO(today));
                      setViewMonth(today);
                      setOpen(false);
                    }}
                    className="rounded-md px-2 py-1 text-[12px] font-medium text-cart-ink-2 hover:text-white"
                  >
                    Hoy
                  </button>
                  {selected && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange("");
                        setOpen(false);
                      }}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-cart-ink-3 hover:text-white"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

// ============================================================
// TimePicker — pill button + popover con slots 15-min.
// Value/onChange en formato "HH:MM" (24h, mismo que <input type="time">).
// Render en 12h con AM/PM por accesibilidad.
// ============================================================

type TimePickerProps = {
  value: string; // "HH:MM" o ""
  onChange: (next: string) => void;
  placeholder?: string;
  /** Step en minutos. Default 15. */
  stepMin?: number;
};

const padNum = (n: number) => String(n).padStart(2, "0");

const formatTimePretty = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined) return "";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${padNum(h12)}:${padNum(m)} ${period}`;
};

export function TimePicker({ value, onChange, placeholder = "Elegir hora", stepMin = 15 }: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const slots = useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += stepMin) {
        out.push(`${padNum(h)}:${padNum(m)}`);
      }
    }
    return out;
  }, [stepMin]);

  const display = value ? formatTimePretty(value) : placeholder;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`flex w-full items-center gap-2.5 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 text-left text-[14px] transition hover:border-cart-line-strong ${
            value ? "text-white" : "text-cart-ink-3"
          }`}
        >
          <ClockIcon />
          <span className="flex-1 truncate">{display}</span>
        </button>
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild sideOffset={6} align="start" collisionPadding={12}>
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="z-50 max-h-[260px] w-[180px] overflow-y-auto rounded-2xl border border-cart-line-strong bg-cart-bg-elev p-1.5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)]"
              >
                {slots.map((slot) => {
                  const isSelected = slot === value;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        onChange(slot);
                        setOpen(false);
                      }}
                      ref={(el) => {
                        if (isSelected && el) el.scrollIntoView({ block: "center" });
                      }}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-[13.5px] font-medium tabular-nums transition ${
                        isSelected
                          ? "bg-cart-accent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
                          : "text-white hover:bg-cart-bg-elev-2"
                      }`}
                    >
                      {formatTimePretty(slot)}
                    </button>
                  );
                })}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

// ============================================================
// Icons
// ============================================================

const CalendarIcon = ({ className = "size-4 text-cart-ink-3" }: { className?: string }): ReactNode => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const ClockIcon = ({ className = "size-4 text-cart-ink-3" }: { className?: string }): ReactNode => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronLeft = (): ReactNode => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M9 3l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = (): ReactNode => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
