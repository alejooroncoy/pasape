"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export type VenueValue = {
  name: string;
  lat: number | null;
  lng: number | null;
  url: string | null;
  source: "manual" | "google" | "apple";
};

type Props = {
  value: VenueValue;
  onChange: (next: VenueValue) => void;
  placeholder?: string;
};

const isMapsLike = (s: string): boolean =>
  /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.|maps\.)?google\.[a-z.]+\/maps|(?:beta\.)?maps\.apple\.com)/i.test(
    s.trim(),
  );

export function VenueInput({ value, onChange, placeholder = "Pega un link de Google/Apple Maps o escribe el lugar" }: Props) {
  const [draft, setDraft] = useState(value.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  // Si el value externo cambia (ej: reset del form), sincroniza.
  useEffect(() => {
    setDraft(value.name);
  }, [value.name]);

  const reset = () => {
    onChange({ name: "", lat: null, lng: null, url: null, source: "manual" });
    setDraft("");
    setError(null);
  };

  const onTextChange = async (raw: string) => {
    setDraft(raw);
    setError(null);

    // Texto plano: pasa como manual sin coords.
    if (!isMapsLike(raw)) {
      onChange({ name: raw, lat: null, lng: null, url: null, source: "manual" });
      return;
    }

    // Es un link de maps — resolverlo.
    aborter.current?.abort();
    const ctrl = new AbortController();
    aborter.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch("/api/utils/resolve-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw.trim() }),
        signal: ctrl.signal,
      });
      const json = (await res.json()) as
        | { ok: true; value: { name: string | null; lat: number | null; lng: number | null; source: "google" | "apple"; resolvedUrl: string } }
        | { ok: false; error: string };
      if (!json.ok) {
        // Fallback: lo deja como texto manual con la URL pegada como nombre temporal.
        setError("No pude leer el link, escribe el lugar a mano.");
        onChange({ name: "", lat: null, lng: null, url: null, source: "manual" });
        setDraft("");
        return;
      }
      const d = json.value;
      onChange({
        name: d.name ?? "Lugar sin nombre",
        lat: d.lat,
        lng: d.lng,
        url: d.resolvedUrl,
        source: d.source,
      });
      setDraft(d.name ?? "Lugar sin nombre");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("Error al resolver el link.");
    } finally {
      if (aborter.current === ctrl) setLoading(false);
    }
  };

  const hasResolved = value.source !== "manual" && value.lat !== null && value.lng !== null;

  return (
    <div className="flex flex-col gap-2">
      {hasResolved ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-3"
        >
          <span
            aria-hidden
            className="grid size-8 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-white">{value.name}</div>
            <div className="truncate text-[11.5px] text-cart-ink-3 tabular-nums">
              {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)} ·{" "}
              <span className="capitalize">{value.source === "google" ? "Google Maps" : "Apple Maps"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-cart-line bg-cart-bg px-3 py-1 text-[12px] font-medium text-cart-ink-2 hover:border-cart-line-strong hover:text-white"
          >
            Cambiar
          </button>
        </motion.div>
      ) : (
        <>
          <div className="relative">
            <input
              type="text"
              value={draft}
              onChange={(e) => void onTextChange(e.target.value)}
              placeholder={placeholder}
              className="block w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-2.5 pr-10 text-[14px] text-white placeholder:text-cart-ink-3 outline-none focus:border-cart-accent"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cart-ink-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                  <path d="M12 7a5 5 0 00-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            )}
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11.5px] text-rose-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="text-[11.5px] text-cart-ink-4">
            Tip: pega el link de Google Maps o Apple Maps del lugar y completamos el resto.
          </p>
        </>
      )}
    </div>
  );
}
