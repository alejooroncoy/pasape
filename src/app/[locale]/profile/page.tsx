"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { LoginGate } from "@/components/ui/LoginGate";

const initialsOf = (name: string | null | undefined) => {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
};

export default function BuyerProfilePage() {
  const { data, isLoading } = useCurrentUser();
  const tickets = useMyTickets();
  const signOut = useSignOut();
  const router = useRouter();

  const user = data?.user ?? null;
  const fullName = user?.fullName ?? "Tu perfil";
  const sub = user?.email ?? user?.phone ?? "";

  // Reportar un problema → WhatsApp de soporte (número en variable de entorno).
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const reportUrl = supportPhone
    ? `https://wa.me/${supportPhone}?text=${encodeURIComponent(
        `Hola, quiero reportar un problema en Pasape.\n\nMi cuenta: ${sub || "(invitado)"}`,
      )}`
    : null;

  const stats = useMemo(() => {
    const all = tickets.data ?? [];
    const entradas = all.length;
    const noches = new Set(
      all
        .filter((t) => t.status === "used" || t.event.status === "closed")
        .map((t) => t.event.id),
    ).size;
    return { entradas, noches };
  }, [tickets.data]);

  // Sin sesión → gate amable en vez de un perfil vacío.
  if (!isLoading && !user) {
    return (
      <LoginGate
        title="Inicia sesión para ver tu cuenta"
        subtitle="Aquí están tu perfil, tus datos y tus entradas. Inicia sesión para continuar."
        next="/profile"
      />
    );
  }

  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[560px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(184,124,255,0.2), transparent 70%)" }}
      />
      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-3 sm:px-6">
        {/* Tarjeta de perfil */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden rounded-[26px] border border-cart-accent/25 p-5"
          style={{
            background: "radial-gradient(120% 80% at 30% 0%, rgba(124,58,237,0.3), transparent 70%), var(--color-cart-bg-elev)",
          }}
        >
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={fullName ?? "Tu perfil"}
                referrerPolicy="no-referrer"
                className="size-16 shrink-0 rounded-[20px] object-cover"
                style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.1), 0 18px 40px -12px rgba(124,58,237,0.5)" }}
              />
            ) : (
              <div
                className="grid size-16 shrink-0 place-items-center rounded-[20px] text-[24px] font-extrabold tracking-[-0.02em] text-white"
                style={{
                  background: "linear-gradient(135deg, #FF4D5E, #7C3AED 60%, #4B1F9A)",
                  boxShadow: "0 0 0 2px rgba(255,255,255,0.1), 0 18px 40px -12px rgba(124,58,237,0.5)",
                }}
              >
                {initialsOf(fullName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[22px] font-bold leading-tight tracking-[-0.02em]">
                {isLoading ? "Cargando…" : fullName}
              </h1>
              {sub && <p className="mt-1 truncate text-[12.5px] text-white/55">{sub}</p>}
            </div>
            <Link
              href={"/profile/edit" as never}
              className="shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-[11.5px] font-semibold tracking-[0.03em] text-white transition hover:bg-white/15"
            >
              Editar
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-4">
            <Stat n={String(stats.entradas)} k="entradas" />
            <Stat n={String(stats.noches)} k="noches" />
          </div>
        </motion.div>

        {/* Cuenta */}
        <SectionLabel>Cuenta</SectionLabel>
        <Card>
          <Row icon={<IconBell />} label="Notificaciones" sub="WhatsApp · email" onClick={() => router.push("/profile/notifications" as never)} />
          <Row
            icon={<IconHeart />}
            label="Organizadores que sigues"
            last={!data?.activeOrgSlug}
            onClick={() => router.push("/profile/following" as never)}
          />
          {data?.activeOrgSlug && (
            <Row
              icon={<IconBuilding />}
              label="Tu marca"
              sub={`@${data.activeOrgSlug}`}
              last
              onClick={() => router.push(`/org/${data.activeOrgSlug}` as never)}
            />
          )}
        </Card>

        {/* Ayuda */}
        {reportUrl && (
          <>
            <SectionLabel>Ayuda</SectionLabel>
            <Card>
              <Row
                icon={<IconHelp />}
                label="Reportar un problema"
                sub="Te respondemos por WhatsApp"
                last
                onClick={() => window.open(reportUrl, "_blank", "noopener,noreferrer")}
              />
            </Card>
          </>
        )}

        {/* Sesión */}
        <SectionLabel>Sesión</SectionLabel>
        <Card>
          <Row icon={<IconOut />} label="Cerrar sesión" danger last onClick={() => void signOut()} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ n, k }: { n: string; k: string }) {
  return (
    <div className="text-center">
      <div className="text-[26px] font-bold leading-none tracking-[-0.03em]">{n}</div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-white/45">{k}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">{children}</p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev">{children}</div>;
}

function Row({
  icon,
  label,
  sub,
  danger,
  last,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  danger?: boolean;
  last?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={
        "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition " +
        (last ? "" : "border-b border-cart-line ") +
        (onClick ? "hover:bg-white/[0.03] " : "cursor-default ")
      }
    >
      <span
        className={
          "grid size-9 shrink-0 place-items-center rounded-xl " +
          (danger ? "bg-red-500/10 text-red-300" : "bg-white/5 text-cart-accent")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={"block text-[14px] font-semibold " + (danger ? "text-red-300" : "text-white")}>{label}</span>
        {sub && <span className="mt-0.5 block text-[11.5px] text-white/50">{sub}</span>}
      </span>
      {!danger && onClick && (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="shrink-0 text-white/30">
          <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

const sw = { stroke: "currentColor", strokeWidth: 1.4, fill: "none" } as const;
const IconBell = () => (<svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 12V8a5 5 0 0 1 10 0v4l1.5 2h-13L4 12Z" {...sw} strokeLinejoin="round" /><path d="M7 15a2 2 0 0 0 4 0" {...sw} strokeLinecap="round" /></svg>);
const IconHeart = () => (<svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z" {...sw} strokeLinejoin="round" /></svg>);
const IconBuilding = () => (<svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="3" width="12" height="12" rx="1.5" {...sw} /><path d="M6 6h1M6 9h1M6 12h1M11 6h1M11 9h1M11 12h1" {...sw} strokeLinecap="round" /></svg>);
const IconHelp = () => (<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" {...sw} /><path d="M7 7.5c.3-1 1.1-1.5 2-1.5 1.2 0 2 .8 2 1.7 0 .8-.5 1.2-1 1.5-.7.4-1 .8-1 1.3M9 13v.1" {...sw} strokeLinecap="round" /></svg>);
const IconOut = () => (<svg width="18" height="18" viewBox="0 0 18 18"><path d="M11 4H4v10h7M14 9H7M11 6l3 3-3 3" {...sw} strokeLinecap="round" strokeLinejoin="round" /></svg>);
