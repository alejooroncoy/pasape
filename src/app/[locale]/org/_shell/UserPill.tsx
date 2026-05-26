"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";

export function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || "·").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function UserMenuItems({ onClose }: { onClose: () => void }) {
  const signOut = useSignOut();
  const router = useRouter();
  return (
    <div className="p-1">
      <MenuItem
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M3 13.5c.7-2.3 2.6-3.5 5-3.5s4.3 1.2 5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        }
        label="Mi cuenta"
        onClick={() => {
          onClose();
          router.push("/account" as never);
        }}
      />
      <MenuItem
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1M11.2 4.8l1-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        }
        label="Ajustes de marca"
        onClick={() => {
          onClose();
          router.push("/org/settings" as never);
        }}
      />
      <MenuItem
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 11l3-3-3-3M13 8H5M7 13H3.5A1.5 1.5 0 012 11.5v-7A1.5 1.5 0 013.5 3H7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Cerrar sesión"
        tone="danger"
        onClick={async () => {
          onClose();
          await signOut();
          router.push("/" as never);
        }}
      />
    </div>
  );
}

export function UserPill() {
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const user = me.data?.user;

  if (!user) {
    return (
      <Link
        href={"/login" as never}
        className="flex items-center justify-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev px-3 py-2.5 text-[13px] font-medium text-cart-ink-2 transition-colors hover:border-cart-accent hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M9 3h3a1 1 0 011 1v8a1 1 0 01-1 1H9M3 8h7M7 5l3 3-3 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Iniciar sesión
      </Link>
    );
  }

  const initials = initialsOf(user.fullName, user.email);
  const displayName = user.fullName || user.email?.split("@")[0] || "Tú";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex w-full items-center gap-2.5 rounded-2xl border bg-cart-bg-elev px-2.5 py-2 text-left transition-colors ${
          open
            ? "border-cart-accent shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
            : "border-cart-line hover:border-cart-line-strong"
        }`}
      >
        <span
          aria-hidden
          className="grid size-9 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[12.5px] font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">{displayName}</span>
          {user.email && (
            <span className="block truncate text-[11.5px] text-cart-ink-3">{user.email}</span>
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={`flex-shrink-0 text-cart-ink-3 transition-transform duration-150 group-hover:text-white ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M3 4.5L6 7.5l3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 380, mass: 0.6 }}
            style={{ transformOrigin: "bottom center" }}
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 overflow-hidden rounded-2xl border border-cart-line-strong bg-cart-bg-elev-2 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]"
          >
            <div className="border-b border-cart-line px-3.5 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-cart-ink-4">
                Conectado como
              </div>
              <div className="mt-1 truncate text-[13px] font-semibold text-white">{displayName}</div>
              {user.email && (
                <div className="truncate text-[11.5px] text-cart-ink-3">{user.email}</div>
              )}
            </div>
            <UserMenuItems onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  const cls =
    tone === "danger"
      ? "text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
      : "text-cart-ink-2 hover:bg-cart-bg-elev hover:text-white";
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors ${cls}`}
    >
      <span className="grid size-5 flex-shrink-0 place-items-center text-cart-ink-3">{icon}</span>
      {label}
    </button>
  );
}
