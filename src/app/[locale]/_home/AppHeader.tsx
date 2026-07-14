"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretIcon, PinIcon, SearchIcon } from "./icons";
import { Logo } from "@/components/brand/Logo";
import { SignInDrawer } from "./SignInDrawer";
import { CATEGORIES, CATEGORY_BY_ID } from "./categories";
import type { EventCategory } from "@/server/events/domain/Event";
import { pageTintGradient } from "@/lib/_shared/color";
import { useSearchEvents } from "@/lib/events/hooks/useEvents";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { shortEventDate } from "@/lib/_shared/format";

// Spring compartido para micro-interacciones (tap/hover).
const TAP_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

export type NavUser = {
  fullName: string | null;
  avatarUrl: string | null;
};

// ── Shell ───────────────────────────────────────────────────────────────────
// Composition pattern: AppHeader solo aporta el "marco" sticky + la fila flex.
// Cada página compone su header con las piezas que necesita (Brand, Search,
// Actions…). La home incluye el buscador; /tickets y /profile no.
export function AppHeader({
  children,
  below,
  tint,
}: {
  children: ReactNode;
  below?: ReactNode;
  /** Color dominante de la imagen de la página (ej. paleta del flyer del evento)
   *  para que el header combine con el resto de la pantalla en vez de quedar
   *  como una barra negra plana encima. Opcional — sin él, el header usa su
   *  fondo neutro de siempre (home, tickets, perfil, etc). */
  tint?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[border-color,background] duration-200 ${scrolled
          ? "border-cart-line bg-cart-bg/[0.92] backdrop-blur-md backdrop-saturate-150"
          : "border-transparent bg-transparent"
        }`}
      // Mismo gradiente que PageContainer, con `background-attachment: fixed`
      // en los dos — así el % del gradiente se resuelve contra el viewport y
      // el header pinta exactamente el mismo recorte que se ve "detrás" de
      // él, sin costura, a cualquier scroll (ver `pageTintGradient`).
      style={
        tint
          ? { backgroundImage: pageTintGradient(tint), backgroundAttachment: "fixed" }
          : undefined
      }
    >
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-[18px] px-[clamp(20px,4vw,56px)] max-[560px]:h-[60px] max-[560px]:gap-2">
        {children}
      </div>
      {below}
    </header>
  );
}

// ── Piezas componibles ───────────────────────────────────────────────────────
// `mobileLabel`: mostrar el texto "Pasape" también en móvil. La home lo oculta
// porque el buscador ocupa la fila; en /tickets y /profile no hay buscador, así
// que conviene mostrarlo para que el header no se vea vacío.
export function HeaderBrand({ mobileLabel = false }: { mobileLabel?: boolean }) {
  return (
    <Link
      href="/"
      className={
        "inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em] " +
        (mobileLabel ? "max-[560px]:text-[17px]" : "max-[560px]:text-[0]")
      }
    >
      <span className="grid size-[40px] place-items-center max-[560px]:size-9">
        <Logo className="size-full drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]" />
      </span>
      <span className={mobileLabel ? "" : "max-[560px]:sr-only"}>Pasape</span>
    </Link>
  );
}

/** Selector de ciudad (envuelto para ocultarse en móvil como en la home). */
export function HeaderCity() {
  return (
    <div className="flex items-center gap-2 max-[900px]:hidden">
      <CitySelector className="max-[1180px]:hidden" />
    </div>
  );
}

/** Buscador — crece para llenar el espacio (flex-1). Consulta al backend con
 *  debounce y muestra los resultados en un dropdown bajo el input. */
export function HeaderSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [raw, setRaw] = useState("");
  // Término estabilizado (debounce 350ms) — es el que viaja al backend.
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useSearchEvents(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(raw), 350);
    return () => clearTimeout(t);
  }, [raw]);

  // ⌘K / Ctrl+K → focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("input[data-cart-search]")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Cerrar con click fuera / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showPanel = open && debounced.trim().length >= 2;
  const list = results.data ?? [];

  return (
    <div ref={boxRef} className="relative w-full flex-1">
      <label className="flex h-[42px] w-full items-center gap-2.5 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 transition-colors focus-within:border-cart-accent focus-within:shadow-[0_0_0_4px_var(--color-cart-accent-soft),0_0_18px_var(--color-cart-accent-glow)] max-[560px]:h-10 max-[560px]:px-3 max-[560px]:gap-2">
        <SearchIcon className="shrink-0 text-cart-ink-4" />
        <input
          data-cart-search
          type="search"
          placeholder="Buscar eventos, artistas, lugares…"
          aria-label="Buscar eventos"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-cart-ink outline-none focus:outline-none focus-visible:outline-none max-[560px]:text-sm placeholder:text-cart-ink-4"
          value={raw}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
            onSearch(e.target.value);
          }}
        />
        <kbd className="shrink-0 rounded-md border border-cart-line bg-cart-bg-elev-2 px-1.5 py-0.5 font-mono text-[11px] text-cart-ink-3 max-[560px]:hidden">
          ⌘K
        </kbd>
      </label>

      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] overflow-hidden rounded-[16px] border border-cart-line bg-cart-bg shadow-[0_24px_60px_-16px_rgba(20,10,60,0.28)]">
          {results.isLoading && (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="size-10 animate-pulse rounded-[8px] bg-cart-bg-elev-2" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-1/2 animate-pulse rounded bg-cart-bg-elev-2" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-cart-bg-elev-2" />
              </div>
            </div>
          )}

          {!results.isLoading && list.length === 0 && (
            <p className="m-0 px-4 py-4 text-[13px] text-cart-ink-3">
              Sin resultados para “{debounced.trim()}”
            </p>
          )}

          {list.slice(0, 6).map((ev) => (
            <Link
              key={ev.id}
              href={`/events/${ev.slug}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-cart-bg-elev"
            >
              {ev.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizeImageUrl(ev.coverUrl, "card") ?? ev.coverUrl}
                  alt=""
                  className="size-10 flex-shrink-0 rounded-[8px] object-cover"
                />
              ) : (
                <span className="size-10 flex-shrink-0 rounded-[8px] bg-cart-bg-elev-2" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-cart-ink">
                  {ev.title}
                </span>
                <span className="block truncate text-[11.5px] text-cart-ink-3">
                  <span className="font-semibold text-cart-accent">
                    {shortEventDate(ev.startsAt, ev.timezone)}
                  </span>
                  {ev.venue ? ` · ${ev.venue}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Empuja las acciones a la derecha cuando no hay buscador que ocupe el centro. */
export function HeaderSpacer() {
  return <div className="flex-1" aria-hidden />;
}

/** Acciones de cuenta: Soy organizador · Mis entradas · avatar/Ingresar · menú. */
export function HeaderActions({ user, onOpenMenu }: { user: NavUser | null; onOpenMenu: () => void }) {
  // Modal de login controlado: lo abren tanto "Ingresar" como "Mis entradas"
  // cuando no hay sesión (en vez de navegar a una página que igual redirige).
  const [signInOpen, setSignInOpen] = useState(false);
  // "Mis entradas" sin sesión debe volver a /tickets tras loguear (esa era la
  // intención del click); "Ingresar" en cambio se queda donde estabas.
  const [signInRedirect, setSignInRedirect] = useState<string | undefined>(undefined);
  const ticketsClass =
    "relative inline-flex h-10 items-center gap-2 rounded-full border border-transparent px-3 text-[13.5px] font-medium text-cart-ink-2 transition-colors hover:border-cart-line hover:bg-cart-bg-elev hover:text-cart-ink max-[900px]:hidden";
  const ticketsInner = (
    <>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 6a1 1 0 011-1h10a1 1 0 011 1v1a1 1 0 100 2v1a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 100-2V6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6.5 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.5 1.5" />
      </svg>
      <span className="max-[1180px]:hidden">Mis entradas</span>
    </>
  );

  return (
    <div className="flex items-center gap-2.5 max-[560px]:gap-0">
      {process.env.NODE_ENV !== "production" && <DevSessionButton />}

      <Link
        href="/organizadores"
        className="whitespace-nowrap text-[13.5px] text-cart-ink-2 transition-colors hover:text-cart-ink max-[1180px]:hidden"
      >
        Soy organizador
      </Link>

      <span className="h-5 w-px bg-cart-line max-[1180px]:hidden" aria-hidden />

      {user ? (
        <Link href={"/tickets" as never} className={ticketsClass}>
          {ticketsInner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSignInRedirect("/tickets");
            setSignInOpen(true);
          }}
          className={ticketsClass}
        >
          {ticketsInner}
        </button>
      )}

      {user ? (
        <motion.button
          type="button"
          onClick={onOpenMenu}
          aria-label="Mi cuenta"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          transition={TAP_SPRING}
          className="inline-flex items-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev py-1 pl-1 pr-3 transition-colors hover:border-cart-line-strong max-[900px]:hidden"
        >
          <Avatar user={user} />
          <span className="max-w-[120px] truncate text-sm font-medium text-cart-ink">
            {firstName(user.fullName)}
          </span>
        </motion.button>
      ) : (
        <>
          <motion.button
            type="button"
            onClick={() => {
              setSignInRedirect(undefined);
              setSignInOpen(true);
            }}
            whileHover={{ y: -1, filter: "brightness(1.1)" }}
            whileTap={{ scale: 0.96 }}
            transition={TAP_SPRING}
            className="whitespace-nowrap rounded-full border-0 bg-cart-accent px-[18px] py-2.5 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_6px_22px_-6px_var(--color-cart-accent-glow-strong)] max-[900px]:hidden"
          >
            Ingresar
          </motion.button>
          <SignInDrawer
            open={signInOpen}
            onClose={() => setSignInOpen(false)}
            redirectTo={signInRedirect}
          />
        </>
      )}

      <motion.button
        type="button"
        onClick={onOpenMenu}
        aria-label="Menú"
        whileTap={{ scale: 0.9 }}
        transition={TAP_SPRING}
        className="hidden size-10 place-items-center rounded-full border border-cart-line bg-cart-bg-elev max-[900px]:grid"
      >
        <span className="block h-px w-4 bg-cart-ink-2 relative before:absolute before:top-[-5px] before:block before:h-px before:w-4 before:bg-cart-ink-2 before:content-[''] after:absolute after:top-[5px] after:block after:h-px after:w-4 after:bg-cart-ink-2 after:content-['']" />
      </motion.button>
    </div>
  );
}

// Dev-only: loguea (con cookies reales de Supabase) a un usuario de prueba
// fijo, para reproducir bugs de sesión/race conditions sin pasar por Google
// OAuth cada vez. No se renderiza en producción (ver HeaderActions).
function DevSessionButton() {
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/dev/login-as", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      window.location.href = "/tickets";
    } catch {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="whitespace-nowrap rounded-full border border-dashed border-amber-400/50 px-3 py-1.5 text-[12px] font-semibold text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-50"
      title="Dev only: loguea con un usuario de prueba"
    >
      {pending ? "…" : "Sesión"}
    </button>
  );
}


export function CitySelector({ className = "" }: { className?: string }) {
  const [showSoon, setShowSoon] = useState(false);

  useEffect(() => {
    if (!showSoon) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-city-selector]")) setShowSoon(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSoon(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSoon]);

  return (
    <div data-city-selector className={`relative ${className}`}>
      <motion.button
        type="button"
        onClick={() => setShowSoon((v) => !v)}
        aria-expanded={showSoon}
        aria-label="Lima — cambiar ciudad (disponible pronto)"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-flex items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-3 py-2 text-[13px] font-medium text-cart-ink-2 transition-colors hover:border-cart-line-strong hover:text-cart-ink"
      >
        <PinIcon className="text-cart-accent" />
        Lima
        <motion.span animate={{ rotate: showSoon ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <CaretIcon />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {showSoon && (
          <motion.span
            role="status"
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute left-1/2 top-[calc(100%+8px)] z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-cart-line bg-cart-bg-elev-2 px-2.5 py-1 text-[11.5px] font-medium text-cart-ink-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          >
            Más ciudades pronto
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ user }: { user: NavUser }) {
  const initial = (user.fullName?.trim()?.[0] ?? "?").toUpperCase();
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cart-accent text-[13px] font-semibold text-white">
      {initial}
    </span>
  );
}

function firstName(fullName: string | null): string {
  return fullName?.trim().split(/\s+/)[0] ?? "Mi cuenta";
}

// ── Strip de categorías (solo móvil) ─────────────────────────────────────────
type StripChip = { label: string; cat: EventCategory | null };
const STRIP_CHIPS: StripChip[] = [
  { label: "Todos", cat: null },
  ...CATEGORIES.map((c) => ({ label: c.label, cat: c.id })),
];

export function MobileCategoryStrip({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: EventCategory | null;
  onSelectCategory: (cat: EventCategory | null) => void;
}) {
  return (
    <div
      className="hidden items-center gap-2 overflow-x-auto border-t border-cart-line-2 px-[clamp(20px,4vw,56px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[560px]:flex"
      aria-label="Filtros rápidos"
    >
      <CitySelector />
      <span className="h-4 w-px shrink-0 bg-cart-line" aria-hidden />
      {STRIP_CHIPS.map(({ label, cat }) => {
        const active = selectedCategory === cat;
        const color = cat ? CATEGORY_BY_ID[cat].color : "var(--color-cart-ink)";
        const activeText = cat ? "#0a0a0f" : "var(--color-cart-bg)";
        return (
          <motion.button
            key={label}
            type="button"
            onClick={() => onSelectCategory(cat)}
            whileTap={{ scale: 0.93 }}
            transition={TAP_SPRING}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors"
            style={
              active
                ? {
                  borderColor: color,
                  background: color,
                  color: activeText,
                  boxShadow: `0 0 12px ${cat ? `${color}80` : "transparent"}`,
                }
                : {
                  borderColor: "var(--color-cart-line)",
                  background: "transparent",
                  color: "var(--color-cart-ink-2)",
                }
            }
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
