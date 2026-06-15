"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ticket, Heart, Bell, LogOut, ChevronRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useSignOut } from "@/lib/identity/hooks/useSupabaseAuth";
import { CloseIcon, WaIcon, PinIcon } from "./icons";
import { Logo } from "@/components/brand/Logo";
import { WA_HREF } from "./wa";
import { CATEGORIES } from "./categories";
import type { NavUser } from "./Nav";
import type { EventCategory } from "@/server/events/domain/Event";

export function SideDrawer({ user, open, onClose, onSignIn, onSelectCategory }: {
  user: NavUser | null;
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSelectCategory?: (cat: EventCategory | null) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            aria-label="Menú"
            className="fixed inset-y-0 right-0 z-[81] flex w-[min(380px,86vw)] flex-col overflow-hidden border-l border-cart-line bg-cart-bg shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.6)]"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-cart-line px-[22px] py-[18px]">
              <Link href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em]">
                <span className="grid size-[34px] place-items-center">
                  <Logo className="size-full" />
                </span>
                Pasape
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="grid size-[38px] cursor-pointer place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition-colors hover:border-cart-line-strong hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-1.5 pt-2.5 pb-3 overscroll-contain">
              {/* Header de cuenta — fila tappable, sin card */}
              <AccountHeader user={user} onClose={onClose} onSignIn={onSignIn} />

              {user && (
                <Section title="Tu cuenta" topBorder>
                  <AccountRow href="/tickets" icon={<Ticket size={18} strokeWidth={1.8} />} label="Mis entradas" onClose={onClose} />
                  <AccountRow href="/profile/following" icon={<Heart size={18} strokeWidth={1.8} />} label="Organizadores que sigues" onClose={onClose} />
                  <AccountRow href="/profile/notifications" icon={<Bell size={18} strokeWidth={1.8} />} label="Notificaciones" onClose={onClose} />
                </Section>
              )}

              <Section title="Explorar" topBorder>
                <Item Icon={PinIcon} label="Lima" meta="cambiar" />
              </Section>

              <Section title="Categorías" topBorder>
                {CATEGORIES.map(({ id, label, Icon }) => (
                  <Item
                    key={id}
                    Icon={Icon}
                    label={label}
                    onClick={() => {
                      onSelectCategory?.(id);
                      onClose();
                    }}
                  />
                ))}
              </Section>

              <Section title="Pasape" topBorder>
                <Link
                  href="/organizadores"
                  onClick={onClose}
                  className="flex w-full cursor-pointer items-center gap-3.5 rounded-[10px] bg-transparent px-4 py-[11px] text-[15px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev hover:text-white"
                >
                  <span className="grid size-[22px] flex-shrink-0 place-items-center text-cart-ink-3">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2.5 8a1.5 1.5 0 003 0V6.5h7V8a1.5 1.5 0 003 0V5.5a1 1 0 00-1-1h-11a1 1 0 00-1 1V8zm0 5a1.5 1.5 0 013 0v1.5h7V13a1.5 1.5 0 013 0v2.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V13z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </span>
                  Soy organizador
                </Link>
                <a
                  href={WA_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full cursor-pointer items-center gap-3.5 rounded-[10px] bg-transparent px-4 py-[11px] text-[15px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev hover:text-white"
                >
                  <span className="grid size-[22px] flex-shrink-0 place-items-center text-cart-ink-3">
                    <WaIcon width={18} height={18} />
                  </span>
                  Ayuda por WhatsApp
                </a>
              </Section>
            </div>

            {user && (
              <div className="flex-shrink-0 border-t border-cart-line px-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2">
                <LogoutRow onClose={onClose} />
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Header de cuenta — fila tappable estilo Spotify/X. Logueado → va al perfil;
// invitado → abre el sign-in. Sin card ni botón suelto.
function AccountHeader({ user, onClose, onSignIn }: {
  user: NavUser | null;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const base =
    "mx-1.5 mt-1 flex cursor-pointer items-center gap-3.5 rounded-[12px] px-4 py-3 transition-colors hover:bg-cart-bg-elev";

  if (user) {
    return (
      <Link href="/profile" onClick={onClose} className={base}>
        <DrawerAvatar user={user} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[16px] font-semibold text-white">
            {user.fullName?.trim() || "Tu cuenta"}
          </b>
          <span className="text-[13px] text-cart-ink-3">Ver perfil</span>
        </div>
        <ChevronRight size={18} className="shrink-0 text-cart-ink-4" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        onSignIn();
      }}
      className={`w-full text-left ${base}`}
    >
      <span className="grid size-11 flex-shrink-0 place-items-center rounded-full border border-cart-line-strong bg-cart-bg-elev-2 text-cart-accent">
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 18.5C5 15.5 7.5 14 11 14s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold text-white">Inicia sesión</b>
        <span className="text-[13px] text-cart-ink-3">Guarda eventos y compra</span>
      </div>
      <ChevronRight size={18} className="shrink-0 text-cart-ink-4" />
    </button>
  );
}

// Cerrar sesión — fila danger. Resuelve la falta crítica: poder salir desde móvil.
function LogoutRow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const signOut = useSignOut();

  const handleSignOut = async () => {
    onClose();
    await signOut();
    router.replace("/");
  };

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="flex w-full cursor-pointer items-center gap-3.5 rounded-[10px] bg-transparent px-4 py-[11px] text-left text-[15px] font-medium text-[#ff6470] transition-colors hover:bg-[rgba(255,77,94,0.08)]"
    >
      <span className="grid size-[22px] flex-shrink-0 place-items-center">
        <LogOut size={18} strokeWidth={1.8} />
      </span>
      Cerrar sesión
    </button>
  );
}

function AccountRow({ href, icon, label, onClose }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex w-full cursor-pointer items-center gap-3.5 rounded-[10px] bg-transparent px-4 py-[11px] text-[15px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev hover:text-white"
    >
      <span className="grid size-[22px] flex-shrink-0 place-items-center text-cart-ink-3">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function DrawerAvatar({ user }: { user: NavUser }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt="" className="size-11 flex-shrink-0 rounded-full object-cover" />
    );
  }
  const initial = (user.fullName?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span className="grid size-11 flex-shrink-0 place-items-center rounded-full bg-cart-accent text-[16px] font-semibold text-white">
      {initial}
    </span>
  );
}

function Section({ title, topBorder, children }: { title?: string; topBorder?: boolean; children: React.ReactNode }) {
  return (
    <section className={`px-1.5 pb-2.5 pt-2 ${topBorder ? "border-t border-cart-line-2 pt-2.5" : ""}`}>
      {title && (
        <h6 className="mx-4 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
          {title}
        </h6>
      )}
      {children}
    </section>
  );
}

function Item({ Icon, label, meta, badge, onClick }: {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  meta?: string;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3.5 rounded-[10px] border-0 bg-transparent px-4 py-[11px] text-left text-[15px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev hover:text-white"
    >
      <span className="grid size-[22px] flex-shrink-0 place-items-center text-cart-ink-3">
        <Icon width={18} height={18} />
      </span>
      {label}
      {meta && <span className="ml-auto text-xs text-cart-ink-4">{meta}</span>}
      {badge && (
        <span className="ml-auto rounded-full border border-cart-line-2 bg-cart-bg-elev px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-cart-ink-4">
          {badge}
        </span>
      )}
    </button>
  );
}
